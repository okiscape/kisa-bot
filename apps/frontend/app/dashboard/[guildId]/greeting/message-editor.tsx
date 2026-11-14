"use client"

import { useEffect, useState } from "react"
import BotAvatar from "@/components/bot-avatar"
import Switch from "@/components/switch"
import SettingsSaveBar from "@/components/settings-save-bar"
import {
	FormRow,
	Segmented,
	SelectField,
	TextAreaField,
	TextField,
} from "@/components/form-controls"
import { apiFetch } from "@/lib/api"
import {
	emptyEmbed,
	emptyEmbedField,
	renderPreviewText,
	TEMPLATE_VARS,
	TEXTISH_CHANNEL_TYPES,
	type MessageConfig,
	type MessageEmbedConfig,
	type MessageEmbedField,
	type SettingsOptions,
} from "@/lib/message-config"
import { MarkdownText } from "@/lib/simple-markdown"

const PREVIEW_VARS = {
	mention: "@user",
	server: "Server",
	count: "128",
}

const MAX_EMBEDS = 5
const MAX_EMBED_FIELDS = 25
const WEBHOOK_URL_RE =
	/^https:\/\/(?:www\.)?(?:discord|discordapp)\.com\/api(?:\/v\d+)?\/webhooks\/\d{17,20}\/[\w-]+(?:\?.*)?$/i

type WebhookPreview = {
	id: string
	name: string
	avatarUrl: string
	channelId: string | null
}

const webhookPreviewCache = new Map<string, WebhookPreview>()

type Props = {
	guildId: string
	title: string
	value: MessageConfig
	options: SettingsOptions | null
	defaultEmbedColor: string
	onChange: (next: MessageConfig) => void
	onSave: () => Promise<void>
	onReset: () => void
	saving: boolean
	dirty: boolean
	status: string | null
	autoRole?: string | null
	onAutoRoleChange?: (roleId: string | null) => void
}

function resolveEmbedColor(color: string | null | undefined, fallback: string) {
	if (!color) return fallback
	return color.startsWith("#") ? color : `#${color}`
}

function embedHasPreview(embed: MessageEmbedConfig) {
	return Boolean(
		embed.title ||
			embed.description ||
			embed.imageUrl ||
			embed.authorName ||
			embed.footerText ||
			embed.url ||
			(embed.fields ?? []).some((f) => f.name || f.value),
	)
}

/** Group Discord-style: non-inline alone, consecutive inline up to 3 per row. */
function groupEmbedFields(fields: MessageEmbedField[]) {
	const rows: MessageEmbedField[][] = []
	let inlineBuf: MessageEmbedField[] = []
	for (const field of fields) {
		if (!field.name && !field.value) continue
		if (field.inline) {
			inlineBuf.push(field)
			if (inlineBuf.length === 3) {
				rows.push(inlineBuf)
				inlineBuf = []
			}
			continue
		}
		if (inlineBuf.length) {
			rows.push(inlineBuf)
			inlineBuf = []
		}
		rows.push([field])
	}
	if (inlineBuf.length) rows.push(inlineBuf)
	return rows
}

