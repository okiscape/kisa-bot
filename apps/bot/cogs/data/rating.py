from disnake.ext.commands import BucketType, cooldown

import cog
from utils import config


class Rating(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

    @cog.slash_command(
        name="rating",
        description=cog.Localised("Social rating", key="rating.command.description"),
    )
    async def rating(self, inter: cog.ApplicationCommandInteraction):
        pass

    @rating.sub_command(
        name="view",
        description=cog.Localised(
            "View your own or another member's rating",
            key="rating.view.description",
        ),
    )
    async def view(
        self,
        inter: cog.ApplicationCommandInteraction,
        view: cog.Member = cog.Param(
            description=cog.Localised(
                "Member whose rating to view",
                key="rating.view.option.member.description",
            )
        ),
    ):
        await inter.response.defer(ephemeral=True)

        if view.bot:
            await inter.edit_original_response(
                self.bot.translate(inter, "rating.error.bot_view")
            )
            return

        ratings = await self.bot.database.readSocialRating(user_id=view.id)
        if not ratings:
            await self.bot.database.createSocialRating(view.id, 0)

            ratings = await self.bot.database.readSocialRating(
                user_id=view.id, cacheOverwrite=True
            )

        ratingRecord = ratings[0]

        color = 0x1ED860 if ratingRecord.rating > 0 else 0xDF4E4E
        embed = cog.Embed(
            title=self.bot.translate(
                inter, "rating.view.title", name=view.display_name
            ),
            description=f"## {ratingRecord.rating}",
            color=color,
        ).set_thumbnail(url=view.display_avatar.url)
        await inter.edit_original_response(embed=embed)

    @cooldown(1, 43200, BucketType.user)
    @rating.sub_command(
        name="add",
        description=cog.Localised(
            "Increase someone's rating", key="rating.add.description"
        ),
    )
    async def add(
        self,
        inter: cog.ApplicationCommandInteraction,
        view: cog.Member = cog.Param(
            description=cog.Localised(
                "Member whose rating to increase",
                key="rating.add.option.member.description",
            )
        ),
    ):
        await inter.response.defer(ephemeral=True)
        if view == inter.author:
            await inter.edit_original_response(
                self.bot.translate(inter, "rating.error.self_edit")
            )
            return
        if view.bot:
            await inter.edit_original_response(
                self.bot.translate(inter, "rating.error.bot_edit")
            )
            return

        ratings = await self.bot.database.readSocialRating(user_id=view.id)
        if not ratings:
            await self.bot.database.createSocialRating(view.id, 0)

            ratings = await self.bot.database.readSocialRating(
                user_id=view.id, cacheOverwrite=True
            )
        ratingRecord = ratings[0]

        newRating = ratingRecord.rating + 1

        await self.bot.database.updateSocialRating(user_id=view.id, to_rating=newRating)

        color = 0x1ED860 if newRating > 0 else 0xDF4E4E
        embed = cog.Embed(
            title=self.bot.translate(
                inter, "rating.add.title", name=view.display_name
            ),
            description=f"## {ratingRecord.rating} => {newRating}",
            color=color,
        ).set_thumbnail(url=view.display_avatar.url)
        await inter.edit_original_response(embed=embed)

    @cooldown(1, 43200, BucketType.user)
    @rating.sub_command(
        name="remove",
        description=cog.Localised(
            "Decrease someone's rating", key="rating.remove.description"
        ),
    )
    async def remove(
        self,
        inter: cog.ApplicationCommandInteraction,
        view: cog.Member = cog.Param(
            description=cog.Localised(
                "Member whose rating to decrease",
                key="rating.remove.option.member.description",
            )
        ),
    ):
        await inter.response.defer(ephemeral=True)

        blocked = {config.bot_owner_id} if config.bot_owner_id is not None else set()
        if view == inter.author:
            await inter.edit_original_response(
                self.bot.translate(inter, "rating.error.self_edit")
            )
            return
        if inter.author.id in blocked:
            await inter.edit_original_response(
                self.bot.translate(inter, "rating.error.forbidden")
            )
            return
        if view.bot:
            await inter.edit_original_response(
                self.bot.translate(inter, "rating.error.bot_edit")
            )
            return

        ratings = await self.bot.database.readSocialRating(user_id=view.id)
        if not ratings:
            await self.bot.database.createSocialRating(view.id, 0)

            ratings = await self.bot.database.readSocialRating(
                user_id=view.id, cacheOverwrite=True
            )
        ratingRecord = ratings[0]
        newRating = ratingRecord.rating - 1

        await self.bot.database.updateSocialRating(user_id=view.id, to_rating=newRating)

        color = 0x1ED860 if newRating > 0 else 0xDF4E4E
        embed = cog.Embed(
            title=self.bot.translate(
                inter, "rating.remove.title", name=view.display_name
            ),
            description=f"## {ratingRecord.rating} => {newRating}",
            color=color,
        ).set_thumbnail(url=view.display_avatar.url)

        await inter.edit_original_response(embed=embed)


def setup(bot: cog.KisaBot):
    bot.add_cog(Rating(bot))
    bot.cog_reload(__name__)
