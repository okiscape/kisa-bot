"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import type { GuildEmojiOption } from "@/components/emoji-picker"
import { apiFetch } from "@/lib/api"
import type { SettingsOptions } from "@/lib/message-config"
import PanelForm from "../panel-form"
import "../reaction-roles.css"

export default function NewReactionRolePage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const [options, setOptions] = useState<SettingsOptions | null>(null)
	const [emojis, setEmojis] = useState<GuildEmojiOption[]>([])
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		try {
			const [opts, guildEmojis] = await Promise.all([
				apiFetch<SettingsOptions>(`/guilds/${guildId}/settings/options`),
				apiFetch<GuildEmojiOption[]>(
					`/guilds/${guildId}/reaction-roles/emojis`,
				),
			])
			setOptions(opts)
			setEmojis(guildEmojis)
			setError(null)
		} catch {
			setError("Could not load form data.")
		}
	}, [guildId])

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

	if (!options) {
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
				mode="create"
				options={options}
				guildEmojis={emojis}
			/>
		</div>
	)
}
