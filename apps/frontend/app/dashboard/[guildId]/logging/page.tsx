"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Button from "@/components/button"
import { FormRow, SelectField } from "@/components/form-controls"
import SettingsSaveBar from "@/components/settings-save-bar"
import { apiFetch } from "@/lib/api"
import type { GuildSettings, LoggingRule } from "@/lib/guild-settings"
import type { SettingsOptions } from "@/lib/message-config"

const EVENT_TYPES = [
	{ value: "all", label: "All events" },
	{ value: "message_delete", label: "Message delete" },
	{ value: "message_edit", label: "Message edit" },
	{ value: "member_join", label: "Member join" },
	{ value: "member_leave", label: "Member leave" },
	{ value: "member_ban", label: "Member ban" },
	{ value: "channel_update", label: "Channel update" },
	{ value: "role_update", label: "Role update" },
]

function emptyRule(): LoggingRule {
	return {
		channelId: null,
		webhookUrl: null,
		eventType: "all",
		ignoreItems: [],
	}
}

export default function LoggingPage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const [rules, setRules] = useState<LoggingRule[] | null>(null)
	const [saved, setSaved] = useState<LoggingRule[] | null>(null)
	const [options, setOptions] = useState<SettingsOptions | null>(null)
	const [saving, setSaving] = useState(false)
	const [status, setStatus] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		try {
			const [settings, opts] = await Promise.all([
				apiFetch<GuildSettings>(`/guilds/${guildId}/settings`),
				apiFetch<SettingsOptions>(`/guilds/${guildId}/settings/options`),
			])
			const next = settings.loggingConfig?.length
				? settings.loggingConfig
				: [emptyRule()]
			setRules(next)
			setSaved(next)
			setOptions(opts)
		} catch {
			setError("Could not load logging settings.")
		}
	}, [guildId])

	useEffect(() => {
		void load()
	}, [load])

	const dirty = useMemo(
		() => JSON.stringify(rules) !== JSON.stringify(saved),
		[rules, saved],
	)

	async function save() {
		if (!rules) return
		setSaving(true)
		setStatus(null)
		try {
			const cleaned = rules.filter((r) => r.channelId || r.webhookUrl)
			const updated = await apiFetch<GuildSettings>(`/guilds/${guildId}/settings`, {
				method: "PATCH",
				body: { loggingConfig: cleaned },
			})
			const next = updated.loggingConfig?.length ? updated.loggingConfig : [emptyRule()]
			setRules(next)
			setSaved(next)
			setStatus("Saved")
		} catch {
			setStatus("Save failed")
		} finally {
			setSaving(false)
		}
	}

	if (error) {
		return (
			<div className="section-page">
				<h1 className="title">Logging</h1>
				<p className="lead">{error}</p>
			</div>
		)
	}

	if (!rules) {
		return (
			<div className="section-page">
				<h1 className="title">Logging</h1>
				<p className="lead">Loading…</p>
			</div>
		)
	}

	const channels = (options?.channels ?? [])
		.filter((c) => c.type === 0 || c.type === 5)
		.map((c) => ({ value: c.id, label: `#${c.name}` }))

	return (
		<div className="settings-page">
			<header className="head">
				<h1 className="title">Logging</h1>
				<p className="lead">Route audit events to channels or webhooks.</p>
			</header>

			<div className="form">
				{rules.map((rule, index) => (
					<FormRow
						key={index}
						label={`Rule ${index + 1}`}
						hint="Event type and destination channel."
					>
						<div className="stack">
							<SelectField
								value={rule.eventType}
								onChange={(eventType) => {
									const next = [...rules]
									next[index] = { ...rule, eventType: eventType ?? "all" }
									setRules(next)
								}}
								options={EVENT_TYPES}
							/>
							<SelectField
								value={rule.channelId}
								onChange={(channelId) => {
									const next = [...rules]
									next[index] = { ...rule, channelId }
									setRules(next)
								}}
								options={channels}
								placeholder="Select channel"
							/>
							<input
								className="webhook-input"
								type="url"
								placeholder="Optional webhook URL"
								value={rule.webhookUrl ?? ""}
								onChange={(e) => {
									const next = [...rules]
									next[index] = {
										...rule,
										webhookUrl: e.target.value || null,
									}
									setRules(next)
								}}
							/>
							{rules.length > 1 ? (
								<button
									type="button"
									className="add-embed"
									onClick={() => setRules(rules.filter((_, i) => i !== index))}
								>
									Remove rule
								</button>
							) : null}
						</div>
					</FormRow>
				))}

				<div className="rule-actions">
					<Button
						variant="ghost"
						size="md"
						onClick={() => setRules([...rules, emptyRule()])}
					>
						Add rule
					</Button>
				</div>

				<SettingsSaveBar
					dirty={dirty}
					saving={saving}
					status={status}
					onReset={() => {
						if (saved) setRules(saved)
						setStatus(null)
					}}
					onSave={() => void save()}
				/>
			</div>
		</div>
	)
}
