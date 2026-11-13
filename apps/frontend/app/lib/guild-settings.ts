import type { MessageConfig } from "./message-config"

export type LoggingRule = {
	channelId: string | null
	webhookUrl: string | null
	eventType: string
	ignoreItems: string[]
}

export type ReactionRole = {
	emoji: string
	roleId: string
	messageId: string | null
}

export type GuildSettings = {
	guildId: string
	averageLanguage: string | null
	badWords: string | null
	notifiedModerators: string | null
	notifyChannel: string | null
	badWordsAction: string | null
	joinChannel: string | null
	leaveChannel: string | null
	postChannel: string | null
	muteRole: string | null
	autoRole: string | null
	logChannel: string | null
	verifiedRole: string | null
	ticketCategory: string | null
	fareText: string | null
	fareColor: string | null
	fareImage: string | null
	greetText: string | null
	greetColor: string | null
	greetImage: string | null
	privateCrChannel: string | null
	privateCategory: string | null
	customGreet: string | null
	customFare: string | null
	notifyText: string | null
	collectMetrics: boolean | null
	greetingConfig: MessageConfig
	farewellConfig: MessageConfig
	loggingConfig: LoggingRule[]
	honeypotChannel: string | null
	reactionRoles: ReactionRole[]
}

export type GuildDetail = {
	id: string
	name: string
	iconUrl: string | null
	hasBot: boolean
	botInviteUrl: string | null
	owner: boolean
	isAdmin: boolean
}
