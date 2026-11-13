"use client"

import clsx from "clsx"
import { displayName, discordAvatarUrl, type SessionUser } from "@/lib/discord"
import "./user-capsule.css"

type Props = {
	user: SessionUser
	className?: string
	subtitle?: string
}

export default function UserCapsule({
	user,
	className,
}: Props) {
	const name = displayName(user)
	return (
		<div className={clsx("user-capsule", className)}>
			<img
				className="avatar"
				src={discordAvatarUrl(user.id, user.avatar, 64)}
				alt=""
				width={48}
				height={48}
			/>
			<div className="meta">
				<span className="name">{name}</span>
			</div>
		</div>
	)
}
