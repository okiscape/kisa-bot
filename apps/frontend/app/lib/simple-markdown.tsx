import type { ReactNode } from "react"

type Rule = {
	re: RegExp
	render: (match: RegExpExecArray, key: number) => ReactNode
}

const RULES: Rule[] = [
	{
		re: /\*\*(.+?)\*\*/,
		render: (m, key) => <strong key={key}>{parseInline(m[1], key)}</strong>,
	},
	{
		re: /__(.+?)__/,
		render: (m, key) => <u key={key}>{parseInline(m[1], key)}</u>,
	},
	{
		re: /~~(.+?)~~/,
		render: (m, key) => <s key={key}>{parseInline(m[1], key)}</s>,
	},
	{
		re: /\*(.+?)\*/,
		render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
	},
	{
		re: /_(.+?)_/,
		render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
	},
	{
		re: /`([^`]+)`/,
		render: (m, key) => <code key={key}>{m[1]}</code>,
	},
	{
		re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
		render: (m, key) => (
			<a key={key} href={m[2]} target="_blank" rel="noreferrer">
				{m[1]}
			</a>
		),
	},
]

function findNext(text: string): { index: number; rule: Rule; match: RegExpExecArray } | null {
	let best: { index: number; rule: Rule; match: RegExpExecArray } | null = null
	for (const rule of RULES) {
		const re = new RegExp(rule.re.source)
		const match = re.exec(text)
		if (!match || match.index == null) continue
		if (!best || match.index < best.index) {
			best = { index: match.index, rule, match }
		}
	}
	return best
}

function parseInline(text: string, keyBase = 0): ReactNode[] {
	const nodes: ReactNode[] = []
	let rest = text
	let key = keyBase

	while (rest.length) {
		const next = findNext(rest)
		if (!next) {
			nodes.push(rest)
			break
		}
		if (next.index > 0) {
			nodes.push(rest.slice(0, next.index))
		}
		nodes.push(next.rule.render(next.match, key++))
		rest = rest.slice(next.index + next.match[0].length)
	}

	return nodes
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/

function parseBlocks(text: string): ReactNode[] {
	const lines = text.split("\n")
	const nodes: ReactNode[] = []
	let key = 0
	let i = 0

	while (i < lines.length) {
		const line = lines[i]
		const heading = HEADING_RE.exec(line)
		if (heading) {
			const level = heading[1].length
			const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3"
			nodes.push(
				<Tag key={key++} className={`md-h${level}`}>
					{parseInline(heading[2], key)}
				</Tag>,
			)
			i += 1
			continue
		}

		const quote = QUOTE_RE.exec(line)
		if (quote) {
			const parts: string[] = [quote[1]]
			i += 1
			while (i < lines.length) {
				const next = QUOTE_RE.exec(lines[i])
				if (!next) break
				parts.push(next[1])
				i += 1
			}
			nodes.push(
				<blockquote key={key++} className="md-quote">
					{parts.map((part, idx) => (
						<span key={idx}>
							{idx > 0 ? <br /> : null}
							{parseInline(part, key + idx)}
						</span>
					))}
				</blockquote>,
			)
			continue
		}

		const plain: string[] = [line]
		i += 1
		while (i < lines.length && !HEADING_RE.test(lines[i]) && !QUOTE_RE.test(lines[i])) {
			plain.push(lines[i])
			i += 1
		}
		nodes.push(
			<span key={key++} className="md-text">
				{plain.map((part, idx) => (
					<span key={idx}>
						{idx > 0 ? "\n" : null}
						{parseInline(part, key + idx)}
					</span>
				))}
			</span>,
		)
	}

	return nodes
}

/** Discord-ish subset: headings, quotes, bold, italic, underline, strike, code, links. */
export function parseSimpleMarkdown(text: string): ReactNode {
	if (!text) return null
	return parseBlocks(text)
}

export function MarkdownText({
	text,
	as: Tag = "div",
	className,
}: {
	text: string
	as?: "span" | "p" | "strong" | "div"
	className?: string
}) {
	return <Tag className={className}>{parseSimpleMarkdown(text)}</Tag>
}
