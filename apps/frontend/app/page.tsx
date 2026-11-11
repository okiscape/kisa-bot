import Header from "@/components/header"
import Button from "@/components/button"
import DecoBlock from "@/components/deco-block"
import MascotSlot from "@/components/mascot-slot"
import Appear from "@/components/appear"
import "./page.css"

const communitiesCount = 12480
const membersCount = 1204931
const commandsCount = 48
const uptimePercent = 99.9

const serverMembersCount = 1284
const serverOnlineCount = 12
const serverBoostsCount = 3

const _unknown_featureChips = [
	{ label: "Social rating", accent: true, left: 8, top: 60 },
	{ label: "Profile customization", accent: false, left: 280, top: 12 },
	{ label: "Games integrations", accent: false, left: 0, top: 160 },
	{ label: "Greet and farewell", accent: true, left: 340, top: 130 },
	{ label: "Server statistics", accent: false, left: 16, top: 270 },
	{ label: "Leveling", accent: true, left: 400, top: 240 },
	{ label: "Open source", accent: false, left: 40, top: 380 },
	{ label: "Temporary chats", accent: false, left: 310, top: 360 },
	{ label: "And many more!", accent: false, left: 180, top: 420 },
] as const

const _unknown_ratingRows = [
	{ name: "Name", hint: "Thanked 12 times this week", score: "+128", avatar: "/landing/avatar-1.png" },
	{ name: "Name", hint: "Thanked 12 times this week", score: "+96", avatar: "/landing/avatar-2.png" },
	{ name: "Name", hint: "Thanked 12 times this week", score: "+74", avatar: "/landing/avatar-3.png" },
] as const

const _unknown_profileName = "Name"
const _unknown_profileMeta = "Level 24, rating +128"
const _unknown_profileXp = 66
const _unknown_profileBadges = ["Badge name", "Badge name", "Badge name"] as const

const _unknown_statBars = [60, 90, 120, 160, 220] as const

const _unknown_leaders = [
	{ name: "Name", level: 24, progress: 86, avatar: "/landing/avatar-1.png" },
	{ name: "Name", level: 21, progress: 64, avatar: "/landing/avatar-2.png" },
	{ name: "Name", level: 17, progress: 88, avatar: "/landing/avatar-3.png" },
] as const

const _unknown_tempChats = [
	{ label: "Join to create", right: null, tone: "accent" as const },
	{ label: "Name's chat", right: "2 inside", tone: "default" as const },
	{ label: "Name's chat", right: "1 inside", tone: "default" as const },
	{ label: "Name's chat", right: "Empty", tone: "dim" as const },
]

const _unknown_greetServer = "Server name"
const _unknown_greetMention = "@Name"
const _unknown_greetTime = "Today at 14:02"
const _unknown_githubUrl = "https://github.com"

function formatCount(value: number) {
	return value.toLocaleString("en-US")
}

