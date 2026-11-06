import random

import cog
from utils import config

RATING_FIELD_ID = "feedback_rating"
COMMENT_FIELD_ID = "feedback_comment"


class MyModal(cog.ui.Modal):
    def __init__(self, inter: cog.ApplicationCommandInteraction, bot: cog.KisaBot):
        self.bot = bot

        suggestions = [
            (
                bot.translate(inter, "feedback.modal.rating.placeholder.positive"),
                (7, 10),
            ),
            (
                bot.translate(inter, "feedback.modal.rating.placeholder.neutral"),
                (4, 6),
            ),
            (
                bot.translate(inter, "feedback.modal.rating.placeholder.negative"),
                (0, 10),
            ),
        ]
        comment_placeholder, rating_range = random.choice(suggestions)
        ratings = f"{random.randint(*rating_range)}\u005c10"

        components = [
            cog.ui.TextInput(
                label=bot.translate(inter, "feedback.modal.rating.label"),
                placeholder=ratings,
                custom_id=RATING_FIELD_ID,
                style=cog.TextInputStyle.short,
                max_length=5,
            ),
            cog.ui.TextInput(
                label=bot.translate(inter, "feedback.modal.comment.label"),
                placeholder=comment_placeholder,
                custom_id=COMMENT_FIELD_ID,
                required=False,
                style=cog.TextInputStyle.paragraph,
            ),
        ]
        super().__init__(
            title=bot.translate(inter, "feedback.modal.title"),
            components=components,
            custom_id="bot_feedback",
        )


class Feedback(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

    @cog.listener()
    async def on_modal_submit(self, inter: cog.ModalInteraction):
        if inter.custom_id != "bot_feedback":
            return
        if not config.feedback_channel_id:
            await inter.response.send_message(
                self.bot.translate(inter, "feedback.error.not_configured"),
                ephemeral=True,
            )
            return

        field_names = {
            RATING_FIELD_ID: self.bot.translate(inter, "feedback.embed.field.rating"),
            COMMENT_FIELD_ID: self.bot.translate(inter, "feedback.embed.field.comment"),
        }

        embed = cog.Embed(
            title=self.bot.translate(inter, "feedback.embed.title"),
            description=self.bot.translate(
                inter, "feedback.embed.author_id", id=inter.author.id
            ),
        )
        embed.set_author(
            name=f"{inter.author.global_name} | {inter.author.name} | {inter.author.display_name}",
            icon_url=inter.author.display_avatar.url,
        )
        for key, value in inter.text_values.items():
            if value[:1024] != "":
                embed.add_field(
                    name=field_names.get(key, key),
                    value=value[:1024],
                    inline=False,
                )

        sender_channel = self.bot.get_channel(config.feedback_channel_id)
        if not sender_channel:
            await inter.response.send_message(
                self.bot.translate(inter, "feedback.error.channel_not_found"),
                ephemeral=True,
            )
            return

        content = (
            f"<@{config.feedback_ping_user_id}>"
            if config.feedback_ping_user_id
            else None
        )
        await sender_channel.send(content=content, embed=embed)
        await inter.response.send_message(
            self.bot.translate(inter, "feedback.response.success"),
            ephemeral=True,
        )

    @cog.slash_command(
        name="feedback",
        description=cog.Localised(
            "Submit feedback about the bot", key="feedback.command.description"
        ),
    )
    async def feedback_cmd(self, inter: cog.ApplicationCommandInteraction):
        await inter.response.send_modal(MyModal(inter, self.bot))


def setup(bot):
    bot.add_cog(Feedback(bot))
    bot.cog_reload(__name__)
