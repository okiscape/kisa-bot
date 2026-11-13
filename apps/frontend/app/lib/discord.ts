export type SessionUser = {
	id: string
	username: string
	global_name: string | null
	avatar: string | null
	banner: string | null
	accent_color: number | null
}

export type GuildDiscoveryItem = {
	id: string
	name: string
	iconUrl: string | null
	owner: boolean
	permissions: string
	isAdmin: boolean
	isManageable: boolean
	hasBot: boolean
	canInviteBot: boolean
	botInviteUrl: string | null
}

export function displayName(user: SessionUser): string {
	return user.global_name || user.username
}

export function discordAvatarUrl(
	userId: string,
	avatar: string | null,
	size = 128,
): string {
	if (avatar) {
		const ext = avatar.startsWith("a_") ? "gif" : "png"
		return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=${size}`
	}
	// Discord default avatar index for users without a custom avatar.
	let index = 0
	try {
		index = Number((BigInt(userId) >> BigInt(22)) % BigInt(6))
	} catch {
		index = 0
	}
	return `https://cdn.discordapp.com/embed/avatars/${index}.png`
}

export function discordBannerUrl(
	userId: string,
	banner: string | null,
	size = 600,
): string | null {
	if (!banner) return null
	const ext = banner.startsWith("a_") ? "gif" : "png"
	return `https://cdn.discordapp.com/banners/${userId}/${banner}.${ext}?size=${size}`
}

export function accentToCss(accent: number | null | undefined): string | null {
	if (accent == null || !Number.isFinite(accent)) return null
	return `#${accent.toString(16).padStart(6, "0")}`
}

export function guildIconUrl(
	guildId: string,
	iconHash: string | null | undefined,
	iconUrl: string | null | undefined,
	size = 128,
): string | null {
	if (iconUrl) return iconUrl
	if (!iconHash) return null
	const ext = iconHash.startsWith("a_") ? "gif" : "png"
	return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=${size}`
}
