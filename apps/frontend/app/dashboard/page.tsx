"use client"

import { useEffect, useMemo, useState } from "react"
import Button from "@/components/button"
import CabinetShell from "@/components/cabinet-shell"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { displayName, type GuildDiscoveryItem } from "@/lib/discord"

type Filter = "all" | "here" | "missing"

const FILTERS = [
	["all", "All"],
	["here", "Is here"],
	["missing", "Is not here"],
] as const

export default function DashboardPage() {
	const { user } = useAuth()
	const [guilds, setGuilds] = useState<GuildDiscoveryItem[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [query, setQuery] = useState("")
	const [filter, setFilter] = useState<Filter>("all")

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const data = await apiFetch<GuildDiscoveryItem[]>("/guilds?filter=manageable")
				if (!cancelled) setGuilds(data)
			} catch {
				if (!cancelled) setError("Could not load your servers.")
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

	const filtered = useMemo(() => {
		if (!guilds) return []
		const q = query.trim().toLowerCase()
		return guilds.filter((g) => {
			if (filter === "here" && !g.hasBot) return false
			if (filter === "missing" && g.hasBot) return false
			if (q && !g.name.toLowerCase().includes(q)) return false
			return true
		})
	}, [guilds, query, filter])

	const name = user ? displayName(user) : ""

	return (
		<CabinetShell active="servers">
			<header className="hero">
				<h1 className="title">Hello, {name}</h1>
				<p className="lead">Your servers and personal settings in one place.</p>
			</header>

			<div className="toolbar">
				<input
					className="search"
					type="search"
					placeholder="Search servers."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					aria-label="Search servers"
				/>
				<div className="filters" role="group" aria-label="Bot presence filter">
					{FILTERS.map(([id, label]) => (
						<button
							key={id}
							type="button"
							className={`filter${filter === id ? " on" : ""}`}
							onClick={() => setFilter(id)}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{error ? <p className="note">{error}</p> : null}
			{guilds === null && !error ? <p className="note">Loading servers…</p> : null}

			<ul className="list">
				{filtered.map((guild) => (
					<li key={guild.id} className="row">
						<div className="identity">
							{guild.iconUrl ? (
								<img src={guild.iconUrl} alt="" width={48} height={48} />
							) : (
								<span className="fallback">{guild.name.slice(0, 1)}</span>
							)}
							<div>
								<strong>{guild.name}</strong>
								<span className={`status${guild.hasBot ? "" : " missing"}`}>
									{guild.hasBot ? "kisa is here" : "Not added"}
								</span>
							</div>
						</div>

						{guild.hasBot ? (
							<Button href={`/dashboard/${guild.id}/overview`} variant="primary" size="md">
								Open
							</Button>
						) : guild.botInviteUrl ? (
							<Button href={guild.botInviteUrl} variant="ghost" size="md">
								Add kisa
							</Button>
						) : (
							<span className="status missing">Invite unavailable</span>
						)}
					</li>
				))}
			</ul>

			{guilds && filtered.length === 0 ? (
				<p className="note">No servers match this filter.</p>
			) : null}
		</CabinetShell>
	)
}
