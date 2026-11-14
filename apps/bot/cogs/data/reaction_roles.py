import re

import disnake
import cog

_CUSTOM_EMOJI_RE = re.compile(r"^(?:a:)?([\w-]{2,32}):(\d{17,20})$")


def _emoji_key(emoji: disnake.PartialEmoji | disnake.Emoji | str) -> str | None:
    if isinstance(emoji, str):
        return emoji
    if emoji.id:
        name = emoji.name or "emoji"
        return f"a:{name}:{emoji.id}" if emoji.animated else f"{name}:{emoji.id}"
    return emoji.name


def _emoji_matches(stored: str, incoming: str) -> bool:
    if stored == incoming:
        return True
    a = _CUSTOM_EMOJI_RE.match(stored)
    b = _CUSTOM_EMOJI_RE.match(incoming)
    if a and b:
        return a.group(2) == b.group(2)
    # Animated flag / FE0F differences on unicode paths.
    def strip_a(value: str) -> str:
        return value[2:] if value.startswith("a:") else value

    return strip_a(stored) == strip_a(incoming)


class ReactionRoles(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

    async def _panel_for_message(self, message_id: int) -> dict | None:
        try:
            return await self.bot.database.get_reaction_role_panel_by_message(message_id)
        except Exception:
            return None

    def _find_pair(self, panel: dict, emoji_key: str) -> dict | None:
        for pair in panel.get("pairs") or []:
            if _emoji_matches(str(pair.get("emoji") or ""), emoji_key):
                return pair
        return None

    async def _member(
        self, guild_id: int, user_id: int
    ) -> disnake.Member | None:
        guild = self.bot.get_guild(guild_id)
        if not guild:
            return None
        member = guild.get_member(user_id)
        if member:
            return member
        try:
            return await guild.fetch_member(user_id)
        except Exception:
            return None

    async def _apply_add(
        self,
        *,
        panel: dict,
        member: disnake.Member,
        pair: dict,
        payload: disnake.RawReactionActionEvent,
    ) -> None:
        role_id = int(pair["role_id"])
        role = member.guild.get_role(role_id)
        if not role:
            return

        panel_type = (panel.get("type") or "normal").lower()

        if panel_type == "unique":
            other_role_ids = [
                int(p["role_id"])
                for p in panel.get("pairs") or []
                if int(p["role_id"]) != role_id
            ]
            to_remove = [r for r in member.roles if r.id in other_role_ids]
            if to_remove:
                try:
                    await member.remove_roles(
                        *to_remove, reason="Reaction role unique"
                    )
                except Exception:
                    pass
            # Best-effort: clear other reactions from this user on the message.
            try:
                channel = self.bot.get_channel(payload.channel_id) or await self.bot.fetch_channel(
                    payload.channel_id
                )
                message = await channel.fetch_message(payload.message_id)
                for reaction in message.reactions:
                    key = _emoji_key(reaction.emoji)
                    if not key or _emoji_matches(str(pair.get("emoji") or ""), key):
                        continue
                    if not self._find_pair(panel, key):
                        continue
                    try:
                        await message.remove_reaction(reaction.emoji, member)
                    except Exception:
                        pass
            except Exception:
                pass

        if role in member.roles:
            return
        try:
            await member.add_roles(role, reason="Reaction role")
        except Exception:
            pass

    async def _apply_remove(
        self,
        *,
        panel: dict,
        member: disnake.Member,
        pair: dict,
    ) -> None:
        panel_type = (panel.get("type") or "normal").lower()
        if panel_type == "verify":
            return

        role_id = int(pair["role_id"])
        role = member.guild.get_role(role_id)
        if not role or role not in member.roles:
            return
        try:
            await member.remove_roles(role, reason="Reaction role remove")
        except Exception:
            pass

    @cog.listener()
    async def on_raw_reaction_add(
        self, payload: disnake.RawReactionActionEvent
    ) -> None:
        if payload.user_id == self.bot.user.id:
            return
        if not payload.guild_id:
            return

        panel = await self._panel_for_message(payload.message_id)
        if not panel:
            return
        if int(panel["guild_id"]) != int(payload.guild_id):
            return

        emoji_key = _emoji_key(payload.emoji)
        if not emoji_key:
            return
        pair = self._find_pair(panel, emoji_key)
        if not pair:
            return

        member = await self._member(payload.guild_id, payload.user_id)
        if not member or member.bot:
            return

        await self._apply_add(panel=panel, member=member, pair=pair, payload=payload)

    @cog.listener()
    async def on_raw_reaction_remove(
        self, payload: disnake.RawReactionActionEvent
    ) -> None:
        if payload.user_id == self.bot.user.id:
            return
        if not payload.guild_id:
            return

        panel = await self._panel_for_message(payload.message_id)
        if not panel:
            return
        if int(panel["guild_id"]) != int(payload.guild_id):
            return

        emoji_key = _emoji_key(payload.emoji)
        if not emoji_key:
            return
        pair = self._find_pair(panel, emoji_key)
        if not pair:
            return

        member = await self._member(payload.guild_id, payload.user_id)
        if not member or member.bot:
            return

        await self._apply_remove(panel=panel, member=member, pair=pair)


def setup(bot: cog.KisaBot):
    bot.add_cog(ReactionRoles(bot))
