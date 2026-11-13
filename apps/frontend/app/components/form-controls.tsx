"use client"

import "./form-controls.css"

export function FormRow({
	label,
	hint,
	children,
}: {
	label: string
	hint?: string
	children: React.ReactNode
}) {
	return (
		<div className="form-row">
			<div className="label-col">
				<span className="label">{label}</span>
				{hint ? <span className="hint">{hint}</span> : null}
			</div>
			<div className="control-col">{children}</div>
		</div>
	)
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T
	options: Array<{ id: T; label: string }>
	onChange: (value: T) => void
}) {
	return (
		<div className="segmented" role="group">
			{options.map((opt) => (
				<button
					key={opt.id}
					type="button"
					className={`segment${value === opt.id ? " on" : ""}`}
					onClick={() => onChange(opt.id)}
				>
					{opt.label}
				</button>
			))}
		</div>
	)
}

export function SelectField({
	value,
	onChange,
	options,
	placeholder = "Select…",
}: {
	value: string | null
	onChange: (value: string | null) => void
	options: Array<{ value: string; label: string }>
	placeholder?: string
}) {
	return (
		<select
			className="select-field"
			value={value ?? ""}
			onChange={(e) => onChange(e.target.value || null)}
		>
			<option value="">{placeholder}</option>
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	)
}

export function TextAreaField({
	value,
	onChange,
	maxLength = 2000,
	placeholder,
}: {
	value: string
	onChange: (value: string) => void
	maxLength?: number
	placeholder?: string
}) {
	return (
		<div className="textarea-field">
			<textarea
				value={value}
				maxLength={maxLength}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
			/>
			<span className="counter">
				{value.length}/{maxLength}
			</span>
		</div>
	)
}

export function TextField({
	label,
	value,
	onChange,
	placeholder,
	className,
}: {
	label: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
	className?: string
}) {
	return (
		<label className={`text-field${className ? ` ${className}` : ""}`}>
			<span>{label}</span>
			<input
				type="text"
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	)
}
