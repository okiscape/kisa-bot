"use client"

import { Link } from "next-view-transitions"
import clsx from "clsx"
import Button from "./button"
import UserCapsule from "./user-capsule"
import type { SessionUser } from "@/lib/discord"
import "./app-chrome.css"

type Props = {
	user?: SessionUser | null
	className?: string
	showDashboardLink?: boolean
}

export default function AppChrome({
	user = null,
	className,
	showDashboardLink = false,
}: Props) {
	return (
		<header className={clsx("app-chrome", className)}>
			<Link className="wordmark" href="/">
				kisa
			</Link>

			<div className="right">
				<nav className="links" aria-label="Secondary">
					<a href="https://docs.oki.vodka" target="_blank" rel="noreferrer">
						Docs
					</a>
					<a href="https://discord.gg" target="_blank" rel="noreferrer">
						Support
					</a>
				</nav>

				{showDashboardLink ? (
					<Button href="/dashboard" variant="ghost" size="md">
						Dashboard
					</Button>
				) : null}

				{user ? <UserCapsule user={user} className="compact" /> : null}
			</div>
		</header>
	)
}