export default function Landing() {
	return (
		<div className="landing">
			<Header />

			<div className="hero">
				<div className="text">
					<div className="tag">
						<span className="text-[0.625rem] leading-none text-[var(--color-accent1)]">●</span>
						<span>Online in {formatCount(communitiesCount)} servers</span>
					</div>
					<h1 className="title">
						All-in-one
						<br />
						Discord bot.
					</h1>
					<p className="lead">
						Social rating, leveling, games and more, all managed from one calm dashboard.
					</p>
					<div className="actions">
						<Button href="/login" variant="warm" size="lg">
							Add to Discord
						</Button>
						<Button href="#features" variant="ghost" size="lg">
							Learn More
						</Button>
					</div>
				</div>

				<div className="cloud">
					<MascotSlot width={320} height={320} className="mascot" />
					{_unknown_featureChips.map((chip) => (
						<span
							key={chip.label}
							className={`chip${chip.accent ? " accent" : ""}`}
							style={{ left: chip.left, top: chip.top }}
						>
							{chip.accent ? (
								<span className="text-[0.625rem] leading-none text-[var(--color-accent1)]">●</span>
							) : null}
							{chip.label}
						</span>
					))}
				</div>
			</div>

			<section className="features" id="features">
				<article className="feature">
					<Appear className="copy">
						<span className="num">01</span>
						<h2>Social rating</h2>
						<p>
							Let members thank each other with points. Ratings grow over time and show who
							really helps the community.
						</p>
					</Appear>
					<Appear variant="reveal" className="visual" delayMs={80}>
						<DecoBlock
							className="panel rating"
						>
							<h3>Rating</h3>
							{_unknown_ratingRows.map((row) => (
								<div key={`${row.score}-${row.avatar}`} className="row">
									<img src={row.avatar} alt="" width={52} height={52} />
									<div>
										<strong>{row.name}</strong>
										<span>{row.hint}</span>
									</div>
									<span className="appear-number inline-flex h-11 items-center justify-center rounded-[22px] border border-[var(--color-border)] px-[22px] font-[var(--font-display)] text-base text-[var(--color-muted)]">
										{row.score}
									</span>
								</div>
							))}
						</DecoBlock>
					</Appear>
				</article>

				<article className="feature reverse">
					<Appear className="copy">
						<span className="num">02</span>
						<h2>Profile customization</h2>
						<p>
							Every member gets a profile card with level, rating and badges. Pick a style that
							fits your server.
						</p>
					</Appear>
					<Appear variant="reveal" className="visual" delayMs={80}>
						<DecoBlock
							className="panel profile"
						>
							<div className="banner" />
							<div className="avatar-ring" />
							<img className="avatar" src="/landing/avatar-1.png" alt="" width={100} height={100} />
							<strong className="name">{_unknown_profileName}</strong>
							<span className="meta">{_unknown_profileMeta}</span>
							<div className="xp">
								<span className="fill appear-meter" style={{ width: `${_unknown_profileXp}%` }} />
							</div>
							<div className="badges">
								{_unknown_profileBadges.map((badge, index) => (
									<span key={`${badge}-${index}`}>{badge}</span>
								))}
							</div>
						</DecoBlock>
					</Appear>
				</article>

				<article className="feature reverse" id="statistics">
					<Appear className="copy">
						<span className="num">03</span>
						<h2>Server statistics</h2>
						<p>
							Live counters in voice channels: members, online, boosts. Always up to date and
							never clutter the chat.
						</p>
					</Appear>
					<Appear variant="reveal" className="visual stats" delayMs={80}>
						<div className="card">
							<div className="category">
								<img src="/landing/chevron.svg" alt="" width={14} height={8} />
								<span>Server stats</span>
							</div>
							<div className="channel">
								<img src="/landing/icon-members.svg" alt="" width={20} height={16} />
								<span className="appear-number">Members: {formatCount(serverMembersCount)}</span>
							</div>
							<div className="channel">
								<img src="/landing/icon-online.svg" alt="" width={20} height={16} />
								<span className="appear-number">Online: {formatCount(serverOnlineCount)}</span>
							</div>
							<div className="channel">
								<img src="/landing/icon-boosts.svg" alt="" width={20} height={16} />
								<span className="appear-number">Boosts: {formatCount(serverBoostsCount)}</span>
							</div>
						</div>
						<div className="bars">
							{_unknown_statBars.map((height, index) => (
								<span
									key={height}
									className={`bar appear-bar${index >= 3 ? ` tone-${index}` : ""}`}
									style={{ height }}
								/>
							))}
						</div>
					</Appear>
				</article>

				<article className="feature">
					<Appear className="copy">
						<span className="num">04</span>
						<h2>Leveling</h2>
						<p>
							Give XP for chatting, post level up messages and hand out role rewards. A weekly
							leaderboard keeps things friendly.
						</p>
					</Appear>
					<Appear variant="reveal" className="visual" delayMs={80}>
						<DecoBlock
							className="panel level"
						>
							<h3>Leaderboard</h3>
							{_unknown_leaders.map((leader) => (
								<div key={`${leader.level}-${leader.avatar}`} className="row">
									<img src={leader.avatar} alt="" width={48} height={48} />
									<div>
										<div className="meta">
											<strong>{leader.name}</strong>
											<span className="appear-number">Level {leader.level}</span>
										</div>
										<div className="track">
											<span
												className="fill appear-meter"
												style={{ width: `${leader.progress}%` }}
											/>
										</div>
									</div>
								</div>
							))}
						</DecoBlock>
					</Appear>
				</article>

				<article className="feature reverse">
					<Appear className="copy">
						<span className="num">05</span>
						<h2>Temporary chats</h2>
						<p>
							Members create their own voice channels just by joining one. Empty channels
							disappear on their own.
						</p>
					</Appear>
					<Appear className="visual" delayMs={80}>
						<DecoBlock
							className="panel temp"
							pills={[
								{
									label: "Removed when empty",
									tone: "soft",
									style: { left: 360, top: 280 },
								},
							]}
						>
							{_unknown_tempChats.map((chat, index) => (
								<div
									key={`${chat.label}-${index}`}
									className={`row${chat.tone === "dim" ? " dim" : ""}`}
								>
									<div>
										<img
											src={index === 0 ? "/landing/icon-join.svg" : "/landing/icon-voice.svg"}
											alt=""
											width={18}
											height={16}
										/>
										<span
											className={
												chat.tone === "accent" ? "text-[var(--color-accent1)]" : undefined
											}
										>
											{chat.label}
										</span>
									</div>
									{chat.right ? <em>{chat.right}</em> : null}
								</div>
							))}
						</DecoBlock>
					</Appear>
				</article>

				<article className="feature">
					<Appear className="copy">
						<span className="num">06</span>
						<h2>Greet and farewell</h2>
						<p>
							Welcome new members and say goodbye with messages, embeds or webhooks. Use
							variables for names, counts and channels.
						</p>
					</Appear>
					<Appear className="visual" delayMs={80}>
						<DecoBlock className="panel greet">
							<div className="head">
								<img src="/landing/bot-avatar.png" alt="" width={44} height={44} />
								<div>
									<div>
										<strong>kisa</strong>
										<span className="inline-flex h-[18px] items-center rounded-[9px] bg-[var(--color-accent3)] px-2 font-[var(--font-display)] text-[0.6875rem] font-bold text-black">
											Bot
										</span>
									</div>
									<em>{_unknown_greetTime}</em>
								</div>
							</div>
							<p className="message">
								Welcome to {_unknown_greetServer}, <span>{_unknown_greetMention}</span>! Glad
								you&apos;re here.
							</p>
							<div className="embed">
								<span className="bar" />
								<div className="body">
									<strong>Greetings!</strong>
									<p>
										We&apos;re glad to see you on our server!
										<br />
										Please read the rules!
									</p>
									<img src="/landing/embed-image.png" alt="" width={496} height={150} />
								</div>
							</div>
						</DecoBlock>
					</Appear>
				</article>

				<article className="feature reverse">
					<Appear className="copy">
						<span className="num">07</span>
						<h2>Open source</h2>
						<p>
							kisa is open source. Read the code, report a bug or send a pull request, and make
							the bot yours.
						</p>
					</Appear>
					<Appear className="visual" delayMs={80}>
						<div className="open">
							<div className="code">
								<p>
									Welcome to <span>{"{{server}}"}</span>,
								</p>
								<p>
									<span>{"{{mention}}"}</span>!
								</p>
								<p>
									You are member #<span>{"{{count}}"}</span>.
								</p>
							</div>
							<Button href={_unknown_githubUrl} variant="ghost" size="md" className="github">
								View on GitHub
							</Button>
						</div>
					</Appear>
				</article>
			</section>

			<section className="counters" id="support">
				<div className="hairline" />
				<Appear className="head">
					<h2>There are many of us</h2>
					<p>Live numbers from the bot.</p>
				</Appear>
				<Appear variant="reveal" className="row">
					<div className="stat">
						<strong className="appear-number">{formatCount(communitiesCount)}</strong>
						<span>communities</span>
					</div>
					<span className="divider" />
					<div className="stat">
						<strong className="appear-number">{formatCount(membersCount)}</strong>
						<span>members</span>
					</div>
					<span className="divider" />
					<div className="stat">
						<strong className="appear-number">{formatCount(commandsCount)}</strong>
						<span>commands</span>
					</div>
					<span className="divider" />
					<div className="stat">
						<strong className="appear-number">{uptimePercent}%</strong>
						<span>uptime</span>
					</div>
				</Appear>
			</section>

			<section className="cta">
				<Appear className="band">
					<h2>Meet kisa.</h2>
					<p>Add kisa to your server and finish the setup in the dashboard.</p>
					<Button href="/login" variant="warm" size="lg">
						Add to Discord
					</Button>
				</Appear>
			</section>

			<footer className="footer">
				<div className="hairline" />
				<div className="row">
					<strong>kisa</strong>
					<nav aria-label="Footer">
						<a href="#docs">Docs</a>
						<a href="#commands">Commands</a>
						<a href="#statistics">Statistics</a>
						<a href="#support">Support us</a>
						<a href="#terms">Terms</a>
						<a href="#privacy">Privacy</a>
					</nav>
					<span>2026 kisa, open-source all-in-one bot</span>
				</div>
			</footer>
		</div>
	)
}
