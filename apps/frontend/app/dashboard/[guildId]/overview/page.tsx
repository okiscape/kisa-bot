"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "next-view-transitions"
import { useParams } from "next/navigation"
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import { apiFetch } from "@/lib/api"
import type { GuildDetail } from "@/lib/guild-settings"
import "./overview.css"

const LINKS = [
	{ href: "greeting", label: "Greeting", desc: "Join and leave messages" },
	{ href: "moderation", label: "Moderation", desc: "Bad words and mute role" },
	{ href: "logging", label: "Logging", desc: "Event log destinations" },
	{ href: "other", label: "Other", desc: "Tickets, private rooms, honeypot" },
] as const

const RANGES = [
	{ id: "week", label: "Week" },
	{ id: "month", label: "Month" },
	{ id: "6m", label: "6 months" },
	{ id: "year", label: "Year" },
] as const

type RangeId = (typeof RANGES)[number]["id"]

type GuildMetrics = {
	range: RangeId
	from: string
	to: string
	today: { messages: number; joins: number; leaves: number }
	totals: { messages: number; joins: number; leaves: number }
	points: Array<{
		day: string
		messages: number
		joins: number
		leaves: number
	}>
}

const COLOR_MESSAGES = "#eeba93"
const COLOR_JOINED = "#5bd68a"
const COLOR_LEFT = "#ff6b5e"

function formatInt(n: number): string {
	return new Intl.NumberFormat("en-US").format(n)
}

function formatDayLabel(iso: string): string {
	const d = new Date(`${iso}T00:00:00.000Z`)
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	})
}

function formatRangeLabel(from: string, to: string): string {
	const opts: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}
	const a = new Date(`${from}T00:00:00.000Z`).toLocaleDateString("en-US", opts)
	const b = new Date(`${to}T00:00:00.000Z`).toLocaleDateString("en-US", opts)
	return `${a} - ${b}`
}

function storageKey(guildId: string, suffix: string) {
	return `kisa:overview:${guildId}:${suffix}`
}

function readStoredRange(guildId: string): RangeId {
	try {
		const raw = localStorage.getItem(storageKey(guildId, "range"))
		if (RANGES.some((r) => r.id === raw)) return raw as RangeId
	} catch {
		/* ignore */
	}
	return "month"
}

function readStoredBool(guildId: string, suffix: string, fallback: boolean) {
	try {
		const raw = localStorage.getItem(storageKey(guildId, suffix))
		if (raw === "0") return false
		if (raw === "1") return true
	} catch {
		/* ignore */
	}
	return fallback
}

function ChartTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean
	payload?: Array<{ name?: string; value?: number; color?: string }>
	label?: string
}) {
	if (!active || !payload?.length || !label) return null
	return (
		<div className="chart-tip">
			<span className="tip-date">{formatDayLabel(label)}</span>
			{payload.map((item) => (
				<div key={String(item.name)} className="tip-row">
					<span>
						<i style={{ background: item.color }} />
						{item.name}
					</span>
					<strong>{formatInt(Number(item.value ?? 0))}</strong>
				</div>
			))}
		</div>
	)
}

