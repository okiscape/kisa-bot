"use client"

import { AuthProvider, useAuth } from "@/components/auth-provider"
import AppChrome from "@/components/app-chrome"
import "./dashboard.css"
import "./discord-preview.css"

function DashboardShell({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth()

	if (loading) {
		return (
			<div className="dashboard">
				<AppChrome />
				<div className="loading">Loading…</div>
			</div>
		)
	}

	if (!user) {
		return null
	}

	return (
		<div className="dashboard">
			<AppChrome user={user} />
			{children}
		</div>
	)
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<AuthProvider requireAuth>
			<DashboardShell>{children}</DashboardShell>
		</AuthProvider>
	)
}
