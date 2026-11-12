"""Periodic bot_metrics upsert for the dashboard landing counters."""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

from utils import config
from utils.bot_logging import Logging

if TYPE_CHECKING:
    from utils.bot_class import KisaBot

logging = Logging()

FLUSH_INTERVAL_SECONDS = 30


class MetricsFlusher:
    def __init__(self, bot: "KisaBot") -> None:
        self.bot = bot
        self._task: asyncio.Task | None = None
        self._started_at = time.monotonic()

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._loop(), name="bot-metrics-flusher")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        try:
            await self.bot.database.set_bot_metrics_offline()
        except Exception as exc:
            logging.warning("metrics", f"offline flush failed: {exc}", type="warn")

    async def flush_once(self) -> None:
        guilds = list(self.bot.guilds)
        guild_count = len(guilds)
        user_count = sum(g.member_count or 0 for g in guilds)
        channel_count = sum(len(g.channels) for g in guilds)

        command_count = 0
        for cog in self.bot.cogs.values():
            try:
                command_count += len(getattr(cog, "__cog_app_commands__", []) or [])
            except Exception:
                continue
        if command_count == 0:
            try:
                command_count = len(list(self.bot.application_commands))
            except Exception:
                command_count = 0

        latency_ms = int(max(0.0, (self.bot.latency or 0.0) * 1000))
        shard_count = int(getattr(self.bot, "shard_count", None) or 1)
        uptime_seconds = int(max(0.0, time.monotonic() - self._started_at))
        version = f"{config.version_name}-{config.version_number}"

        await self.bot.database.upsert_bot_metrics(
            guild_count=guild_count,
            user_count=user_count,
            command_count=command_count,
            channel_count=channel_count,
            shard_count=shard_count,
            latency_ms=latency_ms,
            uptime_seconds=uptime_seconds,
            version=version,
            online=True,
        )

    async def _loop(self) -> None:
        while not self.bot.is_closed():
            try:
                await self.flush_once()
            except Exception as exc:
                logging.warning("metrics", f"flush failed: {exc}", type="warn")
            try:
                await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                raise
