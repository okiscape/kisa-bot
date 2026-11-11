import cog

def _parse_color(val, default: int) -> int:
    if val in (None, ""):
        return default
    try:
        return int(val)
    except Exception:
        try:
            return int(str(val).strip(), 16)
        except Exception:
            return default

class Settings(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

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

        if not serversettings.join_channel:
            return

        try:
            channel = await member.guild.fetch_channel(int(serversettings.join_channel))
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
            return

        if not channel:
            return

        if not serversettings.greet_text:
            embed = cog.Embed(
                title=f"[ + ] {cog.utils.escape_markdown(member.display_name)}",
                description=f"{member.mention} now with us!",
                color=0x82E868,
            )
            if serversettings.greet_image:
                try:
                    embed.set_image(url=serversettings.greet_image)
                except Exception:
                    pass
            await channel.send(content=f"||{member.mention}||", embed=embed)
            return

        try:
            done = await self._render_template(serversettings.greet_text, member)
            color = _parse_color(serversettings.greet_color, 0x82E868)
            embed = cog.Embed(
                title=f"[ + ] {cog.utils.escape_markdown(member.display_name)}",
                description=done,
                color=color,
            )
            if serversettings.greet_image:
                try:
                    embed.set_image(url=serversettings.greet_image)
                except Exception:
                    pass
            await channel.send(content=f"||{member.mention}||", embed=embed)
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

        s = sslist[0]
        leave_channel_id = s.leave_channel
        custom_fare = s.custom_fare
        fare_color = s.fare_color
        fare_image = s.fare_image
        if not leave_channel_id:
            return

        try:
            channel = await member.guild.fetch_channel(int(leave_channel_id))
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
            return
        if not channel:
            return

        if not custom_fare:
            embed = cog.Embed(
                title=f"[ - ] {cog.utils.escape_markdown(member.display_name)}",
                description=f"{member.mention} вышел(а)!",
                color=0xFD4C3C,
            )
            if fare_image:
                try:
                    embed.set_image(url=fare_image)
                except Exception:
                    pass
            await channel.send(content=f"||{member.mention}||", embed=embed)
            return

        try:
            done = await self._render_template(custom_fare, member)
            color = _parse_color(fare_color, 0xFD4C3C)
            embed = cog.Embed(
                title=f"[ - ] {cog.utils.escape_markdown(member.display_name)}",
                description=done,
                color=color,
            )
            if fare_image:
                try:
                    embed.set_image(url=fare_image)
                except Exception:
                    pass
            await channel.send(embed=embed)
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


def setup(bot: cog.KisaBot):
    bot.add_cog(Settings(bot))
    bot.cog_reload(__name__)
