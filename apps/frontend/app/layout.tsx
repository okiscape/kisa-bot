import "./globals.css";
import { ViewTransitions } from "next-view-transitions";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ViewTransitions>
			<html lang="en" className="h-full antialiased">
				<head>
					<title>Kisa</title>
				</head>
				<body>{children}</body>
			</html>
		</ViewTransitions>
	);
}
