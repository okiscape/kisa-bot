export type MessageEmbedConfig = {
	title: string | null
	description: string | null
	color: string | null
	url: string | null
	authorName: string | null
	authorIconUrl: string | null
	authorUrl: string | null
	footerText: string | null
	footerIconUrl: string | null
	thumbnailUrl: string | null
	imageUrl: string | null
}

export type MessageConfig = {
	enabled: boolean
	channelId: string | null
	sender: "bot" | "webhook"
	webhookUrl: string | null
	content: string
	embeds: MessageEmbedConfig[]
}

export type SettingsOptions = {
	channels: Array<{
		id: string
		type: number
		name: string
		position: number
		parentId: string | null
	}>
	roles: Array<{ id: string; name: string; color: number; position: number }>
}

export function emptyEmbed(): MessageEmbedConfig {
	return {
		title: null,
		description: null,
		color: "#82E868",
		url: null,
		authorName: null,
		authorIconUrl: null,
		authorUrl: null,
		footerText: null,
		footerIconUrl: null,
		thumbnailUrl: null,
		imageUrl: null,
	}
}

export function emptyMessageConfig(): MessageConfig {
	return {
		enabled: false,
		channelId: null,
		sender: "bot",
		webhookUrl: null,
		content: "",
		embeds: [],
	}
}

export function renderPreviewText(
	template: string,
	vars: Record<string, string>,
): string {
	let out = template
	for (const [key, value] of Object.entries(vars)) {
		out = out.split(`{{${key}}}`).join(value)
	}
	return out
}

export const TEMPLATE_VARS = [
	{ key: "mention", label: "{{mention}}" },
	{ key: "server", label: "{{server}}" },
	{ key: "count", label: "{{count}}" },
	{ key: "channel", label: "{{channel}}" },
] as const

/** Discord text channel types used in channel pickers. */
export const TEXTISH_CHANNEL_TYPES = new Set([0, 5, 11, 12])