export default function MessageEditor({
	guildId,
	title,
	value,
	options,
	defaultEmbedColor,
	onChange,
	onSave,
	onReset,
	saving,
	dirty,
	status,
	autoRole,
	onAutoRoleChange,
}: Props) {
	const [openEmbeds, setOpenEmbeds] = useState<Record<number, boolean>>({ 0: true })
	const [webhookPreview, setWebhookPreview] = useState<WebhookPreview | null>(null)
	const [localStatus, setLocalStatus] = useState<string | null>(null)
	const channels = (options?.channels ?? [])
		.filter((c) => TEXTISH_CHANNEL_TYPES.has(c.type))
		.sort((a, b) => a.position - b.position)
		.map((c) => ({ value: c.id, label: `#${c.name} (${c.id})` }))
	const roles = (options?.roles ?? [])
		.slice()
		.sort((a, b) => b.position - a.position)
		.map((r) => ({ value: r.id, label: `${r.name} (${r.id})` }))
	const showAutoRole = onAutoRoleChange !== undefined
	const showSettings = value.enabled
	const embeds = value.embeds
	const isWebhookSender = value.sender === "webhook"

	useEffect(() => {
		if (!isWebhookSender) {
			setWebhookPreview(null)
			return
		}

		const url = value.webhookUrl?.trim() ?? ""
		if (!WEBHOOK_URL_RE.test(url)) {
			setWebhookPreview(null)
			return
		}

		const cached = webhookPreviewCache.get(url)
		if (cached) {
			setWebhookPreview(cached)
			return
		}

		let cancelled = false
		const timer = window.setTimeout(() => {
			void apiFetch<WebhookPreview>(
				`/guilds/${guildId}/webhooks/preview?url=${encodeURIComponent(url)}`,
			)
				.then((preview) => {
					webhookPreviewCache.set(url, preview)
					if (!cancelled) setWebhookPreview(preview)
				})
				.catch(() => {
					if (!cancelled) setWebhookPreview(null)
				})
		}, 400)

		return () => {
			cancelled = true
			window.clearTimeout(timer)
		}
	}, [guildId, isWebhookSender, value.webhookUrl])

	const previewName =
		isWebhookSender ? (webhookPreview?.name ?? "Webhook") : "kisa"
	const previewBadge = isWebhookSender ? "WEBHOOK" : "BOT"

	function patch(partial: Partial<MessageConfig>) {
		onChange({ ...value, ...partial })
	}

	function patchEmbed(index: number, partial: Partial<MessageEmbedConfig>) {
		const next = embeds.map((embed, i) =>
			i === index ? { ...embed, ...partial } : embed,
		)
		patch({ embeds: next })
	}

	function patchEmbedField(
		embedIndex: number,
		fieldIndex: number,
		partial: Partial<MessageEmbedField>,
	) {
		const embed = embeds[embedIndex]
		if (!embed) return
		const fields = embed.fields ?? []
		patchEmbed(embedIndex, {
			fields: fields.map((field, i) =>
				i === fieldIndex ? { ...field, ...partial } : field,
			),
		})
	}

	function addEmbedField(embedIndex: number) {
		const embed = embeds[embedIndex]
		const fields = embed?.fields ?? []
		if (!embed || fields.length >= MAX_EMBED_FIELDS) return
		patchEmbed(embedIndex, {
			fields: [...fields, emptyEmbedField()],
		})
	}

	function removeEmbedField(embedIndex: number, fieldIndex: number) {
		const embed = embeds[embedIndex]
		if (!embed) return
		patchEmbed(embedIndex, {
			fields: (embed.fields ?? []).filter((_, i) => i !== fieldIndex),
		})
	}

	function addEmbed() {
		if (embeds.length >= MAX_EMBEDS) return
		const nextIndex = embeds.length
		patch({
			embeds: [...embeds, { ...emptyEmbed(), color: defaultEmbedColor }],
		})
		setOpenEmbeds((prev) => ({ ...prev, [nextIndex]: true }))
	}

	function removeEmbed(index: number) {
		patch({ embeds: embeds.filter((_, i) => i !== index) })
		setOpenEmbeds((prev) => {
			const next: Record<number, boolean> = {}
			for (const [key, open] of Object.entries(prev)) {
				const i = Number(key)
				if (i < index) next[i] = open
				else if (i > index) next[i - 1] = open
			}
			return next
		})
	}

	function toggleEmbed(index: number) {
		setOpenEmbeds((prev) => ({ ...prev, [index]: !prev[index] }))
	}

	function insertVar(token: string) {
		patch({ content: `${value.content}${token}` })
	}

	function isValidWebhookUrl(url: string) {
		return WEBHOOK_URL_RE.test(url.trim())
	}

	function handleSave() {
		if (isWebhookSender && !isValidWebhookUrl(value.webhookUrl ?? "")) {
			setLocalStatus("Enter a valid Discord webhook URL")
			return
		}
		setLocalStatus(null)
		void onSave()
	}

	useEffect(() => {
		setLocalStatus(null)
	}, [value.sender, value.webhookUrl])

	const previewContent = renderPreviewText(value.content, PREVIEW_VARS)

	return (
		<div className={`editor${showSettings ? "" : " disabled"}`}>
			<div className="form">
				<div className="enable">
					<div>
						<strong>Enabled</strong>
						<span>Send this message when the event happens.</span>
					</div>
					<Switch
						checked={value.enabled}
						onChange={(checked) => patch({ enabled: checked })}
						aria-label="Enable message"
					/>
				</div>

				{showAutoRole && onAutoRoleChange ? (
					<FormRow label="Auto role" hint="Given automatically when someone joins.">
						<SelectField
							value={autoRole ?? null}
							onChange={onAutoRoleChange}
							options={roles}
							placeholder="Select role"
						/>
					</FormRow>
				) : null}

				{showSettings ? (
					<>
						<FormRow label="Sent by" hint="Bot account or custom webhook.">
							<Segmented
								value={value.sender}
								options={[
									{ id: "bot", label: "Bot" },
									{ id: "webhook", label: "Webhook" },
								]}
								onChange={(sender) => patch({ sender })}
							/>
						</FormRow>

						{value.sender === "webhook" ? (
							<FormRow label="Webhook" hint="HTTPS Discord webhook URL.">
								<input
									className="webhook-input"
									type="url"
									placeholder="https://discord.com/api/webhooks/…"
									value={value.webhookUrl ?? ""}
									onChange={(e) =>
										patch({ webhookUrl: e.target.value || null })
									}
								/>
							</FormRow>
						) : null}

						<FormRow label="Channel" hint="Where the message is posted.">
							<SelectField
								value={value.channelId}
								onChange={(channelId) => patch({ channelId })}
								options={channels}
								placeholder="Select channel"
							/>
						</FormRow>

						<FormRow label="Message" hint="Plain text above the embed.">
							<TextAreaField
								value={value.content}
								onChange={(content) => patch({ content })}
								placeholder="Welcome {{mention}}!"
							/>
							<div className="var-chips">
								{TEMPLATE_VARS.map((v) => (
									<button
										key={v.key}
										type="button"
										className="chip"
										onClick={() => insertVar(v.label)}
									>
										{v.label}
									</button>
								))}
							</div>
						</FormRow>

						<FormRow
							label="Embeds"
							hint={`Optional rich cards under the message (up to ${MAX_EMBEDS}).`}
							column={true}
						>
							<div className="embed-list">
								{embeds.map((embed, index) => {
									const open = openEmbeds[index] ?? false
									const color = resolveEmbedColor(
										embed.color,
										defaultEmbedColor,
									)
									return (
										<div key={index} className="embed-panel">
											<div className="embed-panel-head">
												<button
													type="button"
													className="embed-toggle"
													onClick={() => toggleEmbed(index)}
												>
													<span>Embed #{index + 1}</span>
													<span className={`chevron${open ? " open" : ""}`}>
														▾
													</span>
												</button>
												<button
													type="button"
													className="remove-embed"
													onClick={() => removeEmbed(index)}
												>
													Remove
												</button>
											</div>

											{open ? (
												<div className="embed-fields">
													<div className="stack-grid">
														<TextField
															label="Author"
															value={embed.authorName ?? ""}
															onChange={(authorName) =>
																patchEmbed(index, {
																	authorName: authorName || null,
																})
															}
														/>
														<TextField
															label="Icon URL"
															value={embed.authorIconUrl ?? ""}
															onChange={(authorIconUrl) =>
																patchEmbed(index, {
																	authorIconUrl: authorIconUrl || null,
																})
															}
														/>
														<TextField
															label="Title"
															value={embed.title ?? ""}
															onChange={(titleValue) =>
																patchEmbed(index, {
																	title: titleValue || null,
																})
															}
														/>
														<TextField
															label="Title URL"
															value={embed.url ?? ""}
															onChange={(url) =>
																patchEmbed(index, {
																	url: url || null,
																})
															}
														/>
													</div>
													<TextAreaField
														value={embed.description ?? ""}
														onChange={(description) =>
															patchEmbed(index, {
																description: description || null,
															})
														}
														maxLength={4096}
														placeholder="Embed description"
													/>
													<div className="stack-grid">
														<TextField
															label="Footer"
															value={embed.footerText ?? ""}
															onChange={(footerText) =>
																patchEmbed(index, {
																	footerText: footerText || null,
																})
															}
														/>
														<TextField
															label="Footer icon URL"
															value={embed.footerIconUrl ?? ""}
															onChange={(footerIconUrl) =>
																patchEmbed(index, {
																	footerIconUrl: footerIconUrl || null,
																})
															}
														/>
													</div>
													<div className="embed-field-list">
														<div className="embed-field-list-head">
															<span>Fields</span>
															{(embed.fields?.length ?? 0) < MAX_EMBED_FIELDS ? (
																<button
																	type="button"
																	className="add-field"
																	onClick={() => addEmbedField(index)}
																>
																	Add field
																</button>
															) : null}
														</div>
														{(embed.fields ?? []).map((field, fieldIndex) => (
															<div key={fieldIndex} className="embed-field-panel">
																<div className="embed-field-panel-head">
																	<span>Field #{fieldIndex + 1}</span>
																	<button
																		type="button"
																		className="remove-embed"
																		onClick={() =>
																			removeEmbedField(index, fieldIndex)
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
																			patchEmbedField(index, fieldIndex, {
																				name,
																			})
																		}
																	/>
																	<label className="inline-toggle">
																		<span>Inline</span>
																		<Switch
																			checked={field.inline}
																			onChange={(inline) =>
																				patchEmbedField(index, fieldIndex, {
																					inline,
																				})
																			}
																			aria-label="Inline field"
																		/>
																	</label>
																</div>
																<TextAreaField
																	value={field.value}
																	onChange={(value) =>
																		patchEmbedField(index, fieldIndex, {
																			value,
																		})
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
															value={embed.imageUrl ?? ""}
															onChange={(imageUrl) =>
																patchEmbed(index, {
																	imageUrl: imageUrl || null,
																})
															}
														/>
														<label className="text-field color">
															<span>Color</span>
															<input
																type="color"
																value={color}
																onChange={(e) =>
																	patchEmbed(index, {
																		color: e.target.value,
																	})
																}
															/>
															<input
																type="text"
																value={embed.color ?? ""}
																onChange={(e) =>
																	patchEmbed(index, {
																		color: e.target.value || null,
																	})
																}
															/>
														</label>
													</div>
												</div>
											) : null}
										</div>
									)
								})}

								{embeds.length < MAX_EMBEDS ? (
									<button
										type="button"
										className="add-embed"
										onClick={addEmbed}
									>
										Add embed
									</button>
								) : null}
							</div>
						</FormRow>
					</>
				) : null}

				<SettingsSaveBar
					dirty={dirty}
					saving={saving}
					status={localStatus ?? status}
					onReset={onReset}
					onSave={handleSave}
				/>
			</div>

			{showSettings ? (
				<aside className="discord-preview">
					<div className="side-head">
						<strong>Preview</strong>
						<span>Live Discord-style</span>
					</div>
					<div className="discord-msg">
						<div className="msg-head">
							{isWebhookSender && webhookPreview ? (
								<img
									className="bot-avatar"
									src={webhookPreview.avatarUrl}
									alt={webhookPreview.name}
									width={44}
									height={44}
								/>
							) : (
								<BotAvatar alt={previewName} />
							)}
							<div>
								<div className="name-row">
									<strong>{previewName}</strong>
									<span
										className="bot-tag"
									>
										{previewBadge}
									</span>
								</div>
								<span className="time">Today at 12:00</span>
							</div>
						</div>
						{previewContent ? (
							<MarkdownText className="msg-content" text={previewContent} />
						) : null}
						{embeds.map((embed, index) => {
							if (!embedHasPreview(embed)) return null
							const color = resolveEmbedColor(embed.color, defaultEmbedColor)
							const previewAuthor = renderPreviewText(
								embed.authorName || "",
								PREVIEW_VARS,
							)
							const previewTitle = renderPreviewText(
								embed.title || (index === 0 ? title : ""),
								PREVIEW_VARS,
							)
							const previewDesc = renderPreviewText(
								embed.description || "",
								PREVIEW_VARS,
							)
							const previewFooter = renderPreviewText(
								embed.footerText || "",
								PREVIEW_VARS,
							)
							const fieldRows = groupEmbedFields(embed.fields ?? [])
							return (
								<div
									key={index}
									className="msg-embed"
									style={{ borderColor: color }}
								>
									{previewAuthor ? (
										<div className="embed-author">
											{embed.authorIconUrl ? (
												<img
													src={embed.authorIconUrl}
													alt=""
													width={24}
													height={24}
												/>
											) : null}
											<MarkdownText
												as="span"
												className="embed-author-name"
												text={previewAuthor}
												mode="inline"
											/>
										</div>
									) : null}
									{previewTitle ? (
										<MarkdownText
											className="embed-title"
											text={previewTitle}
											mode="inline"
										/>
									) : null}
									{previewDesc ? (
										<MarkdownText className="embed-desc" text={previewDesc} />
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
																		text={renderPreviewText(
																			field.name,
																			PREVIEW_VARS,
																		)}
																		mode="inline"
																	/>
																) : null}
																{field.value ? (
																	<MarkdownText
																		className="field-value"
																		text={renderPreviewText(
																			field.value,
																			PREVIEW_VARS,
																		)}
																	/>
																) : null}
															</div>
														))}
													</div>
												)
											})}
										</div>
									) : null}
									{embed.imageUrl ? (
										<img className="embed-image" src={embed.imageUrl} alt="" />
									) : null}
									{previewFooter ? (
										<div className="embed-footer">
											{embed.footerIconUrl ? (
												<img
													src={embed.footerIconUrl}
													alt=""
													width={20}
													height={20}
												/>
											) : null}
											<MarkdownText
												as="span"
												className="embed-footer-text"
												text={previewFooter}
												mode="inline"
											/>
										</div>
									) : null}
								</div>
							)
						})}
					</div>
				</aside>
			) : null}
		</div>
	)
}
