"use client"

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { ApiError, apiFetch } from "@/lib/api"
import type { SessionUser } from "@/lib/discord"

type AuthState = {
	user: SessionUser | null
	loading: boolean
	refresh: () => Promise<SessionUser | null>
	logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({
	children,
	requireAuth = false,
}: {
	children: ReactNode
	requireAuth?: boolean
}) {
	const router = useRouter()
	const [user, setUser] = useState<SessionUser | null>(null)
	const [loading, setLoading] = useState(true)

	const refresh = useCallback(async () => {
		try {
			const me = await apiFetch<SessionUser>("/auth/me")
			setUser(me)
			return me
		} catch (err) {
			setUser(null)
			if (err instanceof ApiError && err.status === 401 && requireAuth) {
				router.replace("/login")
			}
			return null
		} finally {
			setLoading(false)
		}
	}, [requireAuth, router])

	const logout = useCallback(async () => {
		try {
			await apiFetch("/auth/logout", { method: "POST" })
		} catch {
			/* still clear local state */
		}
		setUser(null)
		router.replace("/login")
	}, [router])

	useEffect(() => {
		void refresh()
	}, [refresh])

	return (
		<AuthContext.Provider value={{ user, loading, refresh, logout }}>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth(): AuthState {
	const ctx = useContext(AuthContext)
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider")
	}
	return ctx
}
