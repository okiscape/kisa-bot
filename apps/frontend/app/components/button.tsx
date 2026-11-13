import { Link } from "next-view-transitions"
import clsx from "clsx"
import "./button.css"

type Variant = "primary" | "warm" | "ghost" | "soft"
type Size = "md" | "lg"

type Props = {
	children: React.ReactNode
	href?: string
	variant?: Variant
	size?: Size
	className?: string
	onClick?: () => void
	type?: "button" | "submit"
	disabled?: boolean
}

export default function Button({
	children,
	href,
	variant = "primary",
	size = "md",
	className,
	onClick,
	type = "button",
	disabled = false,
}: Props) {
	const classes = clsx("button", variant, size, className, disabled && "disabled")

	if (href && !disabled) {
		const external =
			href.startsWith("http") ||
			href.startsWith("/login") ||
			href.includes("discord.com")
		if (external) {
			return (
				<a className={classes} href={href} rel={href.startsWith("http") ? "noreferrer" : undefined}>
					{children}
				</a>
			)
		}

		return (
			<Link className={classes} href={href}>
				{children}
			</Link>
		)
	}

	return (
		<button className={classes} type={type} onClick={onClick} disabled={disabled}>
			{children}
		</button>
	)
}
