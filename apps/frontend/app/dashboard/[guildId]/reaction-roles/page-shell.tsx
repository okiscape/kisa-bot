import type { ReactNode } from "react"

export default function ReactionRolesShell({
	children,
	lead = "Members click an emoji under a message and get a role.",
}: {
	children?: ReactNode
	lead?: string
}) {
	return (
		<div className="reaction-roles">
			<div className="head">
				<h1 className="title">Reaction roles</h1>
				<p className="lead">{lead}</p>
			</div>
			{children}
		</div>
	)
}
