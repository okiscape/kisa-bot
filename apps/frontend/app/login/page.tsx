"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AppChrome from "@/components/app-chrome"
import Button from "@/components/button"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { discordLoginUrl } from "@/lib/api"
import "./login.css"

const ERROR_COPY: Record<string, string> = {
	access_denied: "Discord login was cancelled.",
	missing_code: "Discord did not return an auth code.",
	state_mismatch: "Login session expired. Try again.",
	state_expired: "Login session expired. Try again.",
	auth_failed: "Could not complete Discord login.",
}

function LoginContent() {
	const router = useRouter()
	const params = useSearchParams()
	const { user, loading } = useAuth()
	const [redirecting, setRedirecting] = useState(false)

	const errorMessage = useMemo(() => {
		const code = params.get("error")
		if (!code) return null
		return ERROR_COPY[code] ?? "Login failed. Please try again."
	}, [params])

	useEffect(() => {
		if (!loading && user) {
			router.replace("/dashboard")
		}
	}, [loading, user, router])

	function continueWithDiscord() {
		setRedirecting(true)
		window.location.href = discordLoginUrl()
	}

	return (
		<div className="login">
			<AppChrome />

			<main className="stage">
				<div className="hero">
					<h1 className="title">Log in</h1>
					<p className="lead">Continue with Discord to manage your servers.</p>
					{errorMessage ? <p className="error">{errorMessage}</p> : null}
					<Button
						variant="primary"
						size="lg"
						onClick={continueWithDiscord}
						className="cta"
					>
						{redirecting || loading ? "Continuing…" : "Continue with Discord"}
					</Button>
					<span className="hint">kisa only reads your username, avatar, and guild list.</span>
				</div>
			</main>
		</div>
	)
}

export default function LoginPage() {
	return (
		<AuthProvider>
			<Suspense
				fallback={
					<div className="login">
						<AppChrome />
						<main className="stage" />
					</div>
				}
			>
				<LoginContent />
			</Suspense>
		</AuthProvider>
	)
}
