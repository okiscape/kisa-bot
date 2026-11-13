/** Shared API contracts for Kisa backend + frontend. */

export interface ApiSuccess<T> {
  data: T;
  meta: { requestId: string; [key: string]: unknown };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: { requestId: string };
}

export interface DiscordUserSummary {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string;
}

export interface DiscordProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string;
  banner: string | null;
  bannerUrl: string | null;
  accentColor: number | null;
  avatarDecoration: { asset: string; skuId: string; expiresAt: number | null } | null;
  avatarDecorationUrl: string | null;
  collectibles: {
    nameplate: {
      skuId: string;
      asset: string;
      label: string;
      palette: string;
    } | null;
  } | null;
  bot: boolean;
}

export interface GuildDiscoveryItem {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
  isAdmin: boolean;
  isManageable: boolean;
  hasBot: boolean;
  canInviteBot: boolean;
  botInviteUrl: string | null;
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  mentionable: boolean;
  hoist: boolean;
}

export interface GuildChannel {
  id: string;
  type: number;
  name: string;
  position: number;
  parentId: string | null;
}

export interface MessageEmbedConfig {
  title?: string | null;
  description?: string | null;
  color?: string | null;
  url?: string | null;
  authorName?: string | null;
  authorIconUrl?: string | null;
  authorUrl?: string | null;
  footerText?: string | null;
  footerIconUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

export interface MessageConfig {
  enabled: boolean;
  channelId: string | null;
  sender: "bot" | "webhook";
  webhookUrl: string | null;
  content: string;
  embeds: MessageEmbedConfig[];
}

export interface ServerSettings {
  guildId: string;
  averageLanguage: string | null;
  badWords: string | null;
  notifiedModerators: string | null;
  notifyChannel: string | null;
  badWordsAction: string | null;
  joinChannel: string | null;
  leaveChannel: string | null;
  postChannel: string | null;
  muteRole: string | null;
  autoRole: string | null;
  logChannel: string | null;
  verifiedRole: string | null;
  ticketCategory: string | null;
  fareText: string | null;
  fareColor: string | null;
  fareImage: string | null;
  greetText: string | null;
  greetColor: string | null;
  greetImage: string | null;
  privateCrChannel: string | null;
  privateCategory: string | null;
  customGreet: string | null;
  customFare: string | null;
  notifyText: string | null;
  collectMetrics: boolean | null;
  greetingConfig: MessageConfig;
  farewellConfig: MessageConfig;
  loggingConfig: LoggingRule[];
  honeypotChannel: string | null;
  reactionRoles: ReactionRole[];
}

export interface LoggingRule {
  channelId: string | null;
  webhookUrl: string | null;
  eventType: string;
  ignoreItems: string[];
}

export interface ReactionRole {
  emoji: string;
  roleId: string;
  messageId: string | null;
}

export interface UserSettings {
  userId: string;
  timezone: string | null;
  osuUsername: string | null;
}

export interface UserProfile {
  userId: string;
  aboutMe: string | null;
  color: string | null;
  customImage: string | null;
}

export interface IntegrationStatus {
  osu: {
    linked: boolean;
    username: string | null;
    userId: string | null;
    configured: boolean;
  };
  lastfm: {
    linked: boolean;
    username: string | null;
    configured: boolean;
  };
}

export interface PublicUserProfile {
  id: string;
  username: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: number | null;
  aboutMe: string | null;
  color: string | null;
  rating: number | null;
}

export interface MetricsSummary {
  online: boolean;
  guildCount: number;
  userCount: number;
  commandCount: number;
  usedCommands: number;
  uptimeSeconds: number;
  latencyMs: number;
  version: string;
  updatedAt: string | null;
  fetchedAt: string;
  stale: boolean;
}

export interface MetricsDetailed extends MetricsSummary {
  channelCount: number;
  shardCount: number;
}

/** @deprecated Prefer DiscordUserSummary / DiscordProfile */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  globalName: string | null;
  avatar: string | null;
}

/** @deprecated Prefer GuildDiscoveryItem */
export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

/** @deprecated Prefer MetricsSummary */
export interface BotStatus {
  status: "online" | "offline" | "starting";
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface SocialRating {
  userId: string;
  rating: number;
}
