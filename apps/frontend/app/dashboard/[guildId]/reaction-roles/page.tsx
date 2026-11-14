"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "next-view-transitions"
import { useParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import type { SettingsOptions } from "@/lib/message-config"
import {
	MAX_PANELS,
	roleColorHex,
	type ReactionRolePanel,
} from "@/lib/reaction-roles"
import ReactionRolesShell from "./page-shell"
import "./reaction-roles.css"

export default function ReactionRolesPage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const [panels, setPanels] = useState<ReactionRolePanel[] | null>(null)
	const [options, setOptions] = useState<SettingsOptions | null>(null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		try {
			const [list, opts] = await Promise.all([
				apiFetch<ReactionRolePanel[]>(`/guilds/${guildId}/reaction-roles`),
				apiFetch<SettingsOptions>(`/guilds/${guildId}/settings/options`),
			])
			setPanels(list)
			setOptions(opts)
			setError(null)
		} catch {
			setError("Could not load reaction roles.")
		}
	}, [guildId])

	useEffect(() => {
		void load()
	}, [load])

	const channelsById = useMemo(
		() => new Map((options?.channels ?? []).map((c) => [c.id, c.name])),
		[options],
	)
	const rolesById = useMemo(
		() => new Map((options?.roles ?? []).map((r) => [r.id, r])),
		[options],
	)

	if (error) return <ReactionRolesShell lead={error} />
	if (!panels) return <ReactionRolesShell lead="Loading…" />

	const canCreate = panels.length < MAX_PANELS

	return (
		<ReactionRolesShell>
			<div className="list-toolbar">
				<div className="list-head">
					<strong>Your reaction roles</strong>
					<span>Pick one to edit.</span>
				</div>
				{canCreate ? (
					<Link
						className="new-btn"
						href={`/dashboard/${guildId}/reaction-roles/new`}
					>
						New
					</Link>
				) : (
					<span className="lead">Limit reached ({MAX_PANELS})</span>
				)}
			</div>

			<div className="rr-list">
				{panels.length === 0 ? (
					<p className="rr-empty">No reaction roles yet. Create one to start.</p>
				) : (
					panels.map((panel, index) => {
						const visible = panel.pairs.slice(0, 3)
						const extra = panel.pairs.length - visible.length
						return (
							<div className="rr-row" key={panel.id}>
								<span className="rr-num">{index + 1}</span>
								<span className="rr-channel">
									#{channelsById.get(panel.channelId) ?? panel.channelId}
								</span>
								<div className="rr-roles">
									{visible.map((pair) => {
										const role = rolesById.get(pair.roleId)
										return (
											<span
												className="rr-role-chip"
												key={pair.id ?? `${pair.emoji}-${pair.roleId}`}
											>
												<span
													className="dot"
													style={{
														background: roleColorHex(role?.color),
													}}
												/>
												{role?.name ?? pair.roleId}
											</span>
										)
									})}
									{extra > 0 ? (
										<span className="rr-more">+{extra}</span>
									) : null}
								</div>
								<Link
									className="rr-edit"
									href={`/dashboard/${guildId}/reaction-roles/${panel.id}`}
								>
									Edit
								</Link>
							</div>
						)
					})
				)}
			</div>
		</ReactionRolesShell>
	)
}