export default function OverviewPage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const [guild, setGuild] = useState<GuildDetail | null>(null)
	const [metrics, setMetrics] = useState<GuildMetrics | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [range, setRange] = useState<RangeId>("month")
	const [showMessages, setShowMessages] = useState(true)
	const [showJoined, setShowJoined] = useState(true)
	const [showLeft, setShowLeft] = useState(true)
	const [prefsReady, setPrefsReady] = useState(false)

	useEffect(() => {
		setRange(readStoredRange(guildId))
		setShowMessages(readStoredBool(guildId, "showMessages", true))
		setShowJoined(readStoredBool(guildId, "showJoined", true))
		setShowLeft(readStoredBool(guildId, "showLeft", true))
		setPrefsReady(true)
		setMetrics(null)
	}, [guildId])

	useEffect(() => {
		if (!prefsReady) return
		try {
			localStorage.setItem(storageKey(guildId, "range"), range)
			localStorage.setItem(
				storageKey(guildId, "showMessages"),
				showMessages ? "1" : "0",
			)
			localStorage.setItem(
				storageKey(guildId, "showJoined"),
				showJoined ? "1" : "0",
			)
			localStorage.setItem(
				storageKey(guildId, "showLeft"),
				showLeft ? "1" : "0",
			)
		} catch {
			/* ignore */
		}
	}, [guildId, prefsReady, range, showMessages, showJoined, showLeft])

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const g = await apiFetch<GuildDetail>(`/guilds/${guildId}`)
				if (!cancelled) setGuild(g)
			} catch {
				if (!cancelled) setError("Could not load overview.")
			}
		})()
		return () => {
			cancelled = true
		}
	}, [guildId])

	useEffect(() => {
		if (!prefsReady) return
		let cancelled = false
		;(async () => {
			try {
				const data = await apiFetch<GuildMetrics>(
					`/guilds/${guildId}/metrics?range=${range}`,
				)
				if (!cancelled) setMetrics(data)
			} catch {
				if (!cancelled) setMetrics(null)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [guildId, range, prefsReady])

	const chartData = useMemo(
		() =>
			(metrics?.points ?? []).map((p) => ({
				...p,
				label: formatDayLabel(p.day),
			})),
		[metrics],
	)

	if (error) {
		return (
			<div className="section-page">
				<h1 className="title">Overview</h1>
				<p className="lead">{error}</p>
			</div>
		)
	}

	const totals = metrics?.totals ?? { messages: 0, joins: 0, leaves: 0 }
	const today = metrics?.today ?? { messages: 0, joins: 0, leaves: 0 }

	return (
		<div className="overview">
			<header className="head">
				<h1 className="title">Overview</h1>
				<p className="lead">
					Server snapshot, activity and shortcuts into each settings area.
				</p>
			</header>

			<section className="status">
				<div className="left">
					{guild?.iconUrl ? (
						<img src={guild.iconUrl} alt="" width={56} height={56} />
					) : (
						<span className="fallback">{guild?.name?.slice(0, 1) ?? "?"}</span>
					)}
					<div>
						<strong>{guild?.name ?? "Loading…"}</strong>
						<span>
							{guild?.hasBot ? "kisa is connected" : "Bot not installed"}
						</span>
					</div>
				</div>
				{guild?.hasBot ? (
					<span className="connected">
						<span className="dot">●</span> Connected
					</span>
				) : null}
			</section>

			<section className="activity">
				<div className="activity-head">
					<div className="titles">
						<strong>Activity</strong>
						<span>
							{formatInt(totals.messages)} messages · {formatInt(totals.joins)}{" "}
							joined · {formatInt(totals.leaves)} left
						</span>
					</div>
					<div className="segments" role="tablist" aria-label="Time range">
						{RANGES.map((item) => (
							<button
								key={item.id}
								type="button"
								role="tab"
								aria-selected={range === item.id}
								className={range === item.id ? "on" : undefined}
								onClick={() => setRange(item.id)}
							>
								{item.label}
							</button>
						))}
					</div>
				</div>

				{metrics ? (
					<p className="range-label">
						{formatRangeLabel(metrics.from, metrics.to)}
					</p>
				) : (
					<p className="range-label">Loading activity…</p>
				)}

				<div className="charts">
					<div className={`chart-card${showMessages ? "" : " off"}`}>
						<div className="chart-card-head">
							<strong>Messages</strong>
							<button
								type="button"
								className={`series-chip messages${showMessages ? " on" : ""}`}
								onClick={() => setShowMessages((v) => !v)}
							>
								{showMessages ? "✓ " : ""}Messages
							</button>
						</div>
						{showMessages ? (
							<div className="chart-plot">
								<ResponsiveContainer width="100%" height={240}>
									<LineChart
										data={chartData}
										margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
									>
										<CartesianGrid
											stroke="#3d3d3d"
											strokeDasharray="3 6"
											vertical={false}
										/>
										<XAxis
											dataKey="day"
											tickFormatter={formatDayLabel}
											stroke="#8a837e"
											tick={{ fill: "#8a837e", fontSize: 12 }}
											minTickGap={28}
										/>
										<YAxis
											stroke="#8a837e"
											tick={{ fill: "#8a837e", fontSize: 12 }}
											width={40}
											allowDecimals={false}
										/>
										<Tooltip content={<ChartTooltip />} />
										<Line
											type="monotone"
											dataKey="messages"
											name="Messages"
											stroke={COLOR_MESSAGES}
											strokeWidth={2.5}
											dot={false}
											activeDot={{ r: 4 }}
											isAnimationActive={false}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						) : (
							<p className="chart-empty">Messages series hidden</p>
						)}
					</div>

					<div className={`chart-card${showJoined || showLeft ? "" : " off"}`}>
						<div className="chart-card-head">
							<strong>Members</strong>
							<div className="series-row">
								<button
									type="button"
									className={`series-chip joined${showJoined ? " on" : ""}`}
									onClick={() => setShowJoined((v) => !v)}
								>
									{showJoined ? "✓ " : ""}Joined
								</button>
								<button
									type="button"
									className={`series-chip left${showLeft ? " on" : ""}`}
									onClick={() => setShowLeft((v) => !v)}
								>
									{showLeft ? "✓ " : ""}Left
								</button>
							</div>
						</div>
						{showJoined || showLeft ? (
							<div className="chart-plot">
								<ResponsiveContainer width="100%" height={240}>
									<LineChart
										data={chartData}
										margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
									>
										<CartesianGrid
											stroke="#3d3d3d"
											strokeDasharray="3 6"
											vertical={false}
										/>
										<XAxis
											dataKey="day"
											tickFormatter={formatDayLabel}
											stroke="#8a837e"
											tick={{ fill: "#8a837e", fontSize: 12 }}
											minTickGap={28}
										/>
										<YAxis
											stroke="#8a837e"
											tick={{ fill: "#8a837e", fontSize: 12 }}
											width={40}
											allowDecimals={false}
										/>
										<Tooltip content={<ChartTooltip />} />
										{showJoined ? (
											<Line
												type="monotone"
												dataKey="joins"
												name="Joined"
												stroke={COLOR_JOINED}
												strokeWidth={2.5}
												dot={false}
												activeDot={{ r: 4 }}
												isAnimationActive={false}
											/>
										) : null}
										{showLeft ? (
											<Line
												type="monotone"
												dataKey="leaves"
												name="Left"
												stroke={COLOR_LEFT}
												strokeWidth={2.5}
												dot={false}
												activeDot={{ r: 4 }}
												isAnimationActive={false}
											/>
										) : null}
									</LineChart>
								</ResponsiveContainer>
							</div>
						) : (
							<p className="chart-empty">Member series hidden</p>
						)}
					</div>
				</div>
			</section>

			<section className="today-stats">
				<div className="stat">
					<strong>{formatInt(today.messages)}</strong>
					<span>Messages sent today</span>
				</div>
				<div className="stat">
					<strong>
						<span className="pos">+{formatInt(today.joins)}</span>
						{" / "}
						<span className="neg">-{formatInt(today.leaves)}</span>
					</strong>
					<span>Members joined / left</span>
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
