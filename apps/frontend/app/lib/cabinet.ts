export const TIMEZONES = [
	"UTC-12",
	"UTC-11",
	"UTC-10",
	"UTC-9",
	"UTC-8",
	"UTC-7",
	"UTC-6",
	"UTC-5",
	"UTC-4",
	"UTC-3",
	"UTC-2",
	"UTC-1",
	"UTC",
	"UTC+1",
	"UTC+2",
	"UTC+3",
	"UTC+4",
	"UTC+5",
	"UTC+6",
	"UTC+7",
	"UTC+8",
	"UTC+9",
	"UTC+10",
	"UTC+11",
	"UTC+12",
] as const

export type CabinetSection = "profile" | "integrations" | "servers"

export type UserProfileDto = {
	userId: string
	aboutMe: string | null
	color: string | null
	customImage: string | null
}

export type UserSettingsDto = {
	userId: string
	timezone: string | null
	osuUsername: string | null
}

export type IntegrationStatus = {
	osu: {
		linked: boolean
		username: string | null
		userId: string | null
		configured: boolean
		pp: number | null
		globalRank: number | null
	}
	lastfm: {
		linked: boolean
		username: string | null
		configured: boolean
		scrobbles: number | null
		topArtistWeek: string | null
	}
}

export type DiscordProfileDto = {
	id: string
	username: string
	globalName: string | null
	avatar: string | null
	avatarUrl: string
	banner: string | null
	bannerUrl: string | null
	accentColor: number | null
}

export function normalizeHexColor(value: string): string {
	return value.trim().replace(/^#/, "").toLowerCase()
}

export function colorToCss(value: string | null | undefined): string {
	if (!value) return "#5865f2"
	const hex = normalizeHexColor(value)
	return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : "#5865f2"
}
