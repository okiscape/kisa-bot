"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import type { GuildSettings } from "@/lib/guild-settings"
import {
	emptyMessageConfig,
	type MessageConfig,
	type SettingsOptions,
} from "@/lib/message-config"
import MessageEditor from "./message-editor"
import "./greeting.css"

type Tab = "greeting" | "farewell"

export default function GreetingPage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId

	const [tab, setTab] = useState<Tab>("greeting")
	const [options, setOptions] = useState<SettingsOptions | null>(null)
	const [greeting, setGreeting] = useState<MessageConfig>(emptyMessageConfig())
	const [farewell, setFarewell] = useState<MessageConfig>(emptyMessageConfig())
	const [savedGreeting, setSavedGreeting] = useState<MessageConfig>(emptyMessageConfig())
	const [savedFarewell, setSavedFarewell] = useState<MessageConfig>(emptyMessageConfig())
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [status, setStatus] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const [settings, opts] = await Promise.all([
				apiFetch<GuildSettings>(`/guilds/${guildId}/settings`),
				apiFetch<SettingsOptions>(`/guilds/${guildId}/settings/options`),
			])
			const g = settings.greetingConfig ?? emptyMessageConfig()
			const f = settings.farewellConfig ?? emptyMessageConfig()
			setGreeting(g)
			setFarewell(f)
			setSavedGreeting(g)
			setSavedFarewell(f)
			setOptions(opts)
		} catch {
			setError("Could not load greeting settings.")
		} finally {
			setLoading(false)
		}
	}, [guildId])

	useEffect(() => {
		void load()
	}, [load])

	const active = tab === "greeting" ? greeting : farewell
	const saved = tab === "greeting" ? savedGreeting : savedFarewell
	const dirty = useMemo(
		() => JSON.stringify(active) !== JSON.stringify(saved),
		[active, saved],
	)

	async function save() {
		setSaving(true)
		setStatus(null)
		try {
			const body =
				tab === "greeting"
					? { greetingConfig: greeting }
					: { farewellConfig: farewell }
			const updated = await apiFetch<GuildSettings>(`/guilds/${guildId}/settings`, {
				method: "PATCH",
				body,
			})
			const g = updated.greetingConfig ?? emptyMessageConfig()
			const f = updated.farewellConfig ?? emptyMessageConfig()
			setGreeting(g)
			setFarewell(f)
			setSavedGreeting(g)
			setSavedFarewell(f)
			setStatus("Saved")
		} catch {
			setStatus("Save failed")
		} finally {
			setSaving(false)
		}
	}

	function reset() {
		if (tab === "greeting") setGreeting(savedGreeting)
		else setFarewell(savedFarewell)
		setStatus(null)
	}

	if (loading) {
		return (
			<div className="section-page">
				<h1 className="title">Greeting</h1>
				<p className="lead">Loading settings…</p>
			</div>
		)
	}

	if (error) {
		return (
			<div className="section-page">
				<h1 className="title">Greeting</h1>
				<p className="lead">{error}</p>
			</div>
		)
	}

	return (
		<div className="greeting">
			<header className="head">
				<div className="tabs" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={tab === "greeting"}
						className={`tab${tab === "greeting" ? " on" : ""}`}
						onClick={() => setTab("greeting")}
					>
						Greeting
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={tab === "farewell"}
						className={`tab${tab === "farewell" ? " on" : ""}`}
						onClick={() => setTab("farewell")}
					>
						Farewell
					</button>
				</div>
				<p className="lead">
					{tab === "greeting"
						? "Message posted when someone joins the server."
						: "Message posted when someone leaves the server."}
				</p>
			</header>

			<MessageEditor
				key={tab}
				title={tab === "greeting" ? "Welcome" : "Goodbye"}
				value={active}
				options={options}
				defaultEmbedColor={tab === "greeting" ? "#82E868" : "#FD4C3C"}
				onChange={tab === "greeting" ? setGreeting : setFarewell}
				onSave={save}
				onReset={reset}
				saving={saving}
				dirty={dirty}
				status={status}
			/>
		</div>
	)
}
