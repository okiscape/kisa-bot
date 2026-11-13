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
				{showDashboardLink ? (
					<Button href="/dashboard" variant="ghost" size="md">
						Dashboard
					</Button>
				) : null}

				{user ? <a href="/dashboard"><UserCapsule user={user} className="compact" /></a> : null}
			</div>
		</header>
	)
}
