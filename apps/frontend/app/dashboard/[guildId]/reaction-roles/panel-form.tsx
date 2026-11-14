"use client"

import { useMemo, useState } from "react"
import { Link } from "next-view-transitions"
import { useRouter } from "next/navigation"
import BotAvatar from "@/components/bot-avatar"
import EmojiPicker, { type GuildEmojiOption } from "@/components/emoji-picker"
import Switch from "@/components/switch"
import {
	FormRow,
	SelectField,
	TextAreaField,
	TextField,
} from "@/components/form-controls"
import { apiFetch, ApiError } from "@/lib/api"
import { MarkdownText } from "@/lib/simple-markdown"
import { emojiImageUrl } from "@/lib/twemoji"
import {
	DEFAULT_EMBED_COLOR,
	draftToPayload,
	embedHasPreview,
	emptyDraft,
	emptyEmbedField,
	groupEmbedFields,
	MAX_EMBED_FIELDS,
	MAX_PAIRS,
	panelToDraft,
	resolveEmbedColor,
	type ReactionRoleDraft,
	type ReactionRoleMode,
	type ReactionRolePanel,
	type ReactionRoleType,
} from "@/lib/reaction-roles"
import type { SettingsOptions } from "@/lib/message-config"
import { TEXTISH_CHANNEL_TYPES } from "@/lib/message-config"

type Props = {
	guildId: string
	mode: "create" | "edit"
	panel?: ReactionRolePanel
	options: SettingsOptions
	guildEmojis: GuildEmojiOption[]
}

const MODE_OPTIONS: Array<{ value: ReactionRoleMode; label: string }> = [
	{ value: "post_embed", label: "Post embed" },
	{ value: "post_message", label: "Post message" },
	{ value: "existing", label: "Existing message" },
]

const TYPE_OPTIONS: Array<{ value: ReactionRoleType; label: string }> = [
	{ value: "normal", label: "Normal — toggle on react / unreact" },
	{ value: "verify", label: "Verify — add only, never remove" },
	{ value: "unique", label: "Unique — one role from this panel" },
]

