"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import CabinetShell from "@/components/cabinet-shell"
import SettingsSaveBar from "@/components/settings-save-bar"
import {
	FormRow,
	SelectField,
	TextAreaField,
	TextField,
} from "@/components/form-controls"
import { apiFetch } from "@/lib/api"
import {
	TIMEZONES,
	colorToCss,
	normalizeHexColor,
	type DiscordProfileDto,
	type UserProfileDto,
	type UserSettingsDto,
} from "@/lib/cabinet"
import UserPreview from "./user-preview"
import "./profile.css"

type ProfileForm = {
	aboutMe: string
	color: string
	customImage: string
	timezone: string | null
}

function emptyForm(): ProfileForm {
	return { aboutMe: "", color: "", customImage: "", timezone: null }
}

function fromRemote(
	profile: UserProfileDto,
	settings: UserSettingsDto,
): ProfileForm {
	return {
		aboutMe: profile.aboutMe ?? "",
		color: profile.color ? normalizeHexColor(profile.color) : "",
		customImage: profile.customImage ?? "",
		timezone: settings.timezone,
	}
}

export default function ProfilePage() {
	const [form, setForm] = useState<ProfileForm | null>(null)
	const [saved, setSaved] = useState<ProfileForm | null>(null)
	const [discord, setDiscord] = useState<DiscordProfileDto | null>(null)
	const [rating, setRating] = useState<number | null>(null)
	const [saving, setSaving] = useState(false)
	const [status, setStatus] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		try {
			const [profile, settings, discordProfile, ratingRes] = await Promise.all([
				apiFetch<UserProfileDto>("/users/@me/profile"),
				apiFetch<UserSettingsDto>("/users/@me/settings"),
				apiFetch<DiscordProfileDto>("/users/@me/discord"),
				apiFetch<{ rating: number | null }>("/users/@me/rating"),
			])
			const next = fromRemote(profile, settings)
			setForm(next)
			setSaved(next)
			setDiscord(discordProfile)
			setRating(ratingRes.rating)
		} catch {
			setError("Could not load your profile.")
		}
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	const dirty = useMemo(
		() => JSON.stringify(form) !== JSON.stringify(saved),
		[form, saved],
	)

	async function save() {
		if (!form) return
		setSaving(true)
		setStatus(null)
		try {
			const color = form.color.trim()
				? normalizeHexColor(form.color)
				: null
			const [profile, settings] = await Promise.all([
				apiFetch<UserProfileDto>("/users/@me/profile", {
					method: "PATCH",
					body: {
						aboutMe: form.aboutMe.trim() || null,
						color,
						customImage: form.customImage.trim() || null,
					},
				}),
				apiFetch<UserSettingsDto>("/users/@me/settings", {
					method: "PATCH",
					body: { timezone: form.timezone },
				}),
			])
			const next = fromRemote(profile, settings)
			setForm(next)
			setSaved(next)
			setStatus("Saved")
		} catch {
			setStatus("Save failed")
		} finally {
			setSaving(false)
		}
	}

	function reset() {
		if (saved) setForm(saved)
		setStatus(null)
	}

	if (error) {
		return (
			<CabinetShell active="profile">
				<header className="hero">
					<h1 className="title">Profile</h1>
					<p className="lead">{error}</p>
				</header>
			</CabinetShell>
		)
	}

	if (!form || !saved) {
		return (
			<CabinetShell active="profile">
				<header className="hero">
					<h1 className="title">Profile</h1>
					<p className="lead">Loading…</p>
				</header>
			</CabinetShell>
		)
	}

	const previewProfile: UserProfileDto = {
		userId: discord?.id ?? "0",
		aboutMe: form.aboutMe.trim() || null,
		color: form.color.trim() ? normalizeHexColor(form.color) : null,
		customImage: form.customImage.trim() || null,
	}
	const previewSettings: UserSettingsDto = {
		userId: discord?.id ?? "0",
		timezone: form.timezone,
		osuUsername: null,
	}

	return (
		<CabinetShell active="profile">
			<div className="profile-page">
				<div className="editor">
					<header className="hero">
						<h1 className="title">Profile</h1>
						<p className="lead">
							Edit the membership card Discord shows in /user.
						</p>
					</header>

					<div className="form">
						<FormRow label="About me" hint="Shown on your custom membership embed.">
							<TextAreaField
								value={form.aboutMe}
								onChange={(aboutMe) => setForm({ ...form, aboutMe })}
								maxLength={500}
								placeholder="A short note about you"
							/>
						</FormRow>

						<FormRow label="Embed color" hint="HEX without or with #.">
							<div className="color-row">
								<input
									className="color-swatch"
									type="color"
									value={colorToCss(form.color || "5865f2")}
									onChange={(e) =>
										setForm({
											...form,
											color: normalizeHexColor(e.target.value),
										})
									}
									aria-label="Pick embed color"
								/>
								<TextField
									label="HEX"
									value={form.color}
									onChange={(color) => setForm({ ...form, color })}
									placeholder="5865f2"
								/>
							</div>
						</FormRow>

						<FormRow label="Custom image" hint="HTTPS image URL for the membership embed.">
							<TextField
								label="Image URL"
								value={form.customImage}
								onChange={(customImage) => setForm({ ...form, customImage })}
								placeholder="https://…"
							/>
						</FormRow>

						<FormRow label="Timezone" hint="Used in /user timestamps.">
							<SelectField
								value={form.timezone}
								onChange={(timezone) => setForm({ ...form, timezone })}
								options={TIMEZONES.map((z) => ({ value: z, label: z }))}
								placeholder="Select timezone…"
							/>
						</FormRow>
					</div>

					<SettingsSaveBar
						dirty={dirty}
						saving={saving}
						status={status}
						onReset={reset}
						onSave={() => void save()}
					/>
				</div>

				<UserPreview
					discord={discord}
					profile={previewProfile}
					settings={previewSettings}
					rating={rating}
				/>
			</div>
		</CabinetShell>
	)
}
