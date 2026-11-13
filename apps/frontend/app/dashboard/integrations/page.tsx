"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Button from "@/components/button"
import CabinetShell from "@/components/cabinet-shell"
import { apiFetch, lastfmLinkUrl, osuLinkUrl } from "@/lib/api"
import type { IntegrationStatus } from "@/lib/cabinet"
import "./integrations.css"

const ERROR_COPY: Record<string, string> = {
	missing_code: "osu! did not return an auth code.",
	missing_token: "Last.fm did not return a token.",
	state_mismatch: "Link session expired. Try again.",
	state_expired: "Link session expired. Try again.",
	osu_link_failed: "Could not link your osu! account.",
	lastfm_link_failed: "Could not link your Last.fm account.",
	access_denied: "Authorization was cancelled.",
	not_authenticated: "Log in with Discord before linking accounts.",
}

function formatNumber(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return "—"
	return Math.round(value).toLocaleString("en-US")
}

function formatRank(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return "—"
	return `#${Math.round(value).toLocaleString("en-US")}`
}

function IntegrationsContent() {
	const params = useSearchParams()
	const [status, setStatus] = useState<IntegrationStatus | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const [busy, setBusy] = useState<"osu" | "lastfm" | null>(null)

	const load = useCallback(async () => {
		try {
			const data = await apiFetch<IntegrationStatus>("/users/@me/integrations")
			setStatus(data)
		} catch {
			setError("Could not load integrations.")
		}
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	useEffect(() => {
		const err = params.get("error")
		if (err) {
			setNotice(ERROR_COPY[err] ?? "Linking failed. Please try again.")
			return
		}
		if (params.get("osu") === "linked") {
			return
		}
	}, [params])

	async function unlink(provider: "osu" | "lastfm") {
		setBusy(provider)
		setNotice(null)
		try {
			const path =
				provider === "osu" ? "/auth/osu/link" : "/auth/lastfm/link"
			const next = await apiFetch<IntegrationStatus>(path, { method: "DELETE" })
			setStatus(next)
		} catch {
			setNotice("Could not unlink account.")
		} finally {
			setBusy(null)
		}
	}

	function link(provider: "osu" | "lastfm") {
		setBusy(provider)
		window.location.href = provider === "osu" ? osuLinkUrl() : lastfmLinkUrl()
	}

	return (
		<CabinetShell active="integrations">
			<header className="hero">
				<h1 className="title">Integrations</h1>
				<p className="lead">
					Link osu! and Last.fm so Discord commands can use your accounts later.
				</p>
			</header>

			{notice ? <p className="note">{notice}</p> : null}
			{error ? <p className="note">{error}</p> : null}
			{!status && !error ? <p className="note">Loading…</p> : null}

			{status ? (
				<ul className="integration-cards">
					<li className="integration-card osu">
						<div className="card-head">
							<div className="card-meta">
								<h2 className="card-title">osu!</h2>
								
								{status.osu.linked && status.osu.username ? (
									<p className="connected-as">
										Connected as {status.osu.username}
									</p>
								) : !status.osu.configured ? (
									<p className="connected-as">
										OAuth not configured on this server
									</p>
								) : null}
							</div>

							<span
								className={
									status.osu.linked ? "status-tip on" : "status-tip off"
								}
							>
								{status.osu.linked ? "Connected" : "Off"}
							</span>
						</div>


						{status.osu.linked ? (
							<>
								<div className="divider" aria-hidden="true" />
								<div className="stats">
									<div className="stat">
										<span className="value">
											{status.osu.username ?? "—"}
										</span>
										<span className="label">Username</span>
									</div>
									<div className="stat">
										<span className="value">{formatNumber(status.osu.pp)}</span>
										<span className="label">pp</span>
									</div>
									<div className="stat">
										<span className="value">
											{formatRank(status.osu.globalRank)}
										</span>
										<span className="label">Leaderboard</span>
									</div>
								</div>
							</>
						) : null}

						<div className="card-actions">
							{status.osu.linked ? (
								<Button
									variant="ghost"
									size="md"
									onClick={() => void unlink("osu")}
									disabled={busy === "osu"}
								>
									{busy === "osu" ? "Disconnecting…" : "Disconnect"}
								</Button>
							) : (
								<Button
									variant="ghost"
									size="md"
									onClick={() => link("osu")}
									disabled={!status.osu.configured || busy === "osu"}
								>
									{busy === "osu" ? "Continuing…" : "Link osu! account"}
								</Button>
							)}
						</div>
					</li>

					<li className="integration-card lastfm">
						<div className="card-head">
							<div className="card-meta">
								<h2 className="card-title">last.fm</h2>
								{status.lastfm.linked && status.lastfm.username ? (
									<p className="connected-as">
										Connected as {status.lastfm.username}
									</p>
								) : !status.lastfm.configured ? (
									<p className="connected-as">
										OAuth not configured on this server
									</p>
								) : null}
							</div>
							

							<span
								className={
									status.lastfm.linked ? "status-tip on" : "status-tip off"
								}
							>
								{status.lastfm.linked ? "Connected" : "Off"}
							</span>
						</div>


						{status.lastfm.linked ? (
							<>
								<div className="divider" aria-hidden="true" />
								<div className="stats">
									<div className="stat">
										<span className="value">
											{formatNumber(status.lastfm.scrobbles)}
										</span>
										<span className="label">Scrobbles</span>
									</div>
									<div className="stat">
										<span className="value">
											{status.lastfm.topArtistWeek ?? "—"}
										</span>
										<span className="label">Top artist · week</span>
									</div>
								</div>
							</>
						) : null}

						<div className="card-actions">
							{status.lastfm.linked ? (
								<Button
									variant="ghost"
									size="md"
									onClick={() => void unlink("lastfm")}
									disabled={busy === "lastfm"}
								>
									{busy === "lastfm" ? "Disconnecting…" : "Disconnect"}
								</Button>
							) : (
								<Button
									variant="ghost"
									size="md"
									onClick={() => link("lastfm")}
									disabled={!status.lastfm.configured || busy === "lastfm"}
								>
									{busy === "lastfm"
										? "Continuing…"
										: "Link last.fm account"}
								</Button>
							)}
						</div>
					</li>
				</ul>
			) : null}
		</CabinetShell>
	)
}

export default function IntegrationsPage() {
	return (
		<Suspense
			fallback={
				<CabinetShell active="integrations">
					<header className="hero">
						<h1 className="title">Integrations</h1>
						<p className="lead">Loading…</p>
					</header>
				</CabinetShell>
			}
		>
			<IntegrationsContent />
		</Suspense>
	)
}
