import {
	emptyEmbed,
	emptyEmbedField,
	type MessageEmbedConfig,
	type MessageEmbedField,
} from "@/lib/message-config"

export type ReactionRoleMode = "post_embed" | "post_message" | "existing"
export type ReactionRoleType = "normal" | "verify" | "unique"
export type ReactionRoleEmbed = MessageEmbedConfig
export type { MessageEmbedField }

export type ReactionRolePair = {
	id?: string
	emoji: string
	roleId: string
	position?: number
}

export type ReactionRolePanel = {
	id: string
	guildId: string
	channelId: string
	messageId: string | null
	mode: ReactionRoleMode
	type: ReactionRoleType
	content: string
	embed: ReactionRoleEmbed | null
	botOwned: boolean
	pairs: ReactionRolePair[]
	createdAt: string
	updatedAt: string
}

export type ReactionRoleDraftPair = {
	key: string
	emoji: string | null
	roleId: string | null
}

export type ReactionRoleDraft = {
	mode: ReactionRoleMode
	type: ReactionRoleType
	channelId: string | null
	messageRef: string
	content: string
	embed: ReactionRoleEmbed
	embedOpen: boolean
	pairs: ReactionRoleDraftPair[]
}

export const MAX_PANELS = 20
export const MAX_PAIRS = 15
export const MAX_EMBED_FIELDS = 25
export const DEFAULT_EMBED_COLOR = "#EEBA93"

export { emptyEmbed, emptyEmbedField }

let pairKeySeq = 0
export function nextPairKey() {
	pairKeySeq += 1
	return `pair-${pairKeySeq}`
}

export function emptyDraft(): ReactionRoleDraft {
	return {
		mode: "post_embed",
		type: "normal",
		channelId: null,
		messageRef: "",
		content: "Pick your roles below.",
		embed: {
			...emptyEmbed(),
			title: "Choose your roles",
			description: "Click an emoji to get a role.",
			color: DEFAULT_EMBED_COLOR,
		},
		embedOpen: true,
		pairs: [
			{ key: nextPairKey(), emoji: null, roleId: null },
			{ key: nextPairKey(), emoji: null, roleId: null },
		],
	}
}

export function panelToDraft(panel: ReactionRolePanel): ReactionRoleDraft {
	const embed = panel.embed
		? { ...emptyEmbed(), ...panel.embed, fields: panel.embed.fields ?? [] }
		: {
				...emptyEmbed(),
				color: DEFAULT_EMBED_COLOR,
			}
	return {
		mode: panel.mode,
		type: panel.type,
		channelId: panel.channelId,
		messageRef: panel.messageId ?? "",
		content: panel.content ?? "",
		embed,
		embedOpen: true,
		pairs: panel.pairs.length
			? panel.pairs.map((p) => ({
					key: p.id ?? nextPairKey(),
					emoji: p.emoji,
					roleId: p.roleId,
				}))
			: [{ key: nextPairKey(), emoji: null, roleId: null }],
	}
}

export function draftToPayload(draft: ReactionRoleDraft) {
	const pairs = draft.pairs
		.filter((p): p is ReactionRoleDraftPair & { emoji: string; roleId: string } =>
			Boolean(p.emoji && p.roleId),
		)
		.map((p) => ({ emoji: p.emoji, roleId: p.roleId }))

	const embed =
		draft.mode === "post_embed"
			? {
					...draft.embed,
					fields: (draft.embed.fields ?? []).filter(
						(f) => f.name.trim() || f.value.trim(),
					),
				}
			: null

	return {
		mode: draft.mode,
		type: draft.type,
		channelId: draft.channelId,
		messageRef: draft.mode === "existing" ? draft.messageRef || null : null,
		content: draft.content,
		embed,
		pairs,
	}
}

export function roleColorHex(color: number | undefined | null): string {
	if (!color) return "#a8a29e"
	return `#${color.toString(16).padStart(6, "0")}`
}
