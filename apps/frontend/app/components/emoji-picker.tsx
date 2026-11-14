"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EMOJI_CATEGORIES } from "@/lib/emoji-data"
import { customEmojiUrl, emojiImageUrl, twemojiUrl } from "@/lib/twemoji"
import "./emoji-picker.css"

export type GuildEmojiOption = {
	id: string
	name: string
	animated: boolean
	available: boolean
	url: string
	key: string
}

type Props = {
	value: string | null
	guildEmojis: GuildEmojiOption[]
	onChange: (emojiKey: string) => void
	disabled?: boolean
	/** Emoji keys already used elsewhere; shown grayed out and not selectable. */
	disabledKeys?: ReadonlySet<string> | readonly string[]
}

export default function EmojiPicker({
	value,
	guildEmojis,
	onChange,
	disabled = false,
	disabledKeys,
}: Props) {
	const [open, setOpen] = useState(false)
	const [tab, setTab] = useState<"guild" | "unicode">(
		guildEmojis.length ? "guild" : "unicode",
	)
	const [category, setCategory] = useState(EMOJI_CATEGORIES[0]?.id ?? "smileys")
	const [query, setQuery] = useState("")
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		function onDoc(e: MouseEvent) {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false)
		}
		document.addEventListener("mousedown", onDoc)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onDoc)
			document.removeEventListener("keydown", onKey)
		}
	}, [open])

	const previewUrl = value ? emojiImageUrl(value) : null
	const previewLabel = value
		? value.includes(":")
			? `:${value.split(":")[value.startsWith("a:") ? 1 : 0]}:`
			: value
		: "Pick emoji"

	const filteredGuild = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return guildEmojis.filter((e) => e.available)
		return guildEmojis.filter(
			(e) => e.available && e.name.toLowerCase().includes(q),
		)
	}, [guildEmojis, query])

	const unicodeList = useMemo(() => {
		const cat = EMOJI_CATEGORIES.find((c) => c.id === category)
		const list = cat?.emojis ?? []
		const q = query.trim().toLowerCase()
		if (!q) return list
		return list.filter((e) => e.includes(q))
	}, [category, query])

	const used = useMemo(() => {
		if (!disabledKeys) return null
		return disabledKeys instanceof Set ? disabledKeys : new Set(disabledKeys)
	}, [disabledKeys])

	function isUsed(key: string) {
		return Boolean(used?.has(key) && key !== value)
	}

	return (
		<div className={`emoji-picker${open ? " open" : ""}`} ref={rootRef}>
			<button
				type="button"
				className="emoji-picker-trigger"
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="dialog"
				aria-expanded={open}
			>
				<span className="emoji-picker-value">
					{previewUrl ? (
						<img src={previewUrl} alt="" width={22} height={22} />
					) : (
						<span className="emoji-picker-placeholder-dot" />
					)}
					<span className={!value ? "muted" : undefined}>{previewLabel}</span>
				</span>
				<span className="emoji-picker-chevron" aria-hidden />
			</button>

			{open ? (
				<div className="emoji-picker-pop" role="dialog" aria-label="Emoji picker">
					<div className="emoji-picker-tabs">
						{guildEmojis.length ? (
							<button
								type="button"
								className={tab === "guild" ? "on" : undefined}
								onClick={() => setTab("guild")}
							>
								Server
							</button>
						) : null}
						<button
							type="button"
							className={tab === "unicode" ? "on" : undefined}
							onClick={() => setTab("unicode")}
						>
							Emoji
						</button>
					</div>
					<input
						className="emoji-picker-search"
						type="search"
						placeholder="Search..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					{tab === "unicode" ? (
						<div className="emoji-picker-cats">
							{EMOJI_CATEGORIES.map((c) => (
								<button
									key={c.id}
									type="button"
									className={category === c.id ? "on" : undefined}
									onClick={() => setCategory(c.id)}
									title={c.label}
								>
									{c.label}
								</button>
							))}
						</div>
					) : null}
					<div className="emoji-picker-grid">
						{tab === "guild"
							? filteredGuild.map((e) => {
									const taken = isUsed(e.key)
									return (
										<button
											key={e.id}
											type="button"
											className={`emoji-picker-cell${taken ? " used" : ""}`}
											title={taken ? `:${e.name}: (already used)` : `:${e.name}:`}
											disabled={taken}
											onClick={() => {
												onChange(e.key)
												setOpen(false)
											}}
										>
											<img
												src={e.url || customEmojiUrl(e.key) || ""}
												alt={e.name}
												width={28}
												height={28}
											/>
										</button>
									)
								})
							: unicodeList.map((e) => {
									const taken = isUsed(e)
									return (
										<button
											key={e}
											type="button"
											className={`emoji-picker-cell${taken ? " used" : ""}`}
											title={taken ? `${e} (already used)` : e}
											disabled={taken}
											onClick={() => {
												onChange(e)
												setOpen(false)
											}}
										>
											<img src={twemojiUrl(e)} alt={e} width={28} height={28} />
										</button>
									)
								})}
						{tab === "guild" && filteredGuild.length === 0 ? (
							<p className="emoji-picker-empty">No server emoji match.</p>
						) : null}
						{tab === "unicode" && unicodeList.length === 0 ? (
							<p className="emoji-picker-empty">No emoji match.</p>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	)
}
