"""Buffered per-guild daily activity counters (messages / joins / leaves)."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

import disnake

from utils.bot_logging import Logging
from utils.redis_client import guild_metrics_keys, redis_delete

if TYPE_CHECKING:
    from utils.bot_class import KisaBot

logging = Logging()

FLUSH_INTERVAL_SECONDS = 30


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


class GuildMetricsFlusher:
    def __init__(self, bot: "KisaBot") -> None:
        self.bot = bot
        self._task: asyncio.Task | None = None
        # (guild_id, utc_day) -> counters
        self._pending: dict[tuple[int, date], dict[str, int]] = defaultdict(
            lambda: {"messages": 0, "joins": 0, "leaves": 0}
        )
        self._lock = asyncio.Lock()

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self.bot.add_listener(self._on_message, "on_message")
        self.bot.add_listener(self._on_member_join, "on_member_join")
        self.bot.add_listener(self._on_member_remove, "on_member_remove")
        self._task = asyncio.create_task(
            self._loop(), name="guild-metrics-flusher"
        )

    async def stop(self) -> None:
        try:
            self.bot.remove_listener(self._on_message, "on_message")
            self.bot.remove_listener(self._on_member_join, "on_member_join")
            self.bot.remove_listener(self._on_member_remove, "on_member_remove")
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
            await self.flush_once()
        except Exception as exc:
            logging.warning(
                "guild-metrics", f"shutdown flush failed: {exc}", type="warn"
            )

    def _bump(self, guild_id: int, field: str, amount: int = 1) -> None:
        if amount <= 0:
            return
        key = (int(guild_id), _utc_today())
        self._pending[key][field] += amount

    async def _on_message(self, message: disnake.Message) -> None:
        if message.guild is None:
            return
        author = message.author
        if author is None:
            return
        # Humans only — skip bots and webhook posts.
        if getattr(author, "bot", False):
            return
        if message.webhook_id is not None:
            return
        self._bump(message.guild.id, "messages")

    async def _on_member_join(self, member: disnake.Member) -> None:
        if member.bot:
            return
        self._bump(member.guild.id, "joins")

    async def _on_member_remove(self, member: disnake.Member) -> None:
        if member.bot:
            return
        self._bump(member.guild.id, "leaves")

    async def flush_once(self) -> None:
        async with self._lock:
            if not self._pending:
                return
            batch = self._pending
            self._pending = defaultdict(
                lambda: {"messages": 0, "joins": 0, "leaves": 0}
            )

        touched_guilds: set[int] = set()
        for (guild_id, day), counters in batch.items():
            messages = int(counters.get("messages") or 0)
            joins = int(counters.get("joins") or 0)
            leaves = int(counters.get("leaves") or 0)
            if messages == 0 and joins == 0 and leaves == 0:
                continue
            try:
                await self.bot.database.increment_guild_daily_metrics(
                    guild_id=guild_id,
                    day=day,
                    messages=messages,
                    joins=joins,
                    leaves=leaves,
                )
                touched_guilds.add(guild_id)
            except Exception as exc:
                # Re-queue failed deltas so a transient DB blip doesn't drop counts.
                async with self._lock:
                    pending = self._pending[(guild_id, day)]
                    pending["messages"] += messages
                    pending["joins"] += joins
                    pending["leaves"] += leaves
                logging.warning(
                    "guild-metrics",
                    f"flush failed for {guild_id}/{day}: {exc}",
                    type="warn",
                )

        for guild_id in touched_guilds:
            for key in guild_metrics_keys(guild_id):
                await redis_delete(key)

    async def _loop(self) -> None:
        while not self.bot.is_closed():
            try:
                await self.flush_once()
            except Exception as exc:
                logging.warning(
                    "guild-metrics", f"flush loop failed: {exc}", type="warn"
                )
            try:
                await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                raise
