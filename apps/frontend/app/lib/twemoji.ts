/** Twemoji CDN helpers (Twitter emoji images). */

const TWEMOJI_BASE =
	"https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72"

/** Convert a unicode emoji to a Twemoji hex filename (no .png). */
export function twemojiCodepoint(emoji: string): string {
	const cps: string[] = []
	for (const ch of emoji) {
		const cp = ch.codePointAt(0)
		if (cp === undefined) continue
		// Skip variation selector-16 in path building — Twemoji often omits FE0F
		if (cp === 0xfe0f) continue
		cps.push(cp.toString(16))
	}
	return cps.join("-")
}

export function twemojiUrl(emoji: string): string {
	return `${TWEMOJI_BASE}/${twemojiCodepoint(emoji)}.png`
}

const CUSTOM_RE = /^(a:)?([\w-]{2,32}):(\d{17,20})$/

export function isCustomEmojiKey(key: string): boolean {
	return CUSTOM_RE.test(key.trim())
}

export function customEmojiUrl(key: string): string | null {
	const m = key.trim().match(CUSTOM_RE)
	if (!m) return null
	const animated = Boolean(m[1])
	const id = m[3]
	return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=64&quality=lossless`
}

export function customEmojiName(key: string): string | null {
	const m = key.trim().match(CUSTOM_RE)
	return m ? m[2] : null
}

/** Renderable image URL for a stored emoji key (unicode or custom). */
export function emojiImageUrl(key: string): string | null {
	if (isCustomEmojiKey(key)) return customEmojiUrl(key)
	if (!key.trim()) return null
	return twemojiUrl(key)
}
