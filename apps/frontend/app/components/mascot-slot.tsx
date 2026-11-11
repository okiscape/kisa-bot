import clsx from "clsx"
import "./mascot-slot.css"

type Props = {
	width: number
	height: number
	label?: string
	className?: string
	radius?: number
}

export default function MascotSlot({
	width,
	height,
	label = "Маскот",
	className,
	radius = 40,
}: Props) {
	return (
		<div
			className={clsx("mascotslot", className)}
			style={{ width, height, borderRadius: radius }}
			aria-label="Mascot placeholder"
		>
			<span>{label}</span>
		</div>
	)
}
