"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Switch from "@/components/switch"
import { FormRow, SelectField } from "@/components/form-controls"
import SettingsSaveBar from "@/components/settings-save-bar"
import { apiFetch } from "@/lib/api"
import type { GuildSettings, ReactionRole } from "@/lib/guild-settings"
import type { SettingsOptions } from "@/lib/message-config"

type OtherForm = {
	autoRole: string | null
	verifiedRole: string | null
	ticketCategory: string | null
	privateCrChannel: string | null
	privateCategory: string | null
	collectMetrics: boolean
	honeypotChannel: string | null
	reactionRoles: ReactionRole[]
}

function fromSettings(s: GuildSettings): OtherForm {
	return {
		autoRole: s.autoRole,
		verifiedRole: s.verifiedRole,
		ticketCategory: s.ticketCategory,
		privateCrChannel: s.privateCrChannel,
		privateCategory: s.privateCategory,
		collectMetrics: Boolean(s.collectMetrics),
		honeypotChannel: s.honeypotChannel,
		reactionRoles: s.reactionRoles ?? [],
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
					autoRole: form.autoRole,
					verifiedRole: form.verifiedRole,
					ticketCategory: form.ticketCategory,
					privateCrChannel: form.privateCrChannel,
					privateCategory: form.privateCategory,
					collectMetrics: form.collectMetrics,
					honeypotChannel: form.honeypotChannel,
					reactionRoles: form.reactionRoles.filter((r) => r.emoji && r.roleId),
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

	const roles = (options?.roles ?? [])
		.slice()
		.sort((a, b) => b.position - a.position)
		.map((r) => ({ value: r.id, label: r.name }))
	const channels = (options?.channels ?? []).map((c) => ({
		value: c.id,
		label: c.type === 4 ? c.name : `#${c.name}`,
	}))
	const categories = (options?.channels ?? [])
		.filter((c) => c.type === 4)
		.map((c) => ({ value: c.id, label: c.name }))

	return (
		<div className="settings-page">
			<header className="head">
				<h1 className="title">Other</h1>
				<p className="lead">Roles, tickets, private rooms, and metrics collection.</p>
			</header>

			<div className="form">
				<FormRow label="Auto role" hint="Given automatically on join.">
					<SelectField
						value={form.autoRole}
						onChange={(autoRole) => setForm({ ...form, autoRole })}
						options={roles}
						placeholder="Select role"
					/>
				</FormRow>

				<FormRow label="Verified role" hint="Role used for verification flows.">
					<SelectField
						value={form.verifiedRole}
						onChange={(verifiedRole) => setForm({ ...form, verifiedRole })}
						options={roles}
						placeholder="Select role"
					/>
				</FormRow>

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

				<FormRow label="Collect metrics" hint="Allow this guild in public counters.">
					<Switch
						checked={form.collectMetrics}
						onChange={(collectMetrics) => setForm({ ...form, collectMetrics })}
						aria-label="Collect metrics"
					/>
				</FormRow>

				<FormRow label="Reaction roles" hint="Emoji → role mappings.">
					<div className="stack">
						{form.reactionRoles.map((rule, index) => (
							<div key={index} className="reaction-row">
								<input
									className="webhook-input"
									placeholder="Emoji"
									value={rule.emoji}
									onChange={(e) => {
										const reactionRoles = [...form.reactionRoles]
										reactionRoles[index] = { ...rule, emoji: e.target.value }
										setForm({ ...form, reactionRoles })
									}}
								/>
								<SelectField
									value={rule.roleId || null}
									onChange={(roleId) => {
										const reactionRoles = [...form.reactionRoles]
										reactionRoles[index] = { ...rule, roleId: roleId ?? "" }
										setForm({ ...form, reactionRoles })
									}}
									options={roles}
									placeholder="Select role"
								/>
							</div>
						))}
						<button
							type="button"
							className="add-embed"
							onClick={() =>
								setForm({
									...form,
									reactionRoles: [
										...form.reactionRoles,
										{ emoji: "", roleId: "", messageId: null },
									],
								})
							}
						>
							Add reaction role
						</button>
					</div>
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
