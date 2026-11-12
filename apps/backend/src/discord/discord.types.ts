export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface DiscordApiUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  banner: string | null;
  accent_color: number | null;
  bot?: boolean;
  avatar_decoration_data: {
    asset: string;
    sku_id: string;
    expires_at: number | null;
  } | null;
  collectibles: {
    nameplate: {
      sku_id: string;
      asset: string;
      label: string;
      palette: string;
    } | null;
  } | null;
}

export interface DiscordApiGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export interface DiscordApiRole {
  id: string;
  name: string;
  color: number;
  position: number;
  mentionable: boolean;
  hoist: boolean;
  managed?: boolean;
  permissions?: string;
}

export interface DiscordApiChannel {
  id: string;
  type: number;
  name: string;
  position: number;
  parent_id: string | null;
}

/** Channel types useful for settings selects. */
export const SETTINGS_CHANNEL_TYPES = {
  GUILD_TEXT: 0,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  GUILD_STAGE_VOICE: 13,
  GUILD_FORUM: 15,
} as const;

export type SettingsChannelType =
  (typeof SETTINGS_CHANNEL_TYPES)[keyof typeof SETTINGS_CHANNEL_TYPES];
