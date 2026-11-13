"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"

const FALLBACK = "/landing/bot-avatar.png"

type BotPublicProfile = {
	id: string
	username: string
	globalName: string | null
	avatar: string | null
	avatarUrl: string
}

let cached: BotPublicProfile | null = null
let inflight: Promise<BotPublicProfile | null> | null = null

async function loadBotProfile(): Promise<BotPublicProfile | null> {
	if (cached) return cached
	if (!inflight) {
		inflight = apiFetch<BotPublicProfile>("/bot")
			.then((profile) => {
				cached = profile
				return profile
			})
			.catch(() => null)
			.finally(() => {
				inflight = null
			})
	}
	return inflight
}

export default function BotAvatar({
	className = "bot-avatar",
	alt = "kisa",
}: {
	className?: string
	alt?: string
}) {
	const [src, setSrc] = useState(cached?.avatarUrl ?? FALLBACK)

	useEffect(() => {
		let alive = true
		void loadBotProfile().then((profile) => {
			if (!alive || !profile?.avatarUrl) return
			setSrc(profile.avatarUrl)
		})
		return () => {
			alive = false
		}
	}, [])

	return <img className={className} src={src} alt={alt} width={44} height={44} />
}
