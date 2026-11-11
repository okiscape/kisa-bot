"use client"

import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import "./appear.css"

type Variant = "fade-up" | "reveal"

type Props = {
	children: React.ReactNode
	className?: string
	variant?: Variant
	delayMs?: number
	as?: "div" | "section" | "article" | "span"
	id?: string
}

export default function Appear({
	children,
	className,
	variant = "fade-up",
	delayMs = 0,
	as = "div",
	id,
}: Props) {
	const ref = useRef<HTMLElement | null>(null)
	const [visible, setVisible] = useState(false)
	const Tag = as

	useEffect(() => {
		const node = ref.current
		if (!node) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					setVisible(true)
					observer.disconnect()
				}
			},
			{ threshold: 0.18, rootMargin: "0px 0px -40px 0px" },
		)

		observer.observe(node)
		return () => observer.disconnect()
	}, [])

	return (
		<Tag
			id={id}
			ref={ref as never}
			className={clsx("appear", variant, visible && "visible", className)}
			style={{ transitionDelay: `${delayMs}ms` }}
		>
			{children}
		</Tag>
	)
}
