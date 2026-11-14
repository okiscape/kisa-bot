import { MarkdownText } from "@/lib/simple-markdown"
import {
	embedHasPreview,
	groupEmbedFields,
	renderPreviewText,
	resolveEmbedColor,
	type MessageEmbedConfig,
} from "@/lib/message-config"

type Props = {
	embed: MessageEmbedConfig
	fallbackColor: string
	/** Used when embed.title is empty (greeting first embed). */
	fallbackTitle?: string
	/** Template vars for {{mention}} etc. Omit for plain text (reaction roles). */
	vars?: Record<string, string>
}

function preview(text: string, vars?: Record<string, string>) {
	return vars ? renderPreviewText(text, vars) : text
}

/** Shared Discord embed card used by greeting/farewell and reaction roles. */
export default function DiscordEmbedPreview({
	embed,
	fallbackColor,
	fallbackTitle = "",
	vars,
}: Props) {
	if (!embedHasPreview(embed) && !fallbackTitle) return null

	const color = resolveEmbedColor(embed.color, fallbackColor)
	const author = preview(embed.authorName || "", vars)
	const title = preview(embed.title || fallbackTitle, vars)
	const description = preview(embed.description || "", vars)
	const footer = preview(embed.footerText || "", vars)
	const fieldRows = groupEmbedFields(embed.fields ?? [])
	const hasBody =
		Boolean(title || description || fieldRows.length) ||
		Boolean(embed.thumbnailUrl)

	return (
		<div className="msg-embed" style={{ borderColor: color }}>
			{author ? (
				<div className="embed-author">
					{embed.authorIconUrl ? (
						<img src={embed.authorIconUrl} alt="" width={24} height={24} />
					) : null}
					<MarkdownText
						as="span"
						className="embed-author-name"
						text={author}
						mode="inline"
					/>
				</div>
			) : null}

			{hasBody ? (
				embed.thumbnailUrl ? (
					<div className="embed-body">
						<div className="embed-main">
							<EmbedMain
								title={title}
								description={description}
								fieldRows={fieldRows}
								vars={vars}
							/>
						</div>
						<img
							className="embed-thumb"
							src={embed.thumbnailUrl}
							alt=""
						/>
					</div>
				) : (
					<>
						{title ? (
							<MarkdownText
								className="embed-title"
								text={title}
								mode="inline"
							/>
						) : null}
						{description ? (
							<MarkdownText className="embed-desc" text={description} />
						) : null}
						<EmbedFields fieldRows={fieldRows} vars={vars} />
					</>
				)
			) : null}

			{embed.imageUrl ? (
				<img className="embed-image" src={embed.imageUrl} alt="" />
			) : null}

			{footer ? (
				<div className="embed-footer">
					{embed.footerIconUrl ? (
						<img src={embed.footerIconUrl} alt="" width={20} height={20} />
					) : null}
					<MarkdownText
						as="span"
						className="embed-footer-text"
						text={footer}
						mode="inline"
					/>
				</div>
			) : null}
		</div>
	)
}

function EmbedMain({
	title,
	description,
	fieldRows,
	vars,
}: {
	title: string
	description: string
	fieldRows: ReturnType<typeof groupEmbedFields>
	vars?: Record<string, string>
}) {
	return (
		<>
			{title ? (
				<MarkdownText className="embed-title" text={title} mode="inline" />
			) : null}
			{description ? (
				<MarkdownText className="embed-desc" text={description} />
			) : null}
			<EmbedFields fieldRows={fieldRows} vars={vars} />
		</>
	)
}

function EmbedFields({
	fieldRows,
	vars,
}: {
	fieldRows: ReturnType<typeof groupEmbedFields>
	vars?: Record<string, string>
}) {
	if (!fieldRows.length) return null
	return (
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
										text={preview(field.name, vars)}
										mode="inline"
									/>
								) : null}
								{field.value ? (
									<MarkdownText
										className="field-value"
										text={preview(field.value, vars)}
									/>
								) : null}
							</div>
						))}
					</div>
				)
			})}
		</div>
	)
}
