"use client"

import BotAvatar from "@/components/bot-avatar"
import {
	colorToCss,
	type DiscordProfileDto,
	type UserProfileDto,
	type UserSettingsDto,
} from "@/lib/cabinet"
import { discordAvatarUrl, displayName } from "@/lib/discord"

function formatDiscordTs(date: Date): string {
	const abs = date.toLocaleString("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
	return `${abs}`
}

function relativePlaceholder(): string {
	return "a while ago"
}

export default function UserPreview({
	discord,
	profile,
	settings,
	rating,
}: {
	discord: DiscordProfileDto | null
	profile: UserProfileDto
	settings: UserSettingsDto
	rating: number | null
}) {
	const name = discord
		? displayName({
				id: discord.id,
				username: discord.username,
				global_name: discord.globalName,
				avatar: discord.avatar,
				banner: discord.banner,
				accent_color: discord.accentColor,
			})
		: "You"
	const username = discord?.username ?? "username"
	const userId = discord?.id ?? "0"
	const avatar =
		discord?.avatarUrl ||
		(discord ? discordAvatarUrl(discord.id, discord.avatar, 128) : "")
	const banner = discord?.bannerUrl
	const color = colorToCss(profile.color)
	const created = new Date(Date.UTC(2020, 0, 1, 12, 0, 0))
	const joined = new Date(Date.UTC(2022, 5, 15, 18, 30, 0))
	const now = new Date()
	const tz = settings.timezone

	const showMembership = Boolean(profile.aboutMe || profile.customImage)

	return (
		<aside className="preview">
			<div className="side-head">
				<strong>Preview</strong>
				<span>Right-side copy of Discord /user info</span>
			</div>

			<div className="discord-msg">
				<div className="msg-head">
					<BotAvatar />
					<div>
						<div className="name-row">
							<strong>kisa</strong>
							<span className="bot-tag">BOT</span>
						</div>
						<span className="time">Today at {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
					</div>
				</div>

				<div className="msg-embed" style={{ borderColor: color }}>
					<div className="embed-body">
						<div className="embed-main">
							<strong className="embed-title">Information about {name}</strong>
							<div className="embed-desc">
								<p>
									<strong>User ID:</strong> <code>{userId}</code>
								</p>
								<p>
									<strong>Display name:</strong> {name}
								</p>
								<p>
									<strong>Username:</strong> {discord?.globalName ?? name} ({username})
								</p>
								<p>
									<strong>Status:</strong> <code>online</code>
								</p>
								<p className="muted-line">&gt; <strong>From:</strong> Desktop</p>
							</div>

							<div className="embed-field">
								<strong className="field-name">&gt;&gt; timestamps</strong>
								<p>
									<strong>Joined</strong>
									<br />
									&gt; {formatDiscordTs(joined)} - {relativePlaceholder()}
								</p>
								<p>
									<strong>Account created</strong>
									<br />
									&gt; {formatDiscordTs(created)} - {relativePlaceholder()}
								</p>
								{tz ? (
									<p>
										<strong>User time</strong>
										<br />
										&gt; <code>{now.toLocaleTimeString()} {now.toLocaleDateString("en-GB")}</code> ({tz})
									</p>
								) : null}
							</div>

							<div className="embed-fields-row">
								<div className="embed-field">
									<strong className="field-name">&gt;&gt; Profile files</strong>
									{banner ? (
										<p>
											&gt;{" "}
											<a href={banner} target="_blank" rel="noreferrer">
												Global banner
											</a>
										</p>
									) : (
										<p className="muted-line">&gt; Global banner — unavailable</p>
									)}
									<p>
										&gt;{" "}
										<a href={avatar || "#"} target="_blank" rel="noreferrer">
											Global avatar
										</a>
									</p>
								</div>
								<div className="embed-field">
									<strong className="field-name">&gt;&gt; Flags</strong>
									<p>Nitro</p>
									{rating != null ? <p>Social rating: {rating}</p> : null}
								</div>
							</div>
						</div>

						{avatar ? (
							<img className="embed-thumb" src={avatar} alt="" width={80} height={80} />
						) : null}
					</div>

					{banner ? (
						<img className="embed-image" src={banner} alt="" />
					) : null}
				</div>

				{showMembership ? (
					<div className="msg-embed membership" style={{ borderColor: color }}>
						{profile.aboutMe ? (
							<p className="embed-desc">{profile.aboutMe}</p>
						) : (
							<p className="muted-line">No about me text</p>
						)}
						{profile.customImage ? (
							<img className="embed-image" src={profile.customImage} alt="" />
						) : null}
					</div>
				) : null}
			</div>
		</aside>
	)
}
