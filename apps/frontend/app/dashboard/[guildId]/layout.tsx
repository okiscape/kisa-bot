"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "next-view-transitions"
import { useParams, usePathname } from "next/navigation"
import { apiFetch, ApiError } from "@/lib/api"
import "./guild.css"

type GuildDetail = {
	id: string
	name: string
	iconUrl: string | null
	icon: string | null
	hasBot: boolean
	botInviteUrl: string | null
}

const NAV = [
	{ slug: "overview", label: "Overview" },
	{ slug: "greeting", label: "Greet/Farewell" },
	{ slug: "moderation", label: "Moderation" },
	{ slug: "logging", label: "Logging" },
	{ slug: "other", label: "Other" },
] as const

export default function GuildLayout({ children }: { children: React.ReactNode }) {
	const params = useParams<{ guildId: string }>()
	const pathname = usePathname()
	const guildId = params.guildId
	const [guild, setGuild] = useState<GuildDetail | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [inviteUrl, setInviteUrl] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const data = await apiFetch<GuildDetail>(`/guilds/${guildId}`)
				if (!cancelled) {
					setGuild(data)
					setInviteUrl(data.botInviteUrl)
				}
			} catch (err) {
				if (cancelled) return
				if (err instanceof ApiError && err.status === 409) {
					const body = err.body as {
						error?: { details?: { botInviteUrl?: string } }
					}
					setInviteUrl(body?.error?.details?.botInviteUrl ?? null)
					setError("kisa is not installed in this server yet.")
					return
				}
				setError("Could not load this server.")
			}
		})()
		return () => {
			cancelled = true
		}
	}, [guildId])

	const active = useMemo(() => {
		const match = NAV.find((item) => pathname.endsWith(`/${item.slug}`))
		return match?.slug ?? "overview"
	}, [pathname])

	return (
		<div className="guild">
			<aside className="side">
				<div className="head">
					<Link className="back" href="/dashboard">
						Dashboard
					</Link>
					{guild ? (
						<div className="chip">
							{guild.iconUrl ? (
								<img src={guild.iconUrl} alt="" width={44} height={44} />
							) : (
								<span className="fallback">{guild.name.slice(0, 1)}</span>
							)}
							<div>
								<strong>{guild.name}</strong>
								<span>{guild.hasBot ? "Connected" : "Not added"}</span>
							</div>
						</div>
					) : (
						<div className="chip">
							<span className="fallback">…</span>
							<div>
								<strong>Loading…</strong>
								<span>Server</span>
							</div>
						</div>
					)}
				</div>

				<nav className="nav" aria-label="Guild settings">
					{NAV.map((item) => (
						<Link
							key={item.slug}
							href={`/dashboard/${guildId}/${item.slug}`}
							className={`item${active === item.slug ? " active" : ""}`}
						>
							{item.label}
						</Link>
					))}
				</nav>
			</aside>

			<section className="main">
				{error ? (
					<div className="banner">
						<p>{error}</p>
						{inviteUrl ? (
							<a className="invite" href={inviteUrl}>
								Add kisa
							</a>
						) : null}
					</div>
				) : null}
				{children}
			</section>
		</div>
	)
}
