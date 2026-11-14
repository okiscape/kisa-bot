"""Optional Redis client for the bot."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Literal, Optional

from utils import config
from utils.bot_logging import Logging

logging = Logging()

SETTINGS_CACHE_TTL_SECONDS = 30

_redis = None
_import_error: Optional[Exception] = None

try:
    import redis.asyncio as redis_async
except Exception as exc:  # pragma: no cover - optional dependency
    redis_async = None
    _import_error = exc


def guild_settings_key(guild_id: int | str) -> str:
    return f"app:guild:{guild_id}:settings"


def user_settings_key(user_id: int | str) -> str:
    return f"app:user:{user_id}:settings"


def user_profile_key(user_id: int | str) -> str:
    return f"app:user:{user_id}:profile"


GUILD_METRICS_RANGES = ("week", "month", "6m", "year")


def guild_metrics_key(guild_id: int | str, range_key: str) -> str:
    return f"app:guild:{guild_id}:metrics:{range_key}"


def guild_metrics_keys(guild_id: int | str) -> list[str]:
    return [guild_metrics_key(guild_id, range_key) for range_key in GUILD_METRICS_RANGES]


@dataclass(frozen=True)
class RedisLookup:
    """Distinguish cache hit / miss from Redis being disabled or down."""

    status: Literal["hit", "miss", "unavailable"]
    value: Any = None


async def get_redis():
    """Return a shared asyncio Redis client, or None if disabled/unavailable."""
    global _redis

    url = getattr(config, "redis_url", "") or ""
    if not url:
        return None

    if redis_async is None:
        logging.warning(
            "redis",
            f"REDIS_URL set but redis package unavailable: {_import_error}",
            type="warn",
        )
        return None

    if _redis is None:
        _redis = redis_async.from_url(url, decode_responses=True)
        try:
            await _redis.ping()
            logging.info("redis", "connected", type="pos")
        except Exception as exc:
            logging.warning("redis", f"ping failed: {exc}", type="warn")
            await close_redis()
            return None

    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception:
            pass
        _redis = None


def _unwrap_payload(raw: str) -> Any | None:
    """Accept Nest CacheService envelopes or plain JSON values.

    Returns a sentinel miss when the envelope is expired/corrupt.
    """
    try:
        data = json.loads(raw)
    except Exception:
        return None

    if isinstance(data, dict) and "value" in data and "expiresAt" in data:
        stale_until = data.get("staleExpiresAt", data["expiresAt"])
        try:
            if time.time() * 1000 > float(stale_until):
                return None
        except Exception:
            return None
        return data["value"]

    return data


async def redis_get_json(key: str) -> RedisLookup:
    client = await get_redis()
    if client is None:
        return RedisLookup("unavailable")
    try:
        raw = await client.get(key)
        if raw is None:
            return RedisLookup("miss")
        value = _unwrap_payload(raw)
        if value is None and raw is not None:
            # Expired / corrupt envelope — treat as miss so caller refills.
            return RedisLookup("miss")
        return RedisLookup("hit", value)
    except Exception as exc:
        logging.warning("redis", f"get failed for {key}: {exc}", type="warn")
        return RedisLookup("unavailable")


async def redis_set_json(
    key: str,
    value: Any,
    ttl_seconds: int = SETTINGS_CACHE_TTL_SECONDS,
) -> None:
    client = await get_redis()
    if client is None:
        return
    now_ms = int(time.time() * 1000)
    payload = {
        "value": value,
        "expiresAt": now_ms + ttl_seconds * 1000,
        "staleExpiresAt": now_ms + ttl_seconds * 1000,
    }
    try:
        await client.set(
            key,
            json.dumps(payload, default=str),
            ex=max(ttl_seconds, 1) + 1,
        )
    except Exception as exc:
        logging.warning("redis", f"set failed for {key}: {exc}", type="warn")


async def redis_delete(key: str) -> None:
    client = await get_redis()
    if client is None:
        return
    try:
        await client.delete(key)
    except Exception as exc:
        logging.warning("redis", f"delete failed for {key}: {exc}", type="warn")
