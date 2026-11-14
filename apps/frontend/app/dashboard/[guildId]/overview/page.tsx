"use client"

import { useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import { useParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import type { GuildDetail, GuildSettings } from "@/lib/guild-settings"
import "./overview.css"

const LINKS = [
	{ href: "greeting", label: "Greeting", desc: "Join messages and auto role" },
	{ href: "moderation", label: "Moderation", desc: "Bad words and mute role" },
	{ href: "logging", label: "Logging", desc: "Event log destinations" },
	{ href: "other", label: "Other", desc: "Tickets, private rooms, honeypot" },
] as const

export default function OverviewPage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const [guild, setGuild] = useState<GuildDetail | null>(null)
	const [settings, setSettings] = useState<GuildSettings | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const [g, s] = await Promise.all([
					apiFetch<GuildDetail>(`/guilds/${guildId}`),
					apiFetch<GuildSettings>(`/guilds/${guildId}/settings`),
				])
				if (!cancelled) {
					setGuild(g)
					setSettings(s)
				}
			} catch {
				if (!cancelled) setError("Could not load overview.")
			}
		})()
		return () => {
			cancelled = true
		}
	}, [guildId])

	if (error) {
		return (
			<div className="section-page">
				<h1 className="title">Overview</h1>
				<p className="lead">{error}</p>
			</div>
		)
	}

	return (
		<div className="overview">
			<header className="head">
				<h1 className="title">Overview</h1>
				<p className="lead">Server snapshot and shortcuts into each settings area.</p>
			</header>

			<section className="card">
				{guild?.iconUrl ? (
					<img src={guild.iconUrl} alt="" width={72} height={72} />
				) : (
					<span className="fallback">{guild?.name?.slice(0, 1) ?? "?"}</span>
				)}
				<div>
					<strong>{guild?.name ?? "Loading…"}</strong>
					<span>{guild?.hasBot ? "kisa is connected" : "Bot not installed"}</span>
				</div>
			</section>

			<section className="stats">
				<div className="stat">
					<strong>{settings?.greetingConfig.enabled ? "On" : "Off"}</strong>
					<span>Greeting</span>
				</div>
				<div className="stat">
					<strong>{settings?.farewellConfig.enabled ? "On" : "Off"}</strong>
					<span>Farewell</span>
				</div>
				<div className="stat">
					<strong>{settings?.loggingConfig?.length ?? 0}</strong>
					<span>Log rules</span>
				</div>
				<div className="stat">
					<strong>{settings?.autoRole ? "Set" : "—"}</strong>
					<span>Auto role</span>
				</div>
			</section>

			<section className="links">
				{LINKS.map((item) => (
					<Link
						key={item.href}
						href={`/dashboard/${guildId}/${item.href}`}
						className="row"
					>
						<div>
							<strong>{item.label}</strong>
							<span>{item.desc}</span>
						</div>
						<span className="chevron">→</span>
					</Link>
				))}
			</section>
		</div>
	)
}
