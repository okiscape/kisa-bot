"""Optional Redis client for the bot.

Phase 1 stub: connect when REDIS_URL is set. Feature consumers land later
(metrics cache, shared locks, etc.).
"""

from __future__ import annotations

from typing import Optional

from utils import config
from utils.bot_logging import Logging

logging = Logging()

_redis = None
_import_error: Optional[Exception] = None

try:
    import redis.asyncio as redis_async
except Exception as exc:  # pragma: no cover - optional dependency
    redis_async = None
    _import_error = exc


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
