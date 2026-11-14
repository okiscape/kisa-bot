"use client"

import { useParams } from "next/navigation"
import PanelForm from "../panel-form"
import ReactionRolesShell from "../page-shell"
import { useReactionRoleFormData } from "../use-reaction-role-form-data"
import "../reaction-roles.css"

export default function NewReactionRolePage() {
	const params = useParams<{ guildId: string }>()
	const guildId = params.guildId
	const { data, error } = useReactionRoleFormData(guildId)

	if (error) {
		return <ReactionRolesShell lead={error} />
	}

	if (!data) {
		return <ReactionRolesShell lead="Loading…" />
	}

	return (
		<ReactionRolesShell>
			<PanelForm
				guildId={guildId}
				mode="create"
				options={data.options}
				guildEmojis={data.emojis}
			/>
		</ReactionRolesShell>
	)
}
