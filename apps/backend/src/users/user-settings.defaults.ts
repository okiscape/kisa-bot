export type UserSettingsDto = {
  userId: string;
  timezone: string | null;
  osuUsername: string | null;
};

export type UserProfileDto = {
  userId: string;
  aboutMe: string | null;
  color: string | null;
  customImage: string | null;
};

export function defaultUserSettings(userId: string): UserSettingsDto {
  return { userId, timezone: null, osuUsername: null };
}

export function defaultUserProfile(userId: string): UserProfileDto {
  return { userId, aboutMe: null, color: null, customImage: null };
}
