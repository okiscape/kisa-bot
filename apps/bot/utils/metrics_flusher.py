"""Periodic bot_metrics upsert for the dashboard landing counters."""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

import disnake

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
        self._used_commands = 0
        self._seeded = False

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self.bot.add_listener(self._on_interaction, "on_interaction")
        self._task = asyncio.create_task(self._loop(), name="bot-metrics-flusher")

    async def stop(self) -> None:
        try:
            self.bot.remove_listener(self._on_interaction, "on_interaction")
        except Exception:
            pass
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

    def record_command_use(self) -> None:
        self._used_commands += 1

    async def _on_interaction(self, inter: disnake.Interaction) -> None:
        if inter.type == disnake.InteractionType.application_command:
            self.record_command_use()

    async def _ensure_seeded(self) -> None:
        if self._seeded:
            return
        db_value = await self.bot.database.get_bot_metrics_used_commands()
        # Preserve increments that arrived while the SELECT was in flight.
        self._used_commands = db_value + self._used_commands
        self._seeded = True

    async def flush_once(self) -> None:
        await self._ensure_seeded()

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
            used_commands=self._used_commands,
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
