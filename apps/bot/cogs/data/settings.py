import json

import aiohttp
import cog


def _parse_color(val, default: int) -> int:
    if val in (None, ""):
        return default
    try:
        return int(val)
    except Exception:
        try:
            raw = str(val).strip().lstrip("#")
            return int(raw, 16)
        except Exception:
            return default


def _as_dict(value) -> dict | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


class Settings(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

    def _render_template(self, template: str, member: cog.Member, channel=None) -> str:
        guild = member.guild
        replacements = {
            "{{mention}}": member.mention,
            "{{user}}": member.display_name,
            "{{server}}": guild.name if guild else "",
            "{{count}}": str(guild.member_count or 0) if guild else "0",
            "{{channel}}": channel.mention if channel is not None else "",
        }
        out = template
        for key, value in replacements.items():
            out = out.replace(key, value)
        # Also support {mention}-style placeholders used by older configs.
        out = (
            out.replace("{mention}", member.mention)
            .replace("{user}", member.display_name)
            .replace("{server}", guild.name if guild else "")
            .replace("{count}", str(guild.member_count or 0) if guild else "0")
        )
        return out

    def _resolve_greeting(self, settings) -> dict | None:
        cfg = _as_dict(settings.greeting_config)
        if cfg is not None:
            if not cfg.get("enabled"):
                return None
            return cfg
        if not settings.join_channel:
            return None
        description = settings.greet_text or settings.custom_greet
        embeds = []
        if description or settings.greet_color or settings.greet_image:
            embeds.append(
                {
                    "title": None,
                    "description": description,
                    "color": settings.greet_color,
                    "imageUrl": settings.greet_image,
                }
            )
        return {
            "enabled": True,
            "channelId": str(settings.join_channel),
            "sender": "bot",
            "webhookUrl": None,
            "content": "",
            "embeds": embeds,
            "_legacy_default": not bool(description),
            "_kind": "join",
        }

    def _resolve_farewell(self, settings) -> dict | None:
        cfg = _as_dict(settings.farewell_config)
        if cfg is not None:
            if not cfg.get("enabled"):
                return None
            return cfg
        if not settings.leave_channel:
            return None
        description = settings.custom_fare or settings.fare_text
        embeds = []
        if description or settings.fare_color or settings.fare_image:
            embeds.append(
                {
                    "title": None,
                    "description": description,
                    "color": settings.fare_color,
                    "imageUrl": settings.fare_image,
                }
            )
        return {
            "enabled": True,
            "channelId": str(settings.leave_channel),
            "sender": "bot",
            "webhookUrl": None,
            "content": "",
            "embeds": embeds,
            "_legacy_default": not bool(description),
            "_kind": "leave",
        }

    def _build_embed(
        self,
        embed_cfg: dict,
        member: cog.Member,
        *,
        default_title: str,
        default_description: str,
        default_color: int,
        channel=None,
    ) -> cog.Embed:
        title = embed_cfg.get("title")
        description = embed_cfg.get("description")
        if title:
            title = self._render_template(str(title), member, channel)
        else:
            title = default_title
        if description:
            description = self._render_template(str(description), member, channel)
        else:
            description = default_description

        embed = cog.Embed(
            title=title,
            description=description,
            color=_parse_color(embed_cfg.get("color"), default_color),
            url=embed_cfg.get("url") or None,
        )

        author_name = embed_cfg.get("authorName")
        if author_name:
            embed.set_author(
                name=self._render_template(str(author_name), member, channel),
                icon_url=embed_cfg.get("authorIconUrl") or None,
                url=embed_cfg.get("authorUrl") or None,
            )

        footer_text = embed_cfg.get("footerText")
        if footer_text:
            embed.set_footer(
                text=self._render_template(str(footer_text), member, channel),
                icon_url=embed_cfg.get("footerIconUrl") or None,
            )

        thumbnail = embed_cfg.get("thumbnailUrl") or embed_cfg.get("thumbnail")
        if thumbnail:
            try:
                embed.set_thumbnail(url=thumbnail)
            except Exception:
                pass

        image = embed_cfg.get("imageUrl") or embed_cfg.get("image")
        if image:
            try:
                embed.set_image(url=image)
            except Exception:
                pass

        return embed

    async def _send_config_message(
        self,
        member: cog.Member,
        cfg: dict,
        *,
        kind: str,
    ) -> None:
        channel_id = cfg.get("channelId")
        if not channel_id:
            return

        try:
            channel = await member.guild.fetch_channel(int(channel_id))
        except Exception:
            try:
                await member.guild.owner.send(
                    embed=cog.Embed(
                        title="Ошибка настроек сервера",
                        description=(
                            "Ошибка с каналом отправки уведомлений о входе/выходе пользователей.\n"
                            "Проверьте мои права отправлять туда сообщения или переустановите/пересоздайте канал"
                        ),
                        color=0xEF5350,
                    )
                )
            except Exception:
                pass
            return

        if not channel:
            return

        default_title = (
            f"[ + ] {cog.utils.escape_markdown(member.display_name)}"
            if kind == "join"
            else f"[ - ] {cog.utils.escape_markdown(member.display_name)}"
        )
        default_description = (
            f"{member.mention} now with us!"
            if kind == "join"
            else f"{member.mention} вышел(а)!"
        )
        default_color = 0x82E868 if kind == "join" else 0xFD4C3C

        content_raw = cfg.get("content") or ""
        content = (
            self._render_template(str(content_raw), member, channel)
            if content_raw
            else ""
        )

        embeds_cfg = cfg.get("embeds") if isinstance(cfg.get("embeds"), list) else []
        embeds = []

        if cfg.get("_legacy_default") and not embeds_cfg:
            embeds.append(
                cog.Embed(
                    title=default_title,
                    description=default_description,
                    color=default_color,
                )
            )
        else:
            for embed_cfg in embeds_cfg[:10]:
                if not isinstance(embed_cfg, dict):
                    continue
                embeds.append(
                    self._build_embed(
                        embed_cfg,
                        member,
                        default_title=default_title,
                        default_description=default_description
                        if not embed_cfg.get("description")
                        else "",
                        default_color=default_color,
                        channel=channel,
                    )
                )

        # Keep a soft mention for join/leave when content is empty (Discord UX).
        if not content and kind in ("join", "leave"):
            content = f"||{member.mention}||"

        sender = cfg.get("sender") or "bot"
        webhook_url = cfg.get("webhookUrl")
        if sender == "webhook" and webhook_url:
            await self._send_webhook(
                webhook_url,
                content=content or None,
                embeds=embeds,
            )
            return

        kwargs = {}
        if content:
            kwargs["content"] = content
        if len(embeds) == 1:
            kwargs["embed"] = embeds[0]
        elif len(embeds) > 1:
            kwargs["embeds"] = embeds
        if not kwargs:
            return
        await channel.send(**kwargs)

    async def _send_webhook(self, url: str, *, content: str | None, embeds: list) -> None:
        payload = {}
        if content:
            payload["content"] = content
        if embeds:
            payload["embeds"] = [e.to_dict() for e in embeds]
        if not payload:
            return
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                if resp.status >= 400:
                    body = await resp.text()
                    raise RuntimeError(f"webhook {resp.status}: {body[:200]}")

    @cog.listener()
    async def on_member_join(self, member: cog.Member):
        if not member.guild or member.bot:
            return

        serversettings = await self.bot.database.readServerSettings(member.guild.id)
        if not serversettings:
            return
        serversettings = serversettings[0]

        if serversettings.auto_role:
            try:
                r = member.guild.get_role(int(serversettings.auto_role))
                if r:
                    await member.add_roles(r)
            except Exception:
                pass

        cfg = self._resolve_greeting(serversettings)
        if not cfg:
            return

        try:
            await self._send_config_message(member, cfg, kind="join")
        except Exception:
            try:
                await member.guild.owner.send(
                    embed=cog.Embed(
                        title="Ошибка настроек сервера",
                        description=(
                            "Ошибка с каналом отправки уведомлений о входе пользователей.\n"
                            "Проверьте мои права отправлять туда сообщения или переустановите/пересоздайте канал"
                        ),
                        color=0xEF5350,
                    )
                )
            except Exception:
                pass

    @cog.listener()
    async def on_member_remove(self, member: cog.Member):
        if not member.guild or member.bot:
            return

        sslist = await self.bot.database.readServerSettings(member.guild.id)
        if not sslist:
            return

        cfg = self._resolve_farewell(sslist[0])
        if not cfg:
            return

        try:
            await self._send_config_message(member, cfg, kind="leave")
        except Exception:
            try:
                await member.guild.owner.send(
                    embed=cog.Embed(
                        title="Ошибка настроек сервера",
                        description=(
                            "Ошибка с каналом отправки уведомлений о выходе пользователей.\n"
                            "Проверьте мои права отправлять туда сообщения или переустановите/пересоздайте канал"
                        ),
                        color=0xEF5350,
                    )
                )
            except Exception:
                pass


def setup(bot: cog.KisaBot):
    bot.add_cog(Settings(bot))
    bot.cog_reload(__name__)
