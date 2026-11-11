"use client"

import { useState } from "react"
import clsx from "clsx"
import "./switch.css"

type Props = {
	checked?: boolean
	defaultChecked?: boolean
	onChange?: (checked: boolean) => void
	className?: string
	disabled?: boolean
	"aria-label"?: string
}

export default function Switch({
	checked,
	defaultChecked = false,
	onChange,
	className,
	disabled = false,
	"aria-label": ariaLabel = "Toggle",
}: Props) {
	const [inner, setInner] = useState(defaultChecked)
	const on = checked ?? inner

	function toggle() {
		if (disabled) return
		const next = !on
		if (checked === undefined) setInner(next)
		onChange?.(next)
	}

	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={ariaLabel}
			disabled={disabled}
			className={clsx("switch", on && "on", className)}
			onClick={toggle}
		>
			<span className="knob" />
		</button>
	)
}
