/** Shared Redis keys for bot + backend settings cache. */

export const SETTINGS_CACHE_TTL_SECONDS = 30;

/** Discord upstream response caches (backend). */
export const DISCORD_USER_ME_TTL_SECONDS = 120;
export const DISCORD_USER_ME_STALE_SECONDS = 600;
export const DISCORD_USER_GUILDS_TTL_SECONDS = 300;
export const DISCORD_USER_GUILDS_STALE_SECONDS = 1800;
export const DISCORD_BOT_GUILDS_TTL_SECONDS = 300;
export const DISCORD_BOT_GUILDS_STALE_SECONDS = 3600;

export function guildSettingsCacheKey(guildId: string | number | bigint): string {
  return `app:guild:${String(guildId)}:settings`;
}

export function userSettingsCacheKey(userId: string | number | bigint): string {
  return `app:user:${String(userId)}:settings`;
}

export function userProfileCacheKey(userId: string | number | bigint): string {
  return `app:user:${String(userId)}:profile`;
}

export function discordUserMeCacheKey(userId: string | number | bigint): string {
  return `discord:user:${String(userId)}:me`;
}

export function discordUserGuildsCacheKey(
  userId: string | number | bigint,
): string {
  return `discord:user:${String(userId)}:guilds`;
}

export function discordBotGuildIdsCacheKey(): string {
  return "discord:bot-guild-ids";
}
