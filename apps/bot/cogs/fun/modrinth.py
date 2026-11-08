import datetime
import random

import aiohttp
import cog

PROJECT_TYPES = ("modpack", "resourcepack", "shader", "mod", "user")


async def _type_autocomplete(
    inter: cog.ApplicationCommandInteraction, string: str
) -> list[str]:
    query = string.lower()
    choices = []
    for project_type in PROJECT_TYPES:
        label = inter.bot.translate(
            inter, f"modrinth.option.type.choices.{project_type}"
        )
        if query in label.lower():
            choices.append(label)
    return choices


class Modrinth(cog.Cog):
    def __init__(self, bot: cog.KisaBot):
        self.bot = bot

    def _project_type(
        self, inter: cog.ApplicationCommandInteraction, value: str
    ) -> str | None:
        for project_type in PROJECT_TYPES:
            label = self.bot.translate(
                inter, f"modrinth.option.type.choices.{project_type}"
            )
            if value == label:
                return project_type
        return None

    def _side_label(self, inter: cog.ApplicationCommandInteraction, value: str) -> str:
        return self.bot.translate(inter, f"modrinth.side.{value}")

    @cog.slash_command(
        name="modrinth",
        description=cog.Localised(
            "Search for mods, shaders, resource packs, modpacks, and users on Modrinth",
            key="modrinth.command.description",
        ),
    )
    async def project(
        self,
        inter: cog.ApplicationCommandInteraction,
        data_type: str = cog.Param(
            description=cog.Localised(
                "Select the type of information to search for",
                key="modrinth.option.type.description",
            ),
            autocomplete=_type_autocomplete,
        ),
        query: str = cog.Param(
            description=cog.Localised(
                "Search query", key="modrinth.option.query.description"
            )
        ),
    ):

        await inter.response.defer(ephemeral=True)

        project_type = self._project_type(inter, data_type)
        if project_type is None:
            await inter.edit_original_response(
                self.bot.translate(inter, "modrinth.error.invalid_type")
            )
            return

        if project_type == "modpack":
            uri = f'search?query="{query}"&limit=1&facets=[["project_type:modpack"]]'

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url=f"https://api.modrinth.com/v2/{uri}"
                ) as response:
                    modget = await response.json()
                await session.close()

            if modget["hits"] == []:
                await inter.edit_original_response(
                    content=self.bot.translate(inter, "modrinth.error.not_found")
                )

            else:
                first = modget["hits"][0]

                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url=f"https://api.modrinth.com/v2/user/{first['author']}"
                    ) as response:
                        author = await response.json()
                    await session.close()

                category: str = ", ".join(first["categories"]).title()

                mod = cog.Embed(
                    title=first["title"],
                    url=f"https://modrinth.com/modpack/{first['slug']}",
                    color=0x82E868,
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.information"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.author.modpack",
                        author=first["author"],
                        url=f"https://modrinth.com/user/{author['username']}",
                        license=first["license"],
                    ),
                )

                try:
                    mod.add_field(
                        name=self.bot.translate(inter, "modrinth.field.categories"),
                        value=f"```{category}```",
                        inline=False,
                    )
                except:
                    pass

                try:
                    mod.add_field(
                        name=self.bot.translate(inter, "modrinth.field.description"),
                        value=first["description"],
                        inline=False,
                    )
                except:
                    pass

                cdate = datetime.datetime.fromisoformat(first["date_created"])
                udate = datetime.datetime.fromisoformat(first["date_modified"])

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.dates"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.dates.modpack",
                        created=cog.utils.format_dt(cdate, "f"),
                        updated=cog.utils.format_dt(udate, "f"),
                    ),
                    inline=False,
                )

                mod.add_field(
                    name=self.bot.translate(
                        inter,
                        "modrinth.latest_version.modpack",
                        version=first["latest_version"],
                    ),
                    value="|",
                    inline=False,
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.statistics"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.statistics",
                        downloads=first["downloads"],
                        follows=first["follows"],
                    ),
                    inline=True,
                )

                mod.set_thumbnail(url=first["icon_url"])

                button = [
                    cog.ui.Button(
                        label=self.bot.translate(inter, "modrinth.button.modpack"),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/modpack/{first['slug']}",
                    ),
                    cog.ui.Button(
                        label=self.bot.translate(inter, "modrinth.button.author"),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/user/{author['username']}",
                        row=1,
                    ),
                ]

                if first["featured_gallery"] != None:
                    featured_gallery = cog.Embed(color=0x82E868)
                    featured_gallery.set_image(url=first["featured_gallery"])

                else:
                    featured_gallery = cog.Embed(color=0x82E868)
                    featured_gallery.set_image(url=random.choice(first["gallery"]))
                try:
                    await inter.edit_original_response(
                        embeds=[mod, featured_gallery], components=button
                    )
                except:
                    await inter.edit_original_response(embed=mod, components=button)

        elif project_type == "resourcepack":
            uri = (
                f'search?query="{query}"&limit=1&facets=[["project_type:resourcepack"]]'
            )

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url=f"https://api.modrinth.com/v2/{uri}"
                ) as response:
                    modget = await response.json()
                await session.close()

            if modget["hits"] == []:
                await inter.edit_original_response(
                    content=self.bot.translate(inter, "modrinth.error.not_found")
                )

            else:
                first = modget["hits"][0]

                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url=f"https://api.modrinth.com/v2/user/{first['author']}"
                    ) as response:
                        author = await response.json()
                    await session.close()

                category: str = ", ".join(first["categories"]).title()

                mod = cog.Embed(
                    title=first["title"],
                    url=f"https://modrinth.com/resourcepack/{first['slug']}",
                    color=0x82E868,
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.information"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.author.resourcepack",
                        author=first["author"],
                        url=f"https://modrinth.com/user/{author['username']}",
                        license=first["license"],
                    ),
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.categories"),
                    value=f"```{category}```",
                    inline=False,
                )

                try:
                    mod.add_field(
                        name=self.bot.translate(inter, "modrinth.field.description"),
                        value=first["description"],
                        inline=False,
                    )
                except:
                    pass

                cdate = datetime.datetime.fromisoformat(first["date_created"])
                udate = datetime.datetime.fromisoformat(first["date_modified"])
                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.dates"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.dates.resourcepack",
                        created=cog.utils.format_dt(cdate, "f"),
                        updated=cog.utils.format_dt(udate, "f"),
                    ),
                    inline=False,
                )

                mod.add_field(
                    name=self.bot.translate(
                        inter,
                        "modrinth.latest_version.resourcepack",
                        version=first["latest_version"],
                    ),
                    value="|",
                    inline=False,
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.statistics"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.statistics",
                        downloads=first["downloads"],
                        follows=first["follows"],
                    ),
                    inline=True,
                )

                mod.set_thumbnail(url=first["icon_url"])

                button = [
                    cog.ui.Button(
                        label=self.bot.translate(
                            inter, "modrinth.button.resourcepack"
                        ),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/resourcepack/{first['slug']}",
                        row=1,
                    ),
                    cog.ui.Button(
                        label=self.bot.translate(inter, "modrinth.button.author"),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/user/{author['username']}",
                        row=1,
                    ),
                ]

                color = 0x82E868
                jcolor = None
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url=f"https://api.modrinth.com/v2/project/{first['slug']}"
                    ) as response:
                        jcolor = await response.json()
                        jcolor = jcolor["color"]
                    await session.close()

                if jcolor != None:
                    color = jcolor

                if first["featured_gallery"] != None:
                    featured_gallery = cog.Embed(color=color)
                    featured_gallery.set_image(url=first["featured_gallery"])
                else:
                    featured_gallery = cog.Embed(color=color)
                    featured_gallery.set_image(url=random.choice(first["gallery"]))
                try:
                    await inter.edit_original_response(
                        embeds=[mod, featured_gallery], components=button
                    )
                except:
                    await inter.edit_original_response(embed=mod, components=button)

        elif project_type == "shader":
            uri = f'search?query="{query}"&limit=1&facets=[["project_type:shader"]]'

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url=f"https://api.modrinth.com/v2/{uri}"
                ) as response:
                    modget = await response.json()
                await session.close()

            if modget["hits"] == []:
                await inter.edit_original_response(
                    content=self.bot.translate(inter, "modrinth.error.not_found")
                )

            else:
                first = modget["hits"][0]

                category: str = ", ".join(first["categories"]).title()

                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url=f"https://api.modrinth.com/v2/user/{first['author']}"
                    ) as response:
                        author = await response.json()

                mod = cog.Embed(
                    title=first["title"],
                    url=f"https://modrinth.com/shader/{first['slug']}",
                    color=0x82E868,
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.information"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.author.shader",
                        author=first["author"],
                        url=f"https://modrinth.com/user/{author['username']}",
                        license=first["license"],
                    ),
                )

                mod.add_field(
                    name=self.bot.translate(
                        inter, "modrinth.field.categories_shader"
                    ),
                    value=f"```{category}```",
                    inline=False,
                )

                try:
                    mod.add_field(
                        name=self.bot.translate(inter, "modrinth.field.description"),
                        value=first["description"],
                        inline=False,
                    )
                except:
                    pass

                cdate = datetime.datetime.fromisoformat(first["date_created"])
                udate = datetime.datetime.fromisoformat(first["date_modified"])
                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.dates"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.dates.shader",
                        created=cog.utils.format_dt(cdate, "f"),
                        updated=cog.utils.format_dt(udate, "f"),
                    ),
                    inline=False,
                )

                mod.add_field(
                    name=self.bot.translate(
                        inter,
                        "modrinth.latest_version.shader",
                        version=first["latest_version"],
                    ),
                    value="|",
                    inline=False,
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.statistics"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.statistics",
                        downloads=first["downloads"],
                        follows=first["follows"],
                    ),
                    inline=True,
                )

                mod.set_thumbnail(url=first["icon_url"])
                if first["featured_gallery"] != None:
                    featured_gallery = cog.Embed(color=0x82E868)
                    featured_gallery.set_image(url=first["featured_gallery"])
                else:
                    featured_gallery = cog.Embed(color=0x82E868)
                    featured_gallery.set_image(url=random.choice(first["gallery"]))

                button = [
                    cog.ui.Button(
                        label=self.bot.translate(inter, "modrinth.button.shader"),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/shader/{first['slug']}",
                        row=1,
                    ),
                    cog.ui.Button(
                        label=self.bot.translate(inter, "modrinth.button.author"),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/user/{author['username']}",
                        row=2,
                    ),
                ]

                try:
                    await inter.edit_original_response(
                        embeds=[mod, featured_gallery], components=button
                    )
                except:
                    await inter.edit_original_response(embed=mod, components=button)

        elif project_type == "mod":
            uri = f'search?query="{query}"&limit=1&facets=[["project_type:mod"]]'
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url=f"https://api.modrinth.com/v2/{uri}"
                ) as response:
                    modget = await response.json()
                await session.close()

            if modget["hits"] == []:
                await inter.edit_original_response(
                    content=self.bot.translate(inter, "modrinth.error.not_found")
                )

            else:
                first = modget["hits"][0]

                client = self._side_label(inter, first["client_side"])
                server = self._side_label(inter, first["server_side"])

                cdate = datetime.datetime.fromisoformat(first["date_created"])
                udate = datetime.datetime.fromisoformat(first["date_modified"])

                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url=f"https://api.modrinth.com/v2/user/{first['author']}"
                    ) as response:
                        author = await response.json()
                    await session.close()

                mod = cog.Embed(
                    title=first["title"],
                    url=f"https://modrinth.com/mod/{first['slug']}",
                    color=0x82E868,
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.information"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.author.mod",
                        author=first["author"],
                        url=f"https://modrinth.com/user/{author['username']}",
                        license=first["license"],
                        client=client,
                        server=server,
                    ),
                )

                try:
                    category = ", ".join(first["categories"])
                    mod.add_field(
                        name=self.bot.translate(inter, "modrinth.field.categories"),
                        value=f"```{category}```",
                        inline=False,
                    )
                except:
                    category = ", ".join(first["display_categories"])
                    mod.add_field(
                        name=self.bot.translate(inter, "modrinth.field.categories"),
                        value=f"```{category}```",
                        inline=False,
                    )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.dates"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.dates.mod",
                        created=cog.utils.format_dt(cdate, "f"),
                        updated=cog.utils.format_dt(udate, "f"),
                    ),
                    inline=False,
                )

                try:
                    mod.add_field(
                        name=self.bot.translate(inter, "modrinth.field.description"),
                        value=first["description"],
                        inline=False,
                    )
                except:
                    pass

                mod.add_field(
                    name=self.bot.translate(
                        inter,
                        "modrinth.latest_version.mod",
                        version=first["latest_version"],
                    ),
                    value="|",
                )

                mod.add_field(
                    name=self.bot.translate(inter, "modrinth.field.statistics"),
                    value=self.bot.translate(
                        inter,
                        "modrinth.statistics",
                        downloads=first["downloads"],
                        follows=first["follows"],
                    ),
                )

                mod.set_thumbnail(url=first["icon_url"])

                if first["featured_gallery"] != None:
                    featured_gallery = cog.Embed(color=0x82E868)
                    featured_gallery.set_image(url=first["featured_gallery"])
                else:
                    try:
                        featured_gallery = cog.Embed(color=0x82E868)
                        featured_gallery.set_image(url=random.choice(first["gallery"]))
                    except:
                        pass

                button = [
                    cog.ui.Button(
                        label=self.bot.translate(inter, "modrinth.button.mod"),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/mod/{first['slug']}",
                        row=1,
                    ),
                    cog.ui.Button(
                        label=self.bot.translate(inter, "modrinth.button.author"),
                        style=cog.ButtonStyle.url,
                        url=f"https://modrinth.com/user/{author['username']}",
                        row=2,
                    ),
                ]

                try:
                    await inter.edit_original_response(
                        embeds=[mod, featured_gallery], components=button
                    )
                except:
                    await inter.edit_original_response(embed=mod, components=button)

        elif project_type == "user":
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url=f"https://api.modrinth.com/v2/user/{query}"
                ) as response:
                    modget = await response.json()
                await session.close()

            ide = modget["id"]

            fields = []

            if modget["role"] != None:
                if modget["role"] == "developer":
                    role = self.bot.translate(inter, "modrinth.role.developer")
                elif modget["role"] == "moderator":
                    role = self.bot.translate(inter, "modrinth.role.moderator")

                fields.append(
                    cog.EmbedField(
                        name=self.bot.translate(inter, "modrinth.field.bio"),
                        value=f"{role}" + (f"```{modget['bio']}```" if modget['bio'] else ""),
                        inline=False,
                    )
                )


            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url=f"https://api.modrinth.com/v2/user/{query}/projects"
                ) as response:
                    target_projects = await response.json()
                await session.close()

            if target_projects:
              _projects_field = []
              _total_following, _total_downloads = 0, 0

              for project in target_projects:
                _total_downloads += project['downloads']
                _total_following += project["followers"]

                _projects_field.append(
                  f"\\> [{project['title']}](https://modrinth.com/{project['project_type']}/{project['slug']}) - ⬇️ {project['downloads']} ❤️ {project['followers']}"
                )
              fields.append(
                cog.EmbedField(
                  name=self.bot.translate(inter, "modrinth.field.projects"),
                  value=f"> **Total:** ⬇️ {_total_downloads} ❤️ {_total_following}\n" + "\n".join(_projects_field)
                )
              )


            embed = cog.Embed(
                title=f"{modget['username']}",
                url=f"https://modrinth.com/user/{ide}",
                color=0x82E868,
                fields=fields,
                thumbnail=modget["avatar_url"]
            )

            button = [
                cog.ui.Button(
                    label=self.bot.translate(inter, "modrinth.button.user"),
                    style=cog.ButtonStyle.url,
                    url=f"https://modrinth.com/user/{modget['id']}",
                    row=1,
                )
            ]

            if modget["email"] != None:
                embed.add_field(
                    name=self.bot.translate(inter, "modrinth.field.email"),
                    value="\\> " + modget["email"],
                )

            date = datetime.datetime.fromisoformat(modget["created"])

            embed.add_field(
                name=self.bot.translate(inter, "modrinth.field.account_created"),
                value=f"\\> {cog.utils.format_dt(date, 'f')}\n\\> {cog.utils.format_dt(date, 'R')}",
            )

            if modget["github_id"] != None:
                embed.add_field(name="github ID", value="\\> " + modget["github_id"])

            embed.add_field(
                name=self.bot.translate(inter, "modrinth.field.user_id"),
                value=f"\\> `{modget["id"]}`",
            )

            await inter.edit_original_response(embed=embed, components=button)


def setup(bot):
    bot.add_cog(Modrinth(bot))
    bot.cog_reload(__name__)
