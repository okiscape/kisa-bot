import { Link } from "next-view-transitions"
import Button from "./button"
import "./header.css"

const navLinks = [
	{ label: "Docs", href: "#docs" },
	{ label: "Commands", href: "#commands" },
	{ label: "Statistics", href: "#statistics" },
	{ label: "Support us", href: "#support" },
] as const

type Props = {
	loginHref?: string
	inviteHref?: string
}

export default function Header({
	loginHref = "/login",
	inviteHref = "/login",
}: Props) {
	return (
		<header className="header">
			<Link className="wordmark" href="/">
				kisa
			</Link>

			<nav className="nav" aria-label="Primary">
				{navLinks.map((link) => (
					<a key={link.href} href={link.href}>
						{link.label}
					</a>
				))}
			</nav>

			<div className="actions">
				<Button href={loginHref} variant="ghost" size="md">
					Log in
				</Button>
				<Button href={inviteHref} variant="primary" size="md">
					Add to Discord
				</Button>
			</div>
		</header>
	)
}
