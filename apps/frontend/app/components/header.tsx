"use client"

import { useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import Button from "./button"
import UserCapsule from "./user-capsule"
import { apiFetch } from "@/lib/api"
import type { SessionUser } from "@/lib/discord"
import "./header.css"

const navLinks = [
	{ label: "Docs", href: "#docs" },
	{ label: "Commands", href: "#commands" },
	{ label: "Statistics", href: "#statistics" },
	{ label: "Support us", href: "#support" },
] as const

type Props = {
	dashboardHref?: string
}

export default function Header({ dashboardHref = "/dashboard" }: Props) {
	const [user, setUser] = useState<SessionUser | null>(null)
	const [ready, setReady] = useState(false)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const me = await apiFetch<SessionUser>("/auth/me")
				if (!cancelled) setUser(me)
			} catch {
				if (!cancelled) setUser(null)
			} finally {
				if (!cancelled) setReady(true)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

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
				{ready && user ? (
					<Link href={dashboardHref} className="capsule-link">
						<UserCapsule user={user} className="compact" />
					</Link>
				) : (
					<Button href={dashboardHref} variant="ghost" size="md">
						Dashboard
					</Button>
				)}
			</div>
		</header>
	)
}
