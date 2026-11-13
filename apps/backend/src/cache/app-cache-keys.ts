/** Shared Redis keys for bot + backend settings cache. */

export const SETTINGS_CACHE_TTL_SECONDS = 30;

export function guildSettingsCacheKey(guildId: string | number | bigint): string {
  return `app:guild:${String(guildId)}:settings`;
}

export function userSettingsCacheKey(userId: string | number | bigint): string {
  return `app:user:${String(userId)}:settings`;
}

export function userProfileCacheKey(userId: string | number | bigint): string {
  return `app:user:${String(userId)}:profile`;
}
