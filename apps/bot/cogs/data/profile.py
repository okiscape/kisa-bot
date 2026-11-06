import re

import cog
from utils.types import UserProfileRecord

timezoneslist = [
    "UTC-12",
    "UTC-11",
    "UTC-10",
    "UTC-9",
    "UTC-8",
    "UTC-7",
    "UTC-6",
    "UTC-5",
    "UTC-4",
    "UTC-3",
    "UTC-2",
    "UTC-1",
    "UTC",
    "UTC+1",
    "UTC+2",
    "UTC+3",
    "UTC+4",
    "UTC+5",
    "UTC+6",
    "UTC+7",
    "UTC+8",
    "UTC+9",
    "UTC+10",
    "UTC+11",
    "UTC+12",
]

DEFAULT_PROFILE_COLOR = 0x262746
_HEX_COLOR_PATTERN = re.compile(r"^[0-9a-fA-F]{6}$")

# (text input id, profile column, removed translation, updated translation)
PROFILE_FIELDS = (
    ("hexcolor", "color", "color_removed", "color_changed"),
    ("about", "about_me", "about_removed", "about_updated"),
    ("custom_image", "custom_image", "image_removed", "image_updated"),
)


def parse_profile_color(value: str | None) -> int | None:
    """Convert a stored/entered HEX color to int, returning None if it's invalid."""
    if not value:
        return None
    value = value.strip().removeprefix("#")
    if not _HEX_COLOR_PATTERN.fullmatch(value):
        return None
    return int(value, 16)


class SettingModal(cog.ui.Modal):
    def __init__(
        self,
        bot: cog.KisaBot,
        inter: cog.ApplicationCommandInteraction,
        default_profile: list[UserProfileRecord],
    ):
        self.bot = bot
        self._profile = default_profile[0] if default_profile else None
        self._profile_color = self._profile.color if self._profile else None
        self._profile_about = self._profile.about_me if self._profile else None
        self._profile_image = self._profile.custom_image if self._profile else None

        comp = [
            cog.ui.TextInput(
                label=self.bot.translate(inter, "profile.edit_modal.color.title"),
                placeholder=self.bot.translate(
                    inter, "profile.edit_modal.color.placeholder"
                ),
                required=False,
                value=self._profile_color,
                max_length=6,
                custom_id="hexcolor",
            ),
            cog.ui.TextInput(
                label=self.bot.translate(inter, "profile.edit_modal.about_me.title"),
                placeholder=self.bot.translate(
                    inter, "profile.edit_modal.about_me.placeholder"
                ),
                required=False,
                value=self._profile_about,
                style=cog.TextInputStyle.paragraph,
                custom_id="about",
            ),
            cog.ui.TextInput(
                label=self.bot.translate(inter, "profile.edit_modal.image.title"),
                placeholder=self.bot.translate(
                    inter, "profile.edit_modal.image.placeholder"
                ),
                required=False,
                value=self._profile_image,
                style=cog.TextInputStyle.short,
                max_length=200,
                custom_id="custom_image",
            ),
        ]
        super().__init__(
            title=self.bot.translate(inter, "profile.edit_modal.title"), components=comp
        )

    async def callback(self, inter: cog.ModalInteraction):
        call = inter.text_values
        updates: dict[str, str | None] = {}
        done: list[str] = []

        # HEX color is the only field that needs validation before saving.
        color = call["hexcolor"].strip().removeprefix("#")

        if color and parse_profile_color(color) is None:
            return await inter.response.send_message(
                self.bot.translate(inter, "profile.edit_modal.res.invalid_color"),
                ephemeral=True,
            )

        call["hexcolor"] = color

        for field, column, removed_key, updated_key in PROFILE_FIELDS:
            value = call[field]
            current = getattr(self._profile, column, None)

            if value == "":
                if current is None:
                    continue
                updates[column] = None
                done.append(
                    self.bot.translate(inter, f"profile.edit_modal.res.{removed_key}")
                )
            elif value != current:
                updates[column] = value
                done.append(
                    self.bot.translate(
                        inter,
                        f"profile.edit_modal.res.{updated_key}",
                        color=value,
                    )
                )

        if not updates:
            return await inter.response.send_message(
                self.bot.translate(inter, "profile.edit_modal.res.no_changes"),
                ephemeral=True,
            )

        if self._profile is None:
            await self.bot.database.createUserProfile(
                user_id=inter.author.id, **updates
            )
        else:
            await self.bot.database.updateUserProfile(
                user_id=inter.author.id, **updates
            )

        # The modal already knows the previous state, so only one read is needed:
        # it returns the saved record and refreshes the cache.
        profile = await self.bot.database.readUserProfiles(
            user_id=inter.author.id, cacheOverwrite=True
        )
        if not profile:
            return await inter.response.send_message(
                self.bot.translate(inter, "profile.edit_modal.res.unknown_error")
            )

        profile = profile[0]
        display_color = parse_profile_color(profile.color)
        if display_color is None:
            display_color = DEFAULT_PROFILE_COLOR

        channel = self.bot.get_channel(self.bot.config.profile_edits_log_channel)
        membership = cog.Embed(color=display_color, description=profile.about_me)
        if profile.custom_image and profile.custom_image.startswith("http"):
            membership.set_image(profile.custom_image)

        await channel.send(
            content=self.bot.translate(
                inter, "profile.edit_modal.res.log_message", user_id=inter.author.id
            ),
            embed=membership,
        )
        await inter.response.send_message(
            self.bot.translate(
                inter, "profile.edit_modal.res.final_updates", updates="\n".join(done)
            ),
            ephemeral=True,
        )


