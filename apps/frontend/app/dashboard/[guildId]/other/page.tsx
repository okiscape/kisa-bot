"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { FormRow, SelectField } from "@/components/form-controls"
import SettingsSaveBar from "@/components/settings-save-bar"
import { apiFetch } from "@/lib/api"
import type { GuildSettings } from "@/lib/guild-settings"
import type { SettingsOptions } from "@/lib/message-config"

type OtherForm = {
	ticketCategory: string | null
	privateCrChannel: string | null
	privateCategory: string | null
	honeypotChannel: string | null
}

function fromSettings(s: GuildSettings): OtherForm {
	return {
		ticketCategory: s.ticketCategory,
		privateCrChannel: s.privateCrChannel,
		privateCategory: s.privateCategory,
		honeypotChannel: s.honeypotChannel,
	}
}

export default function OtherPage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const [form, setForm] = useState<OtherForm | null>(null)
	const [saved, setSaved] = useState<OtherForm | null>(null)
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
			setError("Could not load other settings.")
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
					ticketCategory: form.ticketCategory,
					privateCrChannel: form.privateCrChannel,
					privateCategory: form.privateCategory,
					honeypotChannel: form.honeypotChannel,
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
				<h1 className="title">Other</h1>
				<p className="lead">{error}</p>
			</div>
		)
	}

	if (!form) {
		return (
			<div className="section-page">
				<h1 className="title">Other</h1>
				<p className="lead">Loading…</p>
			</div>
		)
	}

	const channels = (options?.channels ?? []).map((c) => ({
		value: c.id,
		label: c.type === 4 ? `${c.name} (${c.id})` : `#${c.name} (${c.id})`,
	}))
	const categories = (options?.channels ?? [])
		.filter((c) => c.type === 4)
		.map((c) => ({ value: c.id, label: `${c.name} (${c.id})` }))

	return (
		<div className="settings-page">
			<header className="head">
				<h1 className="title">Other</h1>
				<p className="lead">Tickets, private rooms, and honeypot.</p>
			</header>

			<div className="form">
				<FormRow label="Ticket category" hint="Category for ticket channels.">
					<SelectField
						value={form.ticketCategory}
						onChange={(ticketCategory) => setForm({ ...form, ticketCategory })}
						options={categories}
						placeholder="Select category"
					/>
				</FormRow>

				<FormRow label="Private create" hint="Voice channel that spawns private rooms.">
					<SelectField
						value={form.privateCrChannel}
						onChange={(privateCrChannel) => setForm({ ...form, privateCrChannel })}
						options={channels}
						placeholder="Select channel"
					/>
				</FormRow>

				<FormRow label="Private category" hint="Where private rooms are created.">
					<SelectField
						value={form.privateCategory}
						onChange={(privateCategory) => setForm({ ...form, privateCategory })}
						options={categories}
						placeholder="Select category"
					/>
				</FormRow>

				<FormRow label="Honeypot" hint="Trap channel for spam bots.">
					<SelectField
						value={form.honeypotChannel}
						onChange={(honeypotChannel) => setForm({ ...form, honeypotChannel })}
						options={channels}
						placeholder="Select channel"
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
