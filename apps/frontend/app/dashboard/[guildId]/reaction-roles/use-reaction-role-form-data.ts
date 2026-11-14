"use client"

import { useCallback, useEffect, useState } from "react"
import type { GuildEmojiOption } from "@/components/emoji-picker"
import { apiFetch } from "@/lib/api"
import type { SettingsOptions } from "@/lib/message-config"
import type { ReactionRolePanel } from "@/lib/reaction-roles"

type FormData = {
	options: SettingsOptions
	emojis: GuildEmojiOption[]
	panel: ReactionRolePanel | null
}

export function useReactionRoleFormData(
	guildId: string,
	panelId?: string,
) {
	const [data, setData] = useState<FormData | null>(null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		try {
			const requests: [
				Promise<SettingsOptions>,
				Promise<GuildEmojiOption[]>,
				Promise<ReactionRolePanel> | null,
			] = [
				apiFetch<SettingsOptions>(`/guilds/${guildId}/settings/options`),
				apiFetch<GuildEmojiOption[]>(
					`/guilds/${guildId}/reaction-roles/emojis`,
				),
				panelId
					? apiFetch<ReactionRolePanel>(
							`/guilds/${guildId}/reaction-roles/${panelId}`,
						)
					: null,
			]

			const [opts, guildEmojis, panel] = await Promise.all([
				requests[0],
				requests[1],
				requests[2] ?? Promise.resolve(null),
			])

			setData({ options: opts, emojis: guildEmojis, panel })
			setError(null)
		} catch {
			setError(
				panelId ? "Could not load panel." : "Could not load form data.",
			)
			setData(null)
		}
	}, [guildId, panelId])

	useEffect(() => {
		void load()
	}, [load])

	return { data, error }
}
