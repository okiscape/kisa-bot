const CDN = "https://cdn.discordapp.com";

function animatedExt(hash: string): "gif" | "png" {
  return hash.startsWith("a_") ? "gif" : "png";
}

/** Discord default avatar index from snowflake (userId >> 22) % 6. */
export function defaultAvatarUrl(userId: string): string {
  const index = Number((BigInt(userId) >> 22n) % 6n);
  return `${CDN}/embed/avatars/${index}.png`;
}

export function avatarUrl(
  userId: string,
  hash: string | null | undefined,
  size = 256,
): string {
  if (!hash) return defaultAvatarUrl(userId);
  const ext = animatedExt(hash);
  return `${CDN}/avatars/${userId}/${hash}.${ext}?size=${size}`;
}

export function bannerUrl(
  userId: string,
  hash: string | null | undefined,
  size = 600,
): string | null {
  if (!hash) return null;
  const ext = animatedExt(hash);
  return `${CDN}/banners/${userId}/${hash}.${ext}?size=${size}`;
}

export function avatarDecorationUrl(
  asset: string | null | undefined,
): string | null {
  if (!asset) return null;
  return `${CDN}/avatar-decoration-presets/${asset}.png`;
}

export function guildIconUrl(
  guildId: string,
  hash: string | null | undefined,
  size = 128,
): string | null {
  if (!hash) return null;
  const ext = animatedExt(hash);
  return `${CDN}/icons/${guildId}/${hash}.${ext}?size=${size}`;
}
