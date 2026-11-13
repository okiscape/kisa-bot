"use client"

import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import {
	accentToCss,
	discordAvatarUrl,
	discordBannerUrl,
	displayName,
} from "@/lib/discord"
import type { CabinetSection } from "@/lib/cabinet"

type NavItem =
	| { kind: "link"; id: CabinetSection; href: string; label: string }
	| { kind: "muted"; label: string }

const NAV: NavItem[] = [
	{ kind: "link", id: "profile", href: "/dashboard/profile", label: "Profile" },
	{ kind: "link", id: "integrations", href: "/dashboard/integrations", label: "Integrations" },
	{ kind: "muted", label: "Privacy" },
	{ kind: "link", id: "servers", href: "/dashboard", label: "My servers" },
]

export default function CabinetShell({
	active,
	children,
}: {
	active: CabinetSection
	children: React.ReactNode
}) {
	const { user, logout } = useAuth()
	const name = user ? displayName(user) : ""
	const banner =
		user ? discordBannerUrl(user.id, user.banner) : null

	return (
		<main className="servers">
			<aside className="side" aria-label="Cabinet">
				{user ? (
					<div className="identity">
						{banner && <div
							className="banner"
						>
							<img src={banner} alt="Discord Nitro banner" title="Discord Nitro banner" />
						</div>}
						<div className="user">
							<img
								src={discordAvatarUrl(user.id, user.avatar, 64)}
								alt=""
								width={48}
								height={48}
							/>
							<div>
								<strong>{name}</strong>
								<span>Discord account</span>
							</div>
						</div>
					</div>
				) : null}

				<nav className="nav">
					{NAV.map((item) =>
						item.kind === "muted" ? (
							<span key={item.label} className="item muted">
								{item.label}
							</span>
						) : (
							<Link
								key={item.id}
								href={item.href}
								className={`item${active === item.id ? " active" : ""}`}
							>
								{item.label}
							</Link>
						),
					)}
					<button type="button" className="item logout" onClick={() => void logout()}>
						Log out
					</button>
				</nav>
			</aside>

			<section className="main">{children}</section>
		</main>
	)
}
