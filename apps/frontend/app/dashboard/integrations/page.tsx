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
			setNotice("osu! account linked.")
			return
		}
		if (params.get("lastfm") === "linked") {
			setNotice("Last.fm account linked.")
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
			setNotice(provider === "osu" ? "osu! unlinked." : "Last.fm unlinked.")
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
				<ul className="cards">
					<li className="card">
						<div className="meta">
							<strong>osu!</strong>
							<span>
								{status.osu.linked
									? `Linked as ${status.osu.username}`
									: status.osu.configured
										? "Not linked"
										: "OAuth not configured on this server"}
							</span>
						</div>
						<div className="actions">
							{status.osu.linked ? (
								<Button
									variant="ghost"
									size="md"
									onClick={() => void unlink("osu")}
								>
									{busy === "osu" ? "Unlinking…" : "Unlink"}
								</Button>
							) : (
								<Button
									variant="primary"
									size="md"
									onClick={() => link("osu")}
									disabled={!status.osu.configured || busy === "osu"}
								>
									{busy === "osu" ? "Continuing…" : "Link osu!"}
								</Button>
							)}
						</div>
					</li>

					<li className="card">
						<div className="meta">
							<strong>Last.fm</strong>
							<span>
								{status.lastfm.linked
									? `Linked as ${status.lastfm.username}`
									: status.lastfm.configured
										? "Not linked"
										: "OAuth not configured on this server"}
							</span>
						</div>
						<div className="actions">
							{status.lastfm.linked ? (
								<Button
									variant="ghost"
									size="md"
									onClick={() => void unlink("lastfm")}
								>
									{busy === "lastfm" ? "Unlinking…" : "Unlink"}
								</Button>
							) : (
								<Button
									variant="primary"
									size="md"
									onClick={() => link("lastfm")}
									disabled={!status.lastfm.configured || busy === "lastfm"}
								>
									{busy === "lastfm" ? "Continuing…" : "Link Last.fm"}
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
