"use client"

import { useState } from "react"
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
import {
	emptyEmbed,
	renderPreviewText,
	TEMPLATE_VARS,
	TEXTISH_CHANNEL_TYPES,
	type MessageConfig,
	type MessageEmbedConfig,
	type SettingsOptions,
} from "@/lib/message-config"
import { MarkdownText } from "@/lib/simple-markdown"

const PREVIEW_VARS = {
	mention: "@user",
	server: "Server",
	count: "128",
	channel: "#general",
}

type Props = {
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
}

export default function MessageEditor({
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
}: Props) {
	const [embedOpen, setEmbedOpen] = useState(true)
	const channels = (options?.channels ?? [])
		.filter((c) => TEXTISH_CHANNEL_TYPES.has(c.type))
		.sort((a, b) => a.position - b.position)
		.map((c) => ({ value: c.id, label: `#${c.name}` }))

	const embed: MessageEmbedConfig = value.embeds[0] ?? {
		...emptyEmbed(),
		color: defaultEmbedColor,
	}

	function patch(partial: Partial<MessageConfig>) {
		onChange({ ...value, ...partial })
	}

	function patchEmbed(partial: Partial<MessageEmbedConfig>) {
		const nextEmbed = { ...embed, ...partial }
		const embeds = value.embeds.length ? [...value.embeds] : [nextEmbed]
		embeds[0] = nextEmbed
		patch({ embeds })
	}

	function insertVar(token: string) {
		patch({ content: `${value.content}${token}` })
	}

	const previewContent = renderPreviewText(value.content, PREVIEW_VARS)
	const previewTitle = renderPreviewText(embed.title || title, PREVIEW_VARS)
	const previewDesc = renderPreviewText(embed.description || "", PREVIEW_VARS)
	const previewColor = embed.color?.startsWith("#")
		? embed.color
		: embed.color
			? `#${embed.color}`
			: defaultEmbedColor

	return (
		<div className="editor">
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
							onChange={(e) => patch({ webhookUrl: e.target.value || null })}
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

				<FormRow label="Embed" hint="Optional rich card under the message.">
					<button
						type="button"
						className="embed-toggle"
						onClick={() => setEmbedOpen((o) => !o)}
					>
						<span>Embed #1</span>
						<span className={`chevron${embedOpen ? " open" : ""}`}>▾</span>
					</button>

					{embedOpen ? (
						<div className="embed-fields">
							<div className="stack-grid">
								<TextField
									label="Author"
									value={embed.authorName ?? ""}
									onChange={(authorName) =>
										patchEmbed({ authorName: authorName || null })
									}
								/>
								<TextField
									label="Icon URL"
									value={embed.authorIconUrl ?? ""}
									onChange={(authorIconUrl) =>
										patchEmbed({ authorIconUrl: authorIconUrl || null })
									}
								/>
								<TextField
									label="Title"
									value={embed.title ?? ""}
									onChange={(titleValue) =>
										patchEmbed({ title: titleValue || null })
									}
								/>
								<TextField
									label="Title URL"
									value={embed.url ?? ""}
									onChange={(url) => patchEmbed({ url: url || null })}
								/>
							</div>
							<TextAreaField
								value={embed.description ?? ""}
								onChange={(description) =>
									patchEmbed({ description: description || null })
								}
								maxLength={4096}
								placeholder="Embed description"
							/>
							<div className="stack-grid">
								<TextField
									label="Image"
									value={embed.imageUrl ?? ""}
									onChange={(imageUrl) =>
										patchEmbed({ imageUrl: imageUrl || null })
									}
								/>
								<label className="text-field color">
									<span>Color</span>
									<input
										type="color"
										value={previewColor}
										onChange={(e) => patchEmbed({ color: e.target.value })}
									/>
									<input
										type="text"
										value={embed.color ?? ""}
										onChange={(e) =>
											patchEmbed({ color: e.target.value || null })
										}
									/>
								</label>
							</div>
							{value.embeds.length === 0 ? (
								<button
									type="button"
									className="add-embed"
									onClick={() =>
										patch({
											embeds: [{ ...emptyEmbed(), color: defaultEmbedColor }],
										})
									}
								>
									Add embed
								</button>
							) : null}
						</div>
					) : null}
				</FormRow>

				<SettingsSaveBar
					dirty={dirty}
					saving={saving}
					status={status}
					onReset={onReset}
					onSave={() => void onSave()}
				/>
			</div>

			<aside className="preview">
				<div className="side-head">
					<strong>Preview</strong>
					<span>Live Discord-style</span>
				</div>
				<div className="discord-msg">
					<div className="msg-head">
						<BotAvatar />
						<div>
							<div className="name-row">
								<strong>kisa</strong>
								<span className="bot-tag">BOT</span>
							</div>
							<span className="time">Today at 12:00</span>
						</div>
					</div>
					{previewContent ? (
						<MarkdownText className="msg-content" text={previewContent} />
					) : null}
					{embed.title || embed.description || embed.imageUrl ? (
						<div className="msg-embed" style={{ borderColor: previewColor }}>
							{embed.authorName ? (
								<div className="embed-author">{embed.authorName}</div>
							) : null}
							{previewTitle ? (
								<MarkdownText className="embed-title" text={previewTitle} />
							) : null}
							{previewDesc ? (
								<MarkdownText className="embed-desc" text={previewDesc} />
							) : null}
							{embed.imageUrl ? (
								<img className="embed-image" src={embed.imageUrl} alt="" />
							) : (
								<div className="embed-image placeholder" />
							)}
						</div>
					) : null}
				</div>
			</aside>
		</div>
	)
}
