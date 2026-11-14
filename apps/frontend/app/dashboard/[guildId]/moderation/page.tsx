"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { FormRow, SelectField, TextAreaField } from "@/components/form-controls"
import SettingsSaveBar from "@/components/settings-save-bar"
import { apiFetch } from "@/lib/api"
import type { GuildSettings } from "@/lib/guild-settings"
import type { SettingsOptions } from "@/lib/message-config"

type ModerationForm = {
	badWords: string
	badWordsAction: string | null
	muteRole: string | null
	notifyChannel: string | null
	notifiedModerators: string
	notifyText: string
}

function fromSettings(s: GuildSettings): ModerationForm {
	return {
		badWords: s.badWords ?? "",
		badWordsAction: s.badWordsAction,
		muteRole: s.muteRole,
		notifyChannel: s.notifyChannel,
		notifiedModerators: s.notifiedModerators ?? "",
		notifyText: s.notifyText ?? "",
	}
}

export default function ModerationPage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const [form, setForm] = useState<ModerationForm | null>(null)
	const [saved, setSaved] = useState<ModerationForm | null>(null)
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
			const next = fromSettings(settings)
			setForm(next)
			setSaved(next)
			setOptions(opts)
		} catch {
			setError("Could not load moderation settings.")
		}
	}, [guildId])

	useEffect(() => {
		void load()
	}, [load])

	const dirty = useMemo(
		() => JSON.stringify(form) !== JSON.stringify(saved),
		[form, saved],
	)

	async function save() {
		if (!form) return
		setSaving(true)
		setStatus(null)
		try {
			const updated = await apiFetch<GuildSettings>(`/guilds/${guildId}/settings`, {
				method: "PATCH",
				body: {
					badWords: form.badWords || null,
					badWordsAction: form.badWordsAction,
					muteRole: form.muteRole,
					notifyChannel: form.notifyChannel,
					notifiedModerators: form.notifiedModerators || null,
					notifyText: form.notifyText || null,
				},
			})
			const next = fromSettings(updated)
			setForm(next)
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
				<h1 className="title">Moderation</h1>
				<p className="lead">{error}</p>
			</div>
		)
	}

	if (!form) {
		return (
			<div className="section-page">
				<h1 className="title">Moderation</h1>
				<p className="lead">Loading…</p>
			</div>
		)
	}

	const roles = (options?.roles ?? [])
		.slice()
		.sort((a, b) => b.position - a.position)
		.map((r) => ({ value: r.id, label: `${r.name} (${r.id})` }))
	const channels = (options?.channels ?? [])
		.filter((c) => c.type === 0 || c.type === 5)
		.map((c) => ({ value: c.id, label: `#${c.name} (${c.id})` }))

	return (
		<div className="settings-page">
			<header className="head">
				<h1 className="title">Moderation</h1>
				<p className="lead">Bad words filter, mute role, and moderator alerts.</p>
			</header>

			<div className="form">
				<FormRow label="Bad words" hint="Comma-separated list of blocked words.">
					<TextAreaField
						value={form.badWords}
						onChange={(badWords) => setForm({ ...form, badWords })}
						maxLength={4000}
						placeholder="word1, word2, …"
					/>
				</FormRow>

				<FormRow label="Action" hint="What happens when a bad word is used.">
					<SelectField
						value={form.badWordsAction}
						onChange={(badWordsAction) => setForm({ ...form, badWordsAction })}
						options={[
							{ value: "delete", label: "Delete" },
							{ value: "warn", label: "Warn" },
							{ value: "mute", label: "Mute" },
							{ value: "none", label: "None" },
						]}
						placeholder="Select action"
					/>
				</FormRow>

				<FormRow label="Mute role" hint="Role applied when the mute action fires.">
					<SelectField
						value={form.muteRole}
						onChange={(muteRole) => setForm({ ...form, muteRole })}
						options={roles}
						placeholder="Select role"
					/>
				</FormRow>

				<FormRow label="Notify channel" hint="Where moderator alerts are posted.">
					<SelectField
						value={form.notifyChannel}
						onChange={(notifyChannel) => setForm({ ...form, notifyChannel })}
						options={channels}
						placeholder="Select channel"
					/>
				</FormRow>

				<FormRow label="Moderators" hint="Comma-separated Discord user IDs.">
					<TextAreaField
						value={form.notifiedModerators}
						onChange={(notifiedModerators) =>
							setForm({ ...form, notifiedModerators })
						}
						placeholder="123…, 456…"
					/>
				</FormRow>

				<FormRow label="Notify text" hint="Optional custom alert template.">
					<TextAreaField
						value={form.notifyText}
						onChange={(notifyText) => setForm({ ...form, notifyText })}
					/>
				</FormRow>

				<SettingsSaveBar
					dirty={dirty}
					saving={saving}
					status={status}
					onReset={() => {
						if (saved) setForm(saved)
						setStatus(null)
					}}
					onSave={() => void save()}
				/>
			</div>
		</div>
	)
}
