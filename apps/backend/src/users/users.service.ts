import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DiscordApiClient } from "../discord/discord-api.client";
import { CacheService } from "../cache/cache.service";
import {
  avatarDecorationUrl,
  avatarUrl,
  bannerUrl,
} from "../discord/discord-cdn.util";
import { UpdateUserSettingsDto } from "./dto/update-user-settings.dto";
import { UpdateUserProfileDto } from "./dto/update-user-profile.dto";
import {
  defaultUserProfile,
  defaultUserSettings,
  UserProfileDto,
  UserSettingsDto,
} from "./user-settings.defaults";
import { DiscordUser } from "../auth/discord-user.interface";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discord: DiscordApiClient,
    private readonly cache: CacheService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: BigInt(userId) },
    });
    if (!profile) return defaultUserProfile(userId);
    return {
      userId,
      aboutMe: profile.aboutMe,
      color: profile.color,
      customImage: profile.customImage,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    const patch: Record<string, string | null> = {};
    if (dto.aboutMe !== undefined) patch.aboutMe = dto.aboutMe;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.customImage !== undefined) patch.customImage = dto.customImage;

    await this.prisma.userProfile.upsert({
      where: { userId: BigInt(userId) },
      create: { userId: BigInt(userId), ...patch },
      update: patch,
    });
    return this.getProfile(userId);
  }

  async resetProfile(userId: string): Promise<UserProfileDto> {
    try {
      await this.prisma.userProfile.delete({
        where: { userId: BigInt(userId) },
      });
    } catch {
      // already absent
    }
    return defaultUserProfile(userId);
  }

  async getSettings(userId: string): Promise<UserSettingsDto> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId: BigInt(userId) },
    });
    if (!settings) return defaultUserSettings(userId);
    return {
      userId,
      timezone: settings.timezone,
      osuUsername: settings.osuUsername,
    };
  }

  async updateSettings(
    userId: string,
    dto: UpdateUserSettingsDto,
  ): Promise<UserSettingsDto> {
    const patch: Record<string, string | null> = {};
    if (dto.timezone !== undefined) patch.timezone = dto.timezone;
    if (dto.osuUsername !== undefined) patch.osuUsername = dto.osuUsername;

    await this.prisma.userSettings.upsert({
      where: { userId: BigInt(userId) },
      create: { userId: BigInt(userId), ...patch },
      update: patch,
    });
    return this.getSettings(userId);
  }

  async resetSettings(userId: string): Promise<UserSettingsDto> {
    try {
      await this.prisma.userSettings.delete({
        where: { userId: BigInt(userId) },
      });
    } catch {
      // already absent
    }
    return defaultUserSettings(userId);
  }

  async getSocialRating(userId: string): Promise<number | null> {
    const rating = await this.prisma.socialRating.findUnique({
      where: { userId: BigInt(userId) },
    });
    return rating?.rating ?? null;
  }

  toDiscordProfile(user: DiscordUser) {
    return {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      avatarUrl: avatarUrl(user.id, user.avatar),
      banner: user.banner,
      bannerUrl: bannerUrl(user.id, user.banner),
      accentColor: user.accent_color,
      avatarDecoration: user.avatar_decoration_data
        ? {
            asset: user.avatar_decoration_data.asset,
            skuId: user.avatar_decoration_data.sku_id,
            expiresAt: user.avatar_decoration_data.expires_at,
          }
        : null,
      avatarDecorationUrl: avatarDecorationUrl(
        user.avatar_decoration_data?.asset,
      ),
      collectibles: user.collectibles
        ? {
            nameplate: user.collectibles.nameplate
              ? {
                  skuId: user.collectibles.nameplate.sku_id,
                  asset: user.collectibles.nameplate.asset,
                  label: user.collectibles.nameplate.label,
                  palette: user.collectibles.nameplate.palette,
                }
              : null,
          }
        : null,
      bot: false,
    };
  }

  async getFullProfile(userId: string, discordUser?: DiscordUser) {
    const [profile, settings, rating] = await Promise.all([
      this.getProfile(userId),
      this.getSettings(userId),
      this.getSocialRating(userId),
    ]);

    return {
      profile,
      settings,
      rating,
      discord: discordUser
        ? {
            id: discordUser.id,
            username: discordUser.username,
            globalName: discordUser.global_name,
            avatar: discordUser.avatar,
            avatarUrl: avatarUrl(discordUser.id, discordUser.avatar),
          }
        : undefined,
    };
  }

  /** Safe public fields only — never settings/tokens. */
  async getPublicProfile(userId: string) {
    const [profile, rating, discordUser] = await Promise.all([
      this.getProfile(userId),
      this.getSocialRating(userId),
      this.getCachedDiscordUser(userId),
    ]);

    return {
      id: userId,
      username: discordUser?.username ?? null,
      globalName: discordUser?.global_name ?? null,
      avatarUrl: discordUser
        ? avatarUrl(discordUser.id, discordUser.avatar)
        : profile.customImage,
      bannerUrl: discordUser
        ? bannerUrl(discordUser.id, discordUser.banner)
        : null,
      accentColor: discordUser?.accent_color ?? null,
      aboutMe: profile.aboutMe,
      color: profile.color,
      rating,
    };
  }

  private async getCachedDiscordUser(userId: string) {
    try {
      const { value } = await this.cache.getOrSet(
        `discord:user:${userId}:public`,
        () => this.discord.getUserById(userId),
        { ttlSeconds: 300, staleSeconds: 3600, staleIfError: true },
      );
      return value;
    } catch {
      return null;
    }
  }
}
