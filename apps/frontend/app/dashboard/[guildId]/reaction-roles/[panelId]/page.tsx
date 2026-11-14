"use client"

import { useParams } from "next/navigation"
import PanelForm from "../panel-form"
import ReactionRolesShell from "../page-shell"
import { useReactionRoleFormData } from "../use-reaction-role-form-data"
import "../reaction-roles.css"

export default function EditReactionRolePage() {
	const params = useParams<{ guildId: string; panelId: string }>()
	const guildId = params.guildId
	const panelId = params.panelId
	const { data, error } = useReactionRoleFormData(guildId, panelId)

	if (error) {
		return <ReactionRolesShell lead={error} />
	}

	if (!data?.panel) {
		return <ReactionRolesShell lead="Loading…" />
	}

	return (
		<ReactionRolesShell>
			<PanelForm
				guildId={guildId}
				mode="edit"
				panel={data.panel}
				options={data.options}
				guildEmojis={data.emojis}
			/>
		</ReactionRolesShell>
	)
}
