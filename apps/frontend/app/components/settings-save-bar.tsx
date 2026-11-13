"use client"

import Button from "./button"
import "./settings-save-bar.css"

export default function SettingsSaveBar({
	dirty,
	saving,
	status,
	onReset,
	onSave,
}: {
	dirty: boolean
	saving: boolean
	status: string | null
	onReset: () => void
	onSave: () => void
}) {
	return (
		<div className="settings-save-bar">
			<span className="status">{status ?? (dirty ? "Unsaved changes" : "All saved")}</span>
			<div className="actions">
				<Button variant="ghost" size="md" onClick={onReset}>
					Reset
				</Button>
				<Button variant="primary" size="md" onClick={onSave}>
					{saving ? "Saving…" : "Save changes"}
				</Button>
			</div>
		</div>
	)
}