export default function PanelForm({
	guildId,
	mode,
	panel,
	options,
	guildEmojis,
}: Props) {
	const router = useRouter()
	const [draft, setDraft] = useState<ReactionRoleDraft>(
		panel ? panelToDraft(panel) : emptyDraft(),
	)
	const [advancedOpen, setAdvancedOpen] = useState(false)
	const [saving, setSaving] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [status, setStatus] = useState<string | null>(null)

	const channels = useMemo(
		() =>
			(options.channels ?? [])
				.filter((c) => TEXTISH_CHANNEL_TYPES.has(c.type))
				.sort((a, b) => a.position - b.position)
				.map((c) => ({ value: c.id, label: `#${c.name}` })),
		[options.channels],
	)

	const roles = useMemo(
		() =>
			(options.roles ?? [])
				.slice()
				.sort((a, b) => b.position - a.position)
				.map((r) => ({
					value: r.id,
					label: `${r.name} (${r.id})`,
					color: r.color,
				})),
		[options.roles],
	)

	const isExistingLocked =
		mode === "edit" && (panel?.mode === "existing" || !panel?.botOwned)
	const showEmbed = draft.mode === "post_embed"
	const showMessageFields = draft.mode !== "existing"
	const embedColor = resolveEmbedColor(draft.embed.color, DEFAULT_EMBED_COLOR)
	const previewPairs = draft.pairs.filter((p) => p.emoji)
	const fieldRows = groupEmbedFields(draft.embed.fields ?? [])

	function patch(partial: Partial<ReactionRoleDraft>) {
		setDraft((prev) => ({ ...prev, ...partial }))
		setStatus(null)
	}

	function patchEmbed(partial: Partial<ReactionRoleDraft["embed"]>) {
		setDraft((prev) => ({
			...prev,
			embed: { ...prev.embed, ...partial },
		}))
		setStatus(null)
	}

	function patchEmbedField(
		fieldIndex: number,
		partial: Partial<(typeof draft.embed.fields)[number]>,
	) {
		setDraft((prev) => {
			const fields = [...(prev.embed.fields ?? [])]
			fields[fieldIndex] = { ...fields[fieldIndex], ...partial }
			return { ...prev, embed: { ...prev.embed, fields } }
		})
		setStatus(null)
	}

	function setPair(
		index: number,
		next: { emoji?: string | null; roleId?: string | null },
	) {
		setDraft((prev) => {
			const pairs = prev.pairs.slice()
			pairs[index] = { ...pairs[index], ...next }
			return { ...prev, pairs }
		})
		setStatus(null)
	}

	async function submit() {
		const payload = draftToPayload(draft)
		if (!payload.channelId) {
			setStatus("Pick a channel")
			return
		}
		if (!payload.pairs.length) {
			setStatus("Add at least one emoji and role")
			return
		}
		if (draft.mode === "existing" && !draft.messageRef.trim()) {
			setStatus("Paste a message link or ID")
			return
		}

		setSaving(true)
		setStatus(null)
		try {
			if (mode === "create") {
				await apiFetch<ReactionRolePanel>(`/guilds/${guildId}/reaction-roles`, {
					method: "POST",
					body: payload,
				})
			} else if (panel) {
				await apiFetch<ReactionRolePanel>(
					`/guilds/${guildId}/reaction-roles/${panel.id}`,
					{ method: "PATCH", body: payload },
				)
			}
			router.push(`/dashboard/${guildId}/reaction-roles`)
			router.refresh()
		} catch (err) {
			const msg =
				err instanceof ApiError
					? ((err.body as { error?: { message?: string } })?.error?.message ??
						err.message)
					: "Save failed"
			setStatus(msg)
		} finally {
			setSaving(false)
		}
	}

	async function remove() {
		if (!panel) return
		if (
			!window.confirm(
				panel.botOwned
					? "Delete this panel and the Discord message?"
					: "Delete this panel and remove bot reactions from the message?",
			)
		) {
			return
		}
		setDeleting(true)
		setStatus(null)
		try {
			await apiFetch(`/guilds/${guildId}/reaction-roles/${panel.id}`, {
				method: "DELETE",
			})
			router.push(`/dashboard/${guildId}/reaction-roles`)
			router.refresh()
		} catch {
			setStatus("Delete failed")
		} finally {
			setDeleting(false)
		}
	}

	return (
		<div className="editor">
			<div className="form">
				<div className="form-head">
					<strong>
						{mode === "create" ? "New reaction role" : "Edit reaction role"}
					</strong>
					<span>
						{mode === "create"
							? "Pick a channel, write a message, add emoji."
							: "Update mappings and message."}
					</span>
				</div>

				<FormRow label="Mode" hint="How the panel message is created.">
					<SelectField
						value={draft.mode}
						onChange={(v) =>
							patch({ mode: (v as ReactionRoleMode) || "post_embed" })
						}
						options={MODE_OPTIONS.map((m) => ({
							value: m.value,
							label: m.label,
						}))}
						placeholder="Mode"
						disabled={isExistingLocked}
					/>
				</FormRow>

				<FormRow label="Channel" hint="Where members react.">
					<SelectField
						value={draft.channelId}
						onChange={(v) => patch({ channelId: v })}
						options={channels}
						placeholder="# channel"
						disabled={isExistingLocked}
					/>
				</FormRow>

				{draft.mode === "existing" ? (
					<FormRow
						label="Message"
						hint="Discord message link or snowflake ID."
					>
						<input
							className="webhook-input"
							type="text"
							placeholder="https://discord.com/channels/…"
							value={draft.messageRef}
							disabled={mode === "edit"}
							onChange={(e) => patch({ messageRef: e.target.value })}
						/>
					</FormRow>
				) : null}

				{showMessageFields ? (
					<FormRow label="Message" hint="Plain text above the embed.">
						<TextAreaField
							value={draft.content}
							onChange={(v) => patch({ content: v })}
							maxLength={2000}
							placeholder="Pick your roles below."
						/>
					</FormRow>
				) : null}

				{showEmbed ? (
					<FormRow
						label="Embed"
						hint="Rich card under the message (same builder as greeting)."
						column
					>
						<div className="embed-list">
							<div className="embed-panel">
								<div className="embed-panel-head">
									<button
										type="button"
										className="embed-toggle"
										onClick={() => patch({ embedOpen: !draft.embedOpen })}
									>
										<span>Embed</span>
										<span
											className={`chevron${draft.embedOpen ? " open" : ""}`}
										>
											▾
										</span>
									</button>
								</div>

								{draft.embedOpen ? (
									<div className="embed-fields">
										<div className="stack-grid">
											<TextField
												label="Author"
												value={draft.embed.authorName ?? ""}
												onChange={(authorName) =>
													patchEmbed({ authorName: authorName || null })
												}
											/>
											<TextField
												label="Icon URL"
												value={draft.embed.authorIconUrl ?? ""}
												onChange={(authorIconUrl) =>
													patchEmbed({
														authorIconUrl: authorIconUrl || null,
													})
												}
											/>
											<TextField
												label="Title"
												value={draft.embed.title ?? ""}
												onChange={(title) =>
													patchEmbed({ title: title || null })
												}
											/>
											<TextField
												label="Title URL"
												value={draft.embed.url ?? ""}
												onChange={(url) => patchEmbed({ url: url || null })}
											/>
										</div>

										<TextAreaField
											value={draft.embed.description ?? ""}
											onChange={(description) =>
												patchEmbed({ description: description || null })
											}
											maxLength={4096}
											placeholder="Embed description"
										/>

										<div className="stack-grid">
											<TextField
												label="Footer"
												value={draft.embed.footerText ?? ""}
												onChange={(footerText) =>
													patchEmbed({ footerText: footerText || null })
												}
											/>
											<TextField
												label="Footer icon URL"
												value={draft.embed.footerIconUrl ?? ""}
												onChange={(footerIconUrl) =>
													patchEmbed({
														footerIconUrl: footerIconUrl || null,
													})
												}
											/>
										</div>

										<div className="embed-field-list">
											<div className="embed-field-list-head">
												<span>Fields</span>
												{(draft.embed.fields?.length ?? 0) < MAX_EMBED_FIELDS ? (
													<button
														type="button"
														className="add-field"
														onClick={() =>
															patchEmbed({
																fields: [
																	...(draft.embed.fields ?? []),
																	emptyEmbedField(),
																],
															})
														}
													>
														Add field
													</button>
												) : null}
											</div>
											{(draft.embed.fields ?? []).map((field, fieldIndex) => (
												<div key={fieldIndex} className="embed-field-panel">
													<div className="embed-field-panel-head">
														<span>Field #{fieldIndex + 1}</span>
														<button
															type="button"
															className="remove-embed"
															onClick={() =>
																patchEmbed({
																	fields: (draft.embed.fields ?? []).filter(
																		(_, i) => i !== fieldIndex,
																	),
																})
															}
														>
															Remove
														</button>
													</div>
													<div className="stack-grid">
														<TextField
															label="Name"
															value={field.name}
															onChange={(name) =>
																patchEmbedField(fieldIndex, { name })
															}
														/>
														<label className="inline-toggle">
															<span>Inline</span>
															<Switch
																checked={field.inline}
																onChange={(inline) =>
																	patchEmbedField(fieldIndex, { inline })
																}
																aria-label="Inline field"
															/>
														</label>
													</div>
													<TextAreaField
														value={field.value}
														onChange={(value) =>
															patchEmbedField(fieldIndex, { value })
														}
														maxLength={1024}
														placeholder="Field value"
													/>
												</div>
											))}
										</div>

										<div className="stack-grid">
											<TextField
												label="Image"
												value={draft.embed.imageUrl ?? ""}
												onChange={(imageUrl) =>
													patchEmbed({ imageUrl: imageUrl || null })
												}
											/>
											<TextField
												label="Thumbnail"
												value={draft.embed.thumbnailUrl ?? ""}
												onChange={(thumbnailUrl) =>
													patchEmbed({ thumbnailUrl: thumbnailUrl || null })
												}
											/>
											<label className="text-field color">
												<span>Color</span>
												<input
													type="color"
													value={embedColor}
													onChange={(e) =>
														patchEmbed({ color: e.target.value })
													}
												/>
												<input
													type="text"
													value={draft.embed.color ?? ""}
													onChange={(e) =>
														patchEmbed({ color: e.target.value || null })
													}
												/>
											</label>
										</div>
									</div>
								) : null}
							</div>
						</div>
					</FormRow>
				) : null}

				<FormRow
					label="Emoji and roles"
					hint={`Up to ${MAX_PAIRS} pairs. Members react to get the role.`}
					column
				>
					<div className="rr-pairs">
						{draft.pairs.map((pair, i) => (
							<div className="rr-pair" key={i}>
								<EmojiPicker
									value={pair.emoji}
									guildEmojis={guildEmojis}
									disabledKeys={draft.pairs
										.map((p) => p.emoji)
										.filter((e): e is string => Boolean(e))}
									onChange={(emoji) => setPair(i, { emoji })}
								/>
								<select
									className="select-field"
									value={pair.roleId ?? ""}
									onChange={(e) =>
										setPair(i, { roleId: e.target.value || null })
									}
								>
									<option value="">Pick role</option>
									{roles.map((r) => (
										<option key={r.value} value={r.value}>
											{r.label}
										</option>
									))}
								</select>
								<button
									type="button"
									className="rr-x"
									aria-label="Remove pair"
									onClick={() =>
										setDraft((prev) => ({
											...prev,
											pairs:
												prev.pairs.length <= 1
													? [{ emoji: null, roleId: null }]
													: prev.pairs.filter((_, idx) => idx !== i),
										}))
									}
								>
									×
								</button>
							</div>
						))}
					</div>
					<button
						type="button"
						className="rr-ghost"
						disabled={draft.pairs.length >= MAX_PAIRS}
						onClick={() =>
							setDraft((prev) => ({
								...prev,
								pairs: [...prev.pairs, { emoji: null, roleId: null }],
							}))
						}
					>
						Add emoji
					</button>
				</FormRow>

				<FormRow
					label="Type"
					hint="Normal, verify, or unique reaction behavior."
					column={advancedOpen || undefined}
				>
					<div className="embed-list">
						<div className="embed-panel">
							<div className="embed-fields">
								<SelectField
									value={draft.type}
									onChange={(v) =>
										patch({ type: (v as ReactionRoleType) || "normal" })
									}
									options={TYPE_OPTIONS.map((t) => ({
										value: t.value,
										label: t.label,
									}))}
									placeholder="Type"
								/>
								<p className="rr-advanced-hint">
									Normal toggles on react. Verify only adds. Unique keeps one
									role from this panel.
								</p>
							</div>
						</div>
					</div>
				</FormRow>

				<div className="rr-actions">
					<div className="rr-left-actions">
						<Link
							className="rr-ghost"
							href={`/dashboard/${guildId}/reaction-roles`}
						>
							Cancel
						</Link>
						{mode === "edit" ? (
							<button
								type="button"
								className="rr-danger"
								disabled={deleting || saving}
								onClick={() => void remove()}
							>
								{deleting ? "Deleting…" : "Delete"}
							</button>
						) : null}
					</div>
					<button
						type="button"
						className="rr-create"
						disabled={saving || deleting}
						onClick={() => void submit()}
					>
						{saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
					</button>
				</div>
				{status ? <p className="rr-status">{status}</p> : null}
			</div>

			<aside className="discord-preview">
				<div className="side-head">
					<strong>Preview</strong>
					<span>How it looks in Discord.</span>
				</div>
				<div className="discord-msg">
					<div className="msg-head">
						<BotAvatar alt="kisa" />
						<div>
							<div className="name-row">
								<strong>kisa</strong>
								<span className="bot-tag">APP</span>
							</div>
							<span className="time">Today at 14:02</span>
						</div>
					</div>

					{draft.content ? (
						<MarkdownText className="msg-content" text={draft.content} />
					) : null}

					{showEmbed && embedHasPreview(draft.embed) ? (
						<div
							className="msg-embed"
							style={{ borderColor: embedColor }}
						>
							{draft.embed.authorName ? (
								<div className="embed-author">
									{draft.embed.authorIconUrl ? (
										<img
											src={draft.embed.authorIconUrl}
											alt=""
											width={24}
											height={24}
										/>
									) : null}
									<MarkdownText
										as="span"
										className="embed-author-name"
										text={draft.embed.authorName}
										mode="inline"
									/>
								</div>
							) : null}

							{draft.embed.thumbnailUrl || draft.embed.title || draft.embed.description || fieldRows.length ? (
								<div className="embed-body">
									<div className="embed-main">
										{draft.embed.title ? (
											<MarkdownText
												className="embed-title"
												text={draft.embed.title}
												mode="inline"
											/>
										) : null}
										{draft.embed.description ? (
											<MarkdownText
												className="embed-desc"
												text={draft.embed.description}
											/>
										) : null}
										{fieldRows.length ? (
											<div className="embed-fields-grid">
												{fieldRows.map((row, rowIndex) => {
													const isInlineRow = row.every((f) => f.inline)
													return (
														<div
															key={rowIndex}
															className={`embed-fields-row${isInlineRow ? " inline" : ""}`}
														>
															{row.map((field, fieldIndex) => (
																<div key={fieldIndex} className="embed-field">
																	{field.name ? (
																		<MarkdownText
																			className="field-name"
																			text={field.name}
																			mode="inline"
																		/>
																	) : null}
																	{field.value ? (
																		<MarkdownText
																			className="field-value"
																			text={field.value}
																		/>
																	) : null}
																</div>
															))}
														</div>
													)
												})}
											</div>
										) : null}
									</div>
									{draft.embed.thumbnailUrl ? (
										<img
											className="embed-thumb"
											src={draft.embed.thumbnailUrl}
											alt=""
										/>
									) : null}
								</div>
							) : null}

							{draft.embed.imageUrl ? (
								<img
									className="embed-image"
									src={draft.embed.imageUrl}
									alt=""
								/>
							) : null}

							{draft.embed.footerText ? (
								<div className="embed-footer">
									{draft.embed.footerIconUrl ? (
										<img
											src={draft.embed.footerIconUrl}
											alt=""
											width={20}
											height={20}
										/>
									) : null}
									<MarkdownText
										as="span"
										className="embed-footer-text"
										text={draft.embed.footerText}
										mode="inline"
									/>
								</div>
							) : null}
						</div>
					) : null}

					{previewPairs.length ? (
						<div className="rr-reactions">
							{previewPairs.map((p, i) => {
								const url = p.emoji ? emojiImageUrl(p.emoji) : null
								return (
									<span key={i} className={`reaction${i === 0 ? " on" : ""}`}>
										{url ? (
											<img src={url} alt="" width={16} height={16} />
										) : (
											"?"
										)}
										<span>{i === 0 ? "24" : "12"}</span>
									</span>
								)
							})}
						</div>
					) : null}
				</div>
			</aside>
		</div>
	)
}
