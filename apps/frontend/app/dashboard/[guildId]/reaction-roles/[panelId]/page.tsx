"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import type { GuildEmojiOption } from "@/components/emoji-picker"
import { apiFetch } from "@/lib/api"
import type { SettingsOptions } from "@/lib/message-config"
import type { ReactionRolePanel } from "@/lib/reaction-roles"
import PanelForm from "../panel-form"
import "../reaction-roles.css"

export default function EditReactionRolePage() {
	const params = useParams<{ guildId: string; panelId: string }>()
	const guildId = params.guildId
	const panelId = params.panelId
	const [panel, setPanel] = useState<ReactionRolePanel | null>(null)
	const [options, setOptions] = useState<SettingsOptions | null>(null)
	const [emojis, setEmojis] = useState<GuildEmojiOption[]>([])
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		try {
			const [list, opts, guildEmojis] = await Promise.all([
				apiFetch<ReactionRolePanel[]>(`/guilds/${guildId}/reaction-roles`),
				apiFetch<SettingsOptions>(`/guilds/${guildId}/settings/options`),
				apiFetch<GuildEmojiOption[]>(
					`/guilds/${guildId}/reaction-roles/emojis`,
				),
			])
			const found = list.find((p) => p.id === panelId) ?? null
			if (!found) {
				setError("Panel not found.")
				return
			}
			setPanel(found)
			setOptions(opts)
			setEmojis(guildEmojis)
			setError(null)
		} catch {
			setError("Could not load panel.")
		}
	}, [guildId, panelId])

	useEffect(() => {
		void load()
	}, [load])

	if (error) {
		return (
			<div className="reaction-roles">
				<div className="head">
					<h1 className="title">Reaction roles</h1>
					<p className="lead">{error}</p>
				</div>
			</div>
		)
	}

	if (!panel || !options) {
		return (
			<div className="reaction-roles">
				<div className="head">
					<h1 className="title">Reaction roles</h1>
					<p className="lead">Loading…</p>
				</div>
			</div>
		)
	}

	return (
		<div className="reaction-roles">
			<div className="head">
				<h1 className="title">Reaction roles</h1>
				<p className="lead">
					Members click an emoji under a message and get a role.
				</p>
			</div>
			<PanelForm
				guildId={guildId}
				mode="edit"
				panel={panel}
				options={options}
				guildEmojis={emojis}
			/>
		</div>
	)
}
