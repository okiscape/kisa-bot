import calendar

import cog
import ossapi
from ossapi import models
from utils import config
from utils.shortcuts import MessageDeleteView, format_duration, format_large_numbers, seconds_to_time

RULESET_NAMES = {0: "osu", 1: "taiko", 2: "fruits", 3: "mania"}


class OsuCog(cog.Cog):
		def __init__(self, bot: cog.KisaBot):
				self.bot = bot
				self.api = bot.osu_api

		async def _require_api(self, inter: cog.ApplicationCommandInteraction) -> bool:
				if self.api is not None:
						return True
				await inter.edit_original_response(
						self.bot.translate(inter, "osu.error.api_unavailable")
				)
				return False

		async def _osu_user_id(self, discord_user_id: int) -> int | None:
				rows = await self.bot.database.readUserSettings(discord_user_id)
				if not rows:
						return None
				return rows[0].osu_user_id

		def _integrations_url(self) -> str | None:
				base = config.dashboard_url
				if not base:
						return None
				return f"{base}/dashboard/integrations"

		async def _send_link_redirect(
				self,
				inter: cog.ApplicationCommandInteraction,
				*,
				ephemeral: bool = True,
		) -> None:
				url = self._integrations_url()
				if not url:
						await inter.send(
								self._t(inter, "osu.link_profile.dashboard_missing"),
								ephemeral=ephemeral,
						)
						return
				await inter.send(
						self._t(inter, "osu.link_profile.redirect"),
						components=[
								cog.ui.Button(
										label=self._t(inter, "osu.link_profile.open_dashboard"),
										url=url,
								)
						],
						ephemeral=ephemeral,
				)

		def _t(self, inter, key: str, **kwargs) -> str:
				return self.bot.translate(inter, key, **kwargs)

		def _mode_name(self, score) -> str:
				return RULESET_NAMES.get(getattr(score, "ruleset_id", 0), "osu")

		def _score_points(self, score) -> int:
				return (
						getattr(score, "classic_total_score", None)
						or getattr(score, "total_score", None)
						or getattr(score, "score", None)
						or 0
				)

		def _score_created(self, score):
				return getattr(score, "ended_at", None) or getattr(
						score, "created_at", None
				) or getattr(score, "started_at", None)

		def _score_user(self, score):
				user = getattr(score, "user", None)
				if callable(user):
						return user()
				return user

		def _format_accuracy(self, accuracy: float) -> str:
				if accuracy == 1:
						return "__100%__"
				return f"{accuracy * 100:.2f}%"

		def _hit_counts(self, stats) -> dict[str, int]:
				# Legacy ScoreStatistics (user profile) vs new Statistics (scores).
				if hasattr(stats, "count_300"):
						n300 = int(stats.count_300 or 0)
						n100 = int(stats.count_100 or 0)
						n50 = int(stats.count_50 or 0)
						miss = int(stats.count_miss or 0)
						geki = int(getattr(stats, "count_geki", 0) or 0)
						katu = int(getattr(stats, "count_katu", 0) or 0)
						return {
								"n300": n300 + geki,
								"n100": n100 + katu,
								"n50": n50,
								"miss": miss,
								"total": n300 + geki + n100 + katu + n50,
						}

				n300 = int((stats.great or 0) + (stats.perfect or 0))
				n100 = int((stats.ok or 0) + (stats.good or 0))
				n50 = int(stats.meh or 0)
				miss = int(stats.miss or 0)
				return {
						"n300": n300,
						"n100": n100,
						"n50": n50,
						"miss": miss,
						"total": n300 + n100 + n50,
				}

		def _grade_emoji(self, rank) -> str:
				name = rank.name if hasattr(rank, "name") else str(rank).replace("Grade.", "")
				return eval(f"self.bot.custom_emojis.osu_grade_{name}")

		def _mod_parts(self, mods) -> tuple[list[str], list[str]]:
				emoji_parts: list[str] = []
				text_parts: list[str] = []
				if mods is None:
						return emoji_parts, text_parts

				# Legacy Mod bitmask
				if hasattr(mods, "decompose"):
						for mod in mods.decompose(clean=True):
								emoji_parts.append(f'{eval(f"self.bot.custom_emojis.osu_mod_{mod}")}')
								text_parts.append(mod.short_name())
						return emoji_parts, text_parts

				# ossapi v5 list[NonLegacyMod]
				for mod in mods:
						acronym = getattr(mod, "acronym", None) or str(mod)
						text_parts.append(acronym)
						emoji_parts.append(
								f'{eval(f"self.bot.custom_emojis.osu_mod_{acronym}")}'
						)
				return emoji_parts, text_parts

		def _play_time(self, inter, seconds: int | None) -> str:
				if not seconds:
						return f"0 {self._t(inter, 'common.time.minutes')}"
				return format_duration(
						int(seconds), lambda key: self.bot.translate(inter, key)
				)

		@cog.slash_command(
				name="osu",
				description=cog.Localised("osu! commands", key="osu.command.description"),
		)
		async def osu(self, inter: cog.ApplicationCommandInteraction):
				pass

		@osu.sub_command(
				name="search_beatmapset",
				description=cog.Localised(
						"View info about a beatmapset",
						key="osu.search_beatmapset.description",
				),
		)
		async def search_beatmapset(
				self,
				inter: cog.ApplicationCommandInteraction,
				query: str = cog.Param(
						description=cog.Localised(
								"Beatmapset search query",
								key="osu.search_beatmapset.option.query.description",
						)
				),
		):
				await inter.response.defer()
				if not await self._require_api(inter):
						return

				result = await self.api.search_beatmapsets(
						query, category=ossapi.BeatmapsetSearchCategory.ANY
				)
				beatmapsets = result.beatmapsets
				if not beatmapsets:
						await inter.send(self._t(inter, "osu.search_beatmapset.not_found"))
						return

				beatmapset = await self.api.beatmapset(beatmapsets[0].id)
				try:
						creator = await self.api.user(beatmapset.creator)
				except Exception:
						await inter.send(self._t(inter, "osu.search_beatmapset.not_found"))
						return

				embed = (
						cog.Embed(title=beatmapset.title, color=self.bot.config.colors.osu_main)
						.set_image(beatmapset.covers.card_2x)
						.set_author(name=creator.username, icon_url=creator.avatar_url)
				)

				quick_tags = [
						f"{self.bot.custom_emojis.osu_bpm} {beatmapset.bpm} bpm"
				]
				if beatmapset.nsfw:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.nsfw"))
				if not beatmapset.is_scoreable:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.non_score"))

				difs: list[str] = []
				beatmaps = sorted(
						beatmapset.beatmaps or [],
						key=lambda beatmap: beatmap.difficulty_rating,
						reverse=True,
				)
				beatmap = beatmaps[0] if beatmaps else None
				for bm in beatmaps:
						difs.append(
								self._t(
										inter,
										"osu.search_beatmapset.diff_line",
										stars=bm.difficulty_rating,
										url=bm.url,
										version=bm.version,
										length_emoji=self.bot.custom_emojis.osu_total_length,
										length=seconds_to_time(bm.total_length),
										circles_emoji=self.bot.custom_emojis.osu_count_circles,
										circles=bm.count_circles,
										sliders_emoji=self.bot.custom_emojis.osu_count_sliders,
										sliders=bm.count_sliders,
										hp=bm.drain,
										cs=bm.cs,
										ar=bm.ar,
										od=bm.accuracy,
								)
						)

				ranked = ""
				status = str(beatmapset.ranked)
				if "RANKED" in status or "APPROVED" in status:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.ranked"))
						if beatmapset.ranked_date:
								ranked = self._t(
										inter,
										"osu.search_beatmapset.ranked_date",
										ts=round(beatmapset.ranked_date.timestamp()),
								)
				elif "LOVED" in status:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.loved"))
				elif "GRAVEYARD" in status:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.graveyard"))
				elif "QUALIFIED" in status:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.qualified"))
				elif "WIP" in status:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.wip"))
				elif "PENDING" in status:
						quick_tags.append(self._t(inter, "osu.search_beatmapset.tag.pending"))

				embed.description = self._t(
						inter,
						"osu.search_beatmapset.body",
						tags=" | ".join(quick_tags),
						creator=creator.username,
						creator_id=creator.id,
						country=(creator.country_code or "xx").lower(),
						beatmapset_id=beatmapset.id,
						updated=round(beatmapset.last_updated.timestamp()),
						submitted=round(beatmapset.submitted_date.timestamp())
						if beatmapset.submitted_date
						else 0,
						ranked=ranked,
						diffs="\n".join(difs),
				)

				embeds = [embed]
				osu_id = await self._osu_user_id(inter.author.id)
				if osu_id is not None and beatmap is not None:
						try:
								score_wrap = await self.api.beatmap_user_score(
										beatmap_id=beatmap.id, user_id=osu_id
								)
								score = score_wrap.score
								mode = self._mode_name(score)
								your_score = cog.Embed(
										title=self._t(inter, "osu.search_beatmapset.your_score_title"),
										url=f"https://osu.ppy.sh/scores/{mode}/{score.id}",
										color=self.bot.config.colors.osu_second,
								)
								rank = self._grade_emoji(score.rank)
								user = self._score_user(score)
								if user is not None:
										your_score.set_thumbnail(user.avatar_url)

								mods, txt_mods = self._mod_parts(score.mods)
								fc = ""
								user_combo = score.max_combo
								max_combo = getattr(beatmap, "max_combo", None) or score.max_combo
								if score.max_combo == max_combo:
										fc = "FC"
										user_combo = f"__{score.max_combo}__"

								hits = self._hit_counts(score.statistics)
								created = self._score_created(score)
								your_score.description = (
										self._t(inter, "osu.score.rank", rank=rank)
										+ "\n"
										+ self._t(
												inter,
												"osu.score.body_map",
												version=score.beatmap.version
												if score.beatmap
												else beatmap.version,
												beatmapset_id=beatmapset.id,
												created=round(created.timestamp()) if created else 0,
												combo=user_combo,
												fc=fc,
												max_combo=max_combo,
												score=format_large_numbers(self._score_points(score)),
												accuracy=self._format_accuracy(score.accuracy),
												pp=round(score.pp or 0, 1),
												score_id=score.id,
												total=hits["total"],
												n300=hits["n300"],
												n100=hits["n100"],
												n50=hits["n50"],
												miss=hits["miss"],
												mods=" | ".join(mods) if mods else "—",
												mods_text="  ".join(txt_mods),
										)
								)
								embeds.append(your_score)
						except Exception:
								pass

				await inter.send(
						embeds=embeds,
						components=[
								cog.ui.Button(
										label=self._t(inter, "osu.search_beatmapset.map_link"),
										url=f"https://osu.ppy.sh/beatmapsets/{beatmapset.id}",
								)
						],
				)

		@osu.sub_command(
				name="search_score",
				description=cog.Localised(
						"View info about a score by ID",
						key="osu.search_score.description",
				),
		)
		async def search_score(
				self,
				inter: cog.ApplicationCommandInteraction,
				score_id: int = cog.Param(
						description=cog.Localised(
								"Score ID",
								key="osu.search_score.option.score_id.description",
						)
				),
		):
				await inter.response.defer()
				if not await self._require_api(inter):
						return

				try:
						score = await self.api.score(score_id)
				except Exception:
						score = None

				if score is None:
						await inter.send(self._t(inter, "osu.search_score.not_found"))
						return

				mode = self._mode_name(score)
				beatmap = score.beatmap
				beatmapset = score.beatmapset
				rank = self._grade_emoji(score.rank)

				emb = cog.Embed(
						title=f"{beatmapset.title}" if beatmapset else f"Score {score.id}",
						url=f"https://osu.ppy.sh/scores/{mode}/{score.id}",
						color=self.bot.config.colors.osu_second,
				)
				if beatmapset is not None:
						emb.set_image(beatmapset.covers.card_2x)

				user = self._score_user(score)
				mods, _txt = self._mod_parts(score.mods)
				mod_line = " | ".join(
						f"{text} {emoji}" for emoji, text in zip(mods, _txt)
				) if mods else "—"

				fc = ""
				user_combo = score.max_combo
				max_combo = (
						getattr(beatmap, "max_combo", None) if beatmap is not None else None
				) or score.max_combo
				if score.max_combo == max_combo:
						fc = "FC"
						user_combo = f"__{score.max_combo}__"

				hits = self._hit_counts(score.statistics)
				created = self._score_created(score)
				emb.description = (
						self._t(inter, "osu.score.rank", rank=rank)
						+ "\n"
						+ self._t(
								inter,
								"osu.score.body_id",
								created=round(created.timestamp()) if created else 0,
								combo=user_combo,
								fc=fc,
								max_combo=max_combo,
								score=format_large_numbers(self._score_points(score)),
								accuracy=self._format_accuracy(score.accuracy),
								stars=getattr(beatmap, "difficulty_rating", "?")
								if beatmap
								else "?",
								pp=round(score.pp or 0, 1),
								beatmapset_id=beatmapset.id if beatmapset else score.beatmap_id,
								total=hits["total"],
								n300=hits["n300"],
								n100=hits["n100"],
								n50=hits["n50"],
								miss=hits["miss"],
								username=user.username if user else "?",
								user_id=score.user_id,
								mods=mod_line,
						)
				)
				if user is not None:
						emb.set_thumbnail(user.avatar_url)

				buttons = [
						cog.ui.Button(
								label=self._t(inter, "osu.search_score.open_score"),
								url=f"https://osu.ppy.sh/scores/{mode}/{score.id}",
						)
				]
				if beatmapset is not None:
						buttons.append(
								cog.ui.Button(
										label=self._t(inter, "osu.search_score.open_beatmapset"),
										url=f"https://osu.ppy.sh/beatmapsets/{beatmapset.id}",
								)
						)
				await inter.send(embed=emb, components=buttons)

		@osu.sub_command(
				name="link_profile",
				description=cog.Localised(
						"Link your Discord and osu! accounts",
						key="osu.link_profile.description",
				),
		)
		async def link_profile(self, inter: cog.ApplicationCommandInteraction):
				await inter.response.defer(ephemeral=True)

				osu_id = await self._osu_user_id(inter.author.id)
				if osu_id is not None:
						await inter.edit_original_response(self._t(inter, "osu.link_profile.already_linked"))
						return

				await self._send_link_redirect(inter, ephemeral=True)

		@osu.sub_command(
				name="playing",
				description=cog.Localised(
						"View the map the mentioned person is playing",
						key="osu.playing.description",
				),
		)
		async def playing(
				self,
				inter: cog.ApplicationCommandInteraction,
				user: cog.Member = cog.Param(
						description=cog.Localised(
								"Member to check",
								key="osu.playing.option.user.description",
						)
				),
		):
				activities = getattr(user, "activities", None) or []
				for activity in activities:
						if activity.type != cog.ActivityType.playing:
								continue
						if activity.name != "osu!":
								continue
						if getattr(activity, "application_id", None) == 367827983903490050:
								details = getattr(activity, "details", None)
								if details:
										return await self.search_beatmapset(inter, details)
				await inter.send(self._t(inter, "osu.playing.not_playing"))

		@osu.sub_command(
				name="profile",
				description=cog.Localised(
						"View an osu! profile if it is linked to Discord",
						key="osu.profile.description",
				),
		)
		async def profile(
				self,
				inter: cog.ApplicationCommandInteraction,
				user: cog.Member = cog.Param(
						description=cog.Localised(
								"Member whose osu! profile to view",
								key="osu.profile.option.user.description",
						),
						default=lambda a: a.author,
				),
				ephemeral: bool = cog.Param(
					description=cog.Localised(
						"Send as ephemeral message",
						key="common.send_as_ephemeral",
					),
					default=True
				)
		):
				await inter.response.defer(ephemeral=ephemeral)
				if not await self._require_api(inter):
						return

				osu_id = await self._osu_user_id(user.id)
				if osu_id is None:
						if user.id == inter.author.id:
								await self._send_link_redirect(inter, ephemeral=True)
						else:
								await inter.send(self._t(inter, "osu.profile.not_linked"), ephemeral=True)
						return

				profile: cog.OsuUser = await self.api.user(osu_id)
				unspecified = self._t(inter, "osu.profile.unspecified")

				profile_embed = cog.Embed(
						title=f"{profile.username or profile.title or profile.id}  :flag_{(profile.country_code or 'xx').lower()}:",
						color=0xFFACD0,
				)
				profile_embed.set_thumbnail(profile.avatar_url)

				style: list[str] = []
				styl = profile.playstyle
				if styl is not None:
						if styl & models.PlayStyles.MOUSE:
								style.append(self._t(inter, "osu.profile.style.mouse"))
						if styl & models.PlayStyles.KEYBOARD:
								style.append(self._t(inter, "osu.profile.style.keyboard"))
						if styl & models.PlayStyles.TABLET:
								style.append(self._t(inter, "osu.profile.style.tablet"))
						if styl & models.PlayStyles.TOUCH:
								style.append(self._t(inter, "osu.profile.style.touch"))

				replay_watch: list[str] = []
				for play in (profile.replays_watched_counts or [])[-7:]:
						replay_watch.append(
								f"> {calendar.month_name[play.start_date.month]} {play.start_date.year} / **`{play.count}`**"
						)

				stats = profile.statistics
				profile_embed.description = self._t(
						inter,
						"osu.profile.body",
						country_rank=format_large_numbers(
								stats.country_rank if stats else None
						)
						if stats and stats.country_rank
						else "404",
						global_rank=format_large_numbers(
								stats.global_rank if stats else None
						)
						if stats and stats.global_rank
						else "404",
						interests=profile.interests or unspecified,
						user_id=profile.id,
						occupation=profile.occupation or unspecified,
						previous=", ".join(
								profile.previous_usernames
								or [profile.username or profile.title or str(profile.id)]
						),
						discord=profile.discord or unspecified,
						posts=profile.post_count,
						comments=profile.comments_count,
				)

				profile_embed.add_field(
						name=self._t(
								inter, "osu.profile.stats_name", username=profile.username
						),
						value=self._t(
								inter,
								"osu.profile.stats_value",
								kudosu=format_large_numbers(profile.kudosu.total),
								playmode=profile.playmode or unspecified,
								level=format_large_numbers(
										stats.level.current if stats and stats.level else 0
								),
								pp=format_large_numbers(
										round(stats.pp, 1) if stats and stats.pp is not None else 0
								),
								max_combo=format_large_numbers(
										stats.maximum_combo if stats else 0
								),
								total_score=format_large_numbers(
										stats.total_score if stats else 0
								),
								play_time=self._play_time(
										inter, stats.play_time if stats else 0
								),
								play_style=", ".join(style or [unspecified]),
								joined=round(profile.join_date.timestamp()),
						),
						inline=False,
				)

				if stats and stats.grade_counts:
					grades = stats.grade_counts
					profile_embed.add_field(
							name=self._t(inter, "osu.profile.grades_name"),
							value=self._t(
									inter,
									"osu.profile.grades_value",
									total=(
										stats.grade_counts.ssh + 
										stats.grade_counts.ss +
										stats.grade_counts.sh +
										stats.grade_counts.s +
										stats.grade_counts.a
									),
									ssh_n=format_large_numbers(grades.ssh or 0),
									ss_n=format_large_numbers(grades.ss or 0),
									sh_n=format_large_numbers(grades.sh or 0),
									s_n=format_large_numbers(grades.s or 0),
									a_n=format_large_numbers(grades.a or 0),
							),
					)

				profile_embed.add_field(
						name=self._t(inter, "osu.profile.hits_name"),
						value=self._t(
								inter,
								"osu.profile.hits_value",
								total=format_large_numbers(
										(stats.count_300 + stats.count_100 + stats.count_50)
										if stats
										else 0
								),
								n300=format_large_numbers(stats.count_300 if stats else 0),
								n100=format_large_numbers(stats.count_100 if stats else 0),
								n50=format_large_numbers(stats.count_50 if stats else 0),
								miss=format_large_numbers(stats.count_miss if stats else 0),
								plays=profile.beatmap_playcounts_count or 0,
						),
						inline=True,
				)

				profile_embed.add_field(
						name=self._t(inter, "osu.profile.maps_name"),
						value=self._t(
								inter,
								"osu.profile.maps_value",
								total=(
									profile.ranked_and_approved_beatmapset_count +
									profile.graveyard_beatmapset_count +
									profile.pending_beatmapset_count +
									profile.unranked_beatmapset_count +
									profile.guest_beatmapset_count + 
									profile.loved_beatmapset_count
								),
								guest=profile.guest_beatmapset_count or 0,
								loved=profile.loved_beatmapset_count or 0,
								ranked=profile.ranked_and_approved_beatmapset_count or 0,
								pending=profile.pending_beatmapset_count or 0,
								unranked=profile.unranked_beatmapset_count or 0,
								graveyard=profile.graveyard_beatmapset_count or 0,
						),
						inline=True,
				)

				plays: list[str] = []
				for play in (profile.monthly_playcounts or [])[-7:]:
						plays.append(
								f"> {calendar.month_name[play.start_date.month]} {play.start_date.year} / **`{play.count}`**"
						)
				profile_embed.add_field(
						name=self._t(inter, "osu.profile.month_plays"),
						value="\n".join(plays) or "—",
				)
				profile_embed.add_field(
						name=self._t(inter, "osu.profile.month_replays"),
						value="\n".join(replay_watch)
						or self._t(inter, "osu.profile.no_replays"),
				)

				embs = [profile_embed]
				recent = await self.api.user_recent_activity(profile.id, limit=1)
				if recent:
						event = recent[0]
						recent_embed = cog.Embed(
								title=self._t(inter, "osu.profile.recent_title")
						)
						last_event = None
						ts = round(event.created_at.timestamp())

						if event.type == models.EventType.ACHIEVEMENT:
								last_event = self._t(
										inter,
										"osu.profile.recent.achievement",
										name=event.achievement.name,
										description=event.achievement.description,
										ts=ts,
								)
								recent_embed.color = 0xD9B541
						elif event.type == models.EventType.RANK:
								last_event = self._t(
										inter,
										"osu.profile.recent.rank",
										rank=event.scoreRank,
										title=event.beatmap.title,
										ts=ts,
								)
								recent_embed.color = 0x72C904
						elif event.type == models.EventType.RANK_LOST:
								last_event = self._t(
										inter,
										"osu.profile.recent.rank_lost",
										title=event.beatmap.title,
										ts=ts,
								)
								recent_embed.color = 0x2F5500
						elif event.type == models.EventType.USERNAME_CHANGE:
								last_event = self._t(
										inter,
										"osu.profile.recent.username_change",
										previous=event.user.previousUsername,
										username=event.user.username,
										ts=ts,
								)
								recent_embed.color = 0x009DAA
						elif event.type == models.EventType.BEATMAPSET_APPROVE:
								last_event = self._t(
										inter,
										"osu.profile.recent.beatmapset_approve",
										approval=event.approval,
										ts=ts,
								)
								recent_embed.color = 0x72FF7C
						elif event.type == models.EventType.BEATMAPSET_UPDATE:
								last_event = self._t(
										inter,
										"osu.profile.recent.beatmapset_update",
										title=event.beatmapset.title,
										ts=ts,
								)
								recent_embed.color = 0xFFD966
						elif event.type == models.EventType.BEATMAPSET_DELETE:
								last_event = self._t(
										inter,
										"osu.profile.recent.beatmapset_delete",
										title=event.beatmapset.title,
										ts=ts,
								)
								recent_embed.color = 0xEF6262
						elif event.type == models.EventType.BEATMAPSET_UPLOAD:
								last_event = self._t(
										inter,
										"osu.profile.recent.beatmapset_upload",
										title=event.beatmapset.title,
										ts=ts,
								)
								recent_embed.color = 0x72FF7C
						elif event.type == models.EventType.BEATMAPSET_REVIVE:
								last_event = self._t(
										inter,
										"osu.profile.recent.beatmapset_revive",
										title=event.beatmapset.title,
										ts=ts,
								)
								recent_embed.color = 0x3D9ABA
						elif event.type == models.EventType.USER_SUPPORT_FIRST:
								last_event = self._t(
										inter, "osu.profile.recent.support_first", ts=ts
								)
								recent_embed.color = 0xDE31AE
						elif event.type == models.EventType.USER_SUPPORT_GIFT:
								last_event = self._t(
										inter, "osu.profile.recent.support_gift", ts=ts
								)
								recent_embed.color = 0xDE31AE

						if last_event:
								recent_embed.description = last_event
								embs.append(recent_embed)

				await inter.send(
						embeds=embs,
						components=[
								cog.ui.Button(
										label=self._t(inter, "osu.profile.open_profile"),
										url=f"https://osu.ppy.sh/users/{profile.id}",
								)
						],
						ephemeral=ephemeral
				)


def setup(bot: cog.KisaBot):
		bot.add_cog(OsuCog(bot))
		bot.cog_reload(__name__)