class Main(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

    @cog.slash_command(name="profile")
    async def profile(self, inter: cog.ApplicationCommandInteraction):
        pass

    @profile.sub_command(
        name="timezone",
        description=cog.Localized(key="profile.timezone.slash.description"),
    )
    async def timezone(
        self,
        inter: cog.ApplicationCommandInteraction,
        zone: str = cog.Param(
            description=cog.Localized(key="profile.timezone.option.zone.description"),
            autocomplete=cog.sh.generate_pick(timezoneslist),
        ),
    ):
        if zone not in timezoneslist:
            return await inter.response.send_message(
                self.bot.translate(inter, "profile.timezone.error.invalid_timezone")
            )
        try:
            zone_code = int(zone.replace("UTC", "") or 0)
        except:
            zone_code = 0

        timezone_obj = await cog.sh.get_time_in_timezone(zone_code)

        usersettings = await self.bot.database.readUserSettings(
            inter.author.id, cacheOverwrite=True
        )
        if usersettings:
            await self.bot.database.updateUserSettings(
                user_id=inter.author.id, timezone=zone
            )
        else:
            await self.bot.database.createUserSettings(
                user_id=inter.author.id, timezone=zone
            )

        await inter.response.send_message(
            self.bot.translate(
                inter,
                "timezone_set",
                zone=zone,
                time=timezone_obj.strftime("%d/%m/%Y, %H:%M:%S"),
            )
        )

    @profile.sub_command(
        name="preview",
        description=cog.Localized(key="profile.preview.slash.description"),
    )
    async def control(self, inter: cog.ApplicationCommandInteraction):
        await inter.response.defer(ephemeral=True)
        profile = await self.bot.database.readUserProfiles(inter.author.id)

        edit_buttons = [
            cog.ui.Button(
                label=self.bot.translate(
                    inter, "profile.preview.resp.edit_profile_button"
                ),
                style=cog.ButtonStyle.secondary,
                custom_id="membership_edit_profile",
            )
        ]
        if not profile:
            return await inter.edit_original_response(
                content=self.bot.translate(inter, "profile.preview.resp.content.empty"),
                components=edit_buttons,
            )

        profile = profile[0]

        embed_color = parse_profile_color(profile.color)
        if embed_color is None:
            embed_color = DEFAULT_PROFILE_COLOR

        embed = cog.Embed(
            description=profile.about_me,
            color=embed_color,
            image=profile.custom_image,
        )
        await inter.edit_original_response(
            content=self.bot.translate(inter, "profile.preview.resp.content"),
            embed=embed,
            components=edit_buttons,
        )

    @cog.listener(name="on_button_click")
    async def check(self, inter: cog.MessageInteraction):
        if inter.component.custom_id == "membership_edit_profile":
            profile = await self.bot.database.readUserProfiles(inter.author.id)
            await inter.response.send_modal(SettingModal(self.bot, inter, profile))


def setup(bot):
    bot.add_cog(Main(bot))
    bot.cog_reload(__name__)
