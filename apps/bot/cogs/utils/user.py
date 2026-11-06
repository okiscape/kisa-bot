import disnake

import cog


class SelfDeleteButton(cog.View):
    def __init__(self, bot: cog.KisaBot):
        super().__init__(timeout=None)
        self.bot = bot

    @disnake.ui.button(
        emoji="<:IconDeleteTrashcan:750152850310561853>",
        style=disnake.ButtonStyle.secondary,
    )
    async def selfdeletesbutton(self, _, inter: disnake.MessageInteraction):
        await inter.message.delete()


class User(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

    async def _user_info(
        self, inter: cog.ApplicationCommandInteraction, member: cog.Member
    ):
        profile_fetch = await self.bot.database.readUserProfiles(member.id)
        profile = profile_fetch[0] if profile_fetch else None

        custom_color = self.bot.config.colors.blurple

        if profile and getattr(profile, "color", None):
            custom_color = int(profile.color, 16)

        userrating = await self.bot.database.readSocialRating(user_id=member.id)
        rating_str = (
            self.bot.translate(inter, "social_rating", rating=userrating[0].rating)
            if userrating
            else ""
        )

        times_c = int(member.created_at.timestamp())
        times_j = None
        try:
            times_j = int(member.joined_at.timestamp())
        except:
            pass

        status_map = {
            "offline": (
                self.bot.translate(inter, "common.status.offline"),
            ),
            "idle": (
                self.bot.translate(inter, "common.status.idle"),
            ),
            "dnd": (
                self.bot.translate(inter, "common.status.dnd"),
            )
        }

        if (
            member.activity
            and member.activity.type == disnake.ActivityType.custom
            and getattr(member.activity, "name", None)
        ):
            status_text = f"{cog.sh.rmark(member.activity.name)}"
        else:
            status_text = ""

        devices = []
        client_status = getattr(member, "_client_status", {}) or {}
        if "desktop" in client_status:
            devices.append(self.bot.translate(inter, "common.device.desktop"))
        if "web" in client_status:
            devices.append(self.bot.translate(inter, "common.device.web"))
        if "mobile" in client_status:
            devices.append(self.bot.translate(inter, "common.device.mobile"))
        if "vr" in client_status:
            devices.append(self.bot.translate(inter, "common.device.vr"))
        devices = ", ".join(devices) if devices else None

        media_links = []

        fetched_user = await self.bot.fetch_user(member.id)
        if fetched_user.banner:
            media_links.append(
                self.bot.translate(
                    inter,
                    "user.response.fields.profile_files.global_banner",
                    banner=fetched_user.banner.url,
                )
            )
        if member.guild_banner:
            media_links.append(
                self.bot.translate(
                    inter,
                    "user.response.fields.profile_files.guild_banner",
                    banner=member.guild_banner.url,
                )
            )
        if member.avatar:
            media_links.append(
                self.bot.translate(
                    inter,
                    "user.response.fields.profile_files.global_avatar",
                    avatar=member.avatar.url,
                )
            )
        if member.guild_avatar:
            media_links.append(
                self.bot.translate(
                    inter,
                    "user.response.fields.profile_files.guild_avatar",
                    avatar=member.guild_avatar.url,
                )
            )

        description = self.bot.translate(inter,
            "user.response.description",
            user_id=member.id,
            display_name=(
                "\n" + self.bot.translate(inter, 
                    "user.response.description.display_name",
                    display_name=member.display_name
                ) if member.display_name else ""
            ),
            global_name=member.global_name if 
                not member.bot else f"{member.name}#{member.tag}",
            username=f"({member.name})" if not member.bot else "",
            status_type=member.status.value, status_value=status_text,

            devices="\n" + self.bot.translate(inter, "user.response.description.status_from", devices=devices) if devices else ""
        )

        badges = []
        public_flag_names = set()

        if member.bot: badges.append(self.bot.translate(inter, "common.bot"))

        for name, enabled in member.public_flags:
            if enabled:
                public_flag_names.add(name)
                badges.append(
                    self.bot.translate(inter, f"common.user_flags.public.{name}")
                )

        for name, enabled in getattr(member, "flags", None) or ():
            if enabled and name not in public_flag_names:
                badges.append(
                    self.bot.translate(inter, f"common.user_flags.member.{name}")
                )

        if (
            member.avatar != fetched_user.avatar
            or member.banner or member.guild_banner or fetched_user.banner
            or member.premium_since
        ):
            badges.append(
                self.bot.translate(
                    inter,
                    "common.user_flags.public.nitro"
                )
            )

        field_timestamps = self.bot.translate(inter,
            "user.response.fields.timestamps.value",
            joined_at_ts=times_j,
            created_at_ts=times_c
        )

        usersettings = await self.bot.database.readUserSettings(member.id)
        if usersettings:
            userset = usersettings[0]
            if userset.timezone:
                zone_code = userset.timezone
                if userset.timezone != "UTC":
                    zone_code = int(userset.timezone.replace("UTC", ""))
                else:
                    zone_code = 0
                timezone = await cog.sh.get_time_in_timezone(zone_code)
                field_timestamps += self.bot.translate(
                    inter,
                    "user.response.fields.timestamps.value.usertz",
                    tz=userset.timezone,
                    time=timezone.strftime(format="%H:%M:%S %d/%m/%Y"),
                )

        embed_fields = [
            cog.EmbedField(
                name=self.bot.translate(inter, "user.response.fields.timestamps.name"),
                value=field_timestamps,
                inline=False
            ),
        ]

        embed_fields.append(
            cog.EmbedField(
                name=self.bot.translate(inter, "user.response.fields.profile_files.name"),
                value="\n".join(media_links),
                inline=True
            )
        )

        if badges:
            embed_fields.append(
                cog.EmbedField(
                    name=self.bot.translate(inter, "user.response.fields.flags.name"),
                    value="\n".join(f"{badge}" for badge in badges),
                    inline=True
                )
            )

        embed = cog.Embed(
            title=self.bot.translate(
                inter, "user.response.title", name=member.display_name
            ),
            color=custom_color,
            description=description,
            thumbnail=member.display_avatar,
            image=member.guild_banner or fetched_user.banner,
            fields=embed_fields
        )

        membership = None
        if profile and (profile.about_me or profile.custom_image):
            membership = cog.Embed(
                color=custom_color,
                image=getattr(profile, "custom_image", None),
                description=getattr(profile, "about_me", None),
            )

        embeds = [embed]
        if membership:
            embeds.append(membership)

        spotify_embed = None
        for activity in member.activities:
            if isinstance(activity, disnake.Spotify):
                spotify_pl = cog.sh.build_spotify_placeholders(activity)
                desc = cog.sh.replace_placeholders(
                    f"{self.bot.translate(inter, 'user.response.spotify.artist')}\n"
                    f"{self.bot.translate(inter, 'user.response.spotify.album')}",
                    spotify_pl,
                )
                spotify_embed = cog.Embed(
                    color=self.bot.config.colors.spotify_main
                    if not custom_color
                    else custom_color,
                    title=cog.sh.replace_placeholders(
                        f"{self.bot.custom_emojis.spotify_logo} {{spotify.title}}",
                        spotify_pl,
                    ),
                    url=activity.track_url,
                    description=desc,
                    thumbnail=activity.album_cover_url,
                    author=cog.EmbedAuthor(
                        name=self.bot.translate(
                            inter,
                            "user.response.spotify.author",
                            name=member.display_name or member.name,
                        ),
                        icon_url=member.avatar.url,
                    ),
                )
                break

        if spotify_embed:
            embeds.append(spotify_embed)

        await inter.edit_original_response(embeds=embeds, components=[])

    @cog.guild_only()
    @cog.slash_command(
        name="user", description=disnake.Localized(key="user.slash.description")
    )
    async def slash_user(
        self,
        inter: disnake.ApplicationCommandInteraction,
        member: disnake.Member = cog.Param(
            description=disnake.Localized(key="user.slash.option.member.description"),
            default=lambda i: i.author,
        ),
    ):
        await inter.response.defer()
        await self._user_info(inter, member)

    @cog.guild_only()
    @cog.user_command(name=disnake.Localized(key="user.usercommand.name"))
    async def user(
        self, inter: disnake.ApplicationCommandInteraction, member: disnake.Member
    ):
        await inter.response.defer()
        await self._user_info(inter, member)


def setup(bot):
    bot.add_cog(User(bot))
    bot.cog_reload(__name__)
