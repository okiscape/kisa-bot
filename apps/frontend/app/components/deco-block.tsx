import clsx from "clsx"
import "./deco-block.css"

export type DecoPill = {
	label: string
	tone?: "accent" | "soft" | "neutral"
	style?: React.CSSProperties
}

type Props = {
	children: React.ReactNode
	className?: string
	pills?: DecoPill[]
}

export default function DecoBlock({
	children,
	className,
	pills = [],
}: Props) {
	return (
		<div className={clsx("deco", className)}>
			<div className="inner">{children}</div>
			{pills.map((pill) => (
				<span
					key={`${pill.label}-${pill.style?.left ?? ""}-${pill.style?.top ?? ""}`}
					className={`pill ${pill.tone ?? "neutral"}`}
					style={pill.style}
				>
					{pill.label}
				</span>
			))}
		</div>
	)
}
