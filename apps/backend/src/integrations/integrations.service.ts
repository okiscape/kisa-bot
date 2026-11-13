import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TokenCryptoService } from "../auth/token-crypto.service";
import { CacheService } from "../cache/cache.service";
import { userSettingsCacheKey } from "../cache/app-cache-keys";
import { OsuApiClient, OsuTokenResponse } from "./osu-api.client";
import { LastfmApiClient } from "./lastfm-api.client";

export type IntegrationStatus = {
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
};

/** Safe view for the Discord bot later — never expose raw tokens. */
export type LinkedIntegrations = {
  userId: string;
  osu: {
    linked: boolean;
    username: string | null;
    userId: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: string | null;
  };
  lastfm: {
    linked: boolean;
    username: string | null;
    sessionKey: string | null;
  };
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: TokenCryptoService,
    private readonly cache: CacheService,
    private readonly osu: OsuApiClient,
    private readonly lastfm: LastfmApiClient,
  ) {}

  private async invalidateUserSettings(userId: string): Promise<void> {
    await this.cache.delete(userSettingsCacheKey(userId));
  }

  async getStatus(userId: string): Promise<IntegrationStatus> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId: BigInt(userId) },
    });

    const osuLinked = Boolean(
      row?.osuUsername && row.osuAccessTokenEncrypted,
    );
    const lastfmLinked = Boolean(
      row?.lastfmUsername && row.lastfmSessionKeyEncrypted,
    );

    return {
      osu: {
        linked: osuLinked,
        username: osuLinked ? (row?.osuUsername ?? null) : null,
        userId:
          osuLinked && row?.osuUserId != null ? String(row.osuUserId) : null,
        configured: this.osu.isConfigured(),
      },
      lastfm: {
        linked: lastfmLinked,
        username: lastfmLinked ? (row?.lastfmUsername ?? null) : null,
        configured: this.lastfm.isConfigured(),
      },
    };
  }

  /**
   * Decrypt credentials for trusted consumers (e.g. future Discord bot sync).
   * Do not expose via public HTTP.
   */
  async getLinkedCredentials(userId: string): Promise<LinkedIntegrations> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId: BigInt(userId) },
    });

    const decrypt = (value: string | null | undefined) => {
      if (!value) return null;
      try {
        return this.crypto.decrypt(value);
      } catch {
        return null;
      }
    };

    return {
      userId,
      osu: {
        linked: Boolean(row?.osuUsername && row.osuAccessTokenEncrypted),
        username: row?.osuUsername ?? null,
        userId: row?.osuUserId != null ? String(row.osuUserId) : null,
        accessToken: decrypt(row?.osuAccessTokenEncrypted),
        refreshToken: decrypt(row?.osuRefreshTokenEncrypted),
        expiresAt: row?.osuTokenExpiresAt?.toISOString() ?? null,
      },
      lastfm: {
        linked: Boolean(row?.lastfmUsername && row.lastfmSessionKeyEncrypted),
        username: row?.lastfmUsername ?? null,
        sessionKey: decrypt(row?.lastfmSessionKeyEncrypted),
      },
    };
  }

  async linkOsu(
    userId: string,
    tokens: OsuTokenResponse,
    osuUser: { id: number; username: string },
  ): Promise<IntegrationStatus> {
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    const patch = {
      osuUsername: osuUser.username,
      osuUserId: BigInt(osuUser.id),
      osuAccessTokenEncrypted: this.crypto.encrypt(tokens.accessToken),
      osuRefreshTokenEncrypted: tokens.refreshToken
        ? this.crypto.encrypt(tokens.refreshToken)
        : null,
      osuTokenExpiresAt: expiresAt,
    };

    await this.prisma.userSettings.upsert({
      where: { userId: BigInt(userId) },
      create: { userId: BigInt(userId), ...patch },
      update: patch,
    });
    await this.invalidateUserSettings(userId);

    return this.getStatus(userId);
  }

  async unlinkOsu(userId: string): Promise<IntegrationStatus> {
    await this.prisma.userSettings.upsert({
      where: { userId: BigInt(userId) },
      create: { userId: BigInt(userId) },
      update: {
        osuUsername: null,
        osuUserId: null,
        osuAccessTokenEncrypted: null,
        osuRefreshTokenEncrypted: null,
        osuTokenExpiresAt: null,
      },
    });
    await this.invalidateUserSettings(userId);
    return this.getStatus(userId);
  }

  async linkLastfm(
    userId: string,
    session: { username: string; sessionKey: string },
  ): Promise<IntegrationStatus> {
    const patch = {
      lastfmUsername: session.username,
      lastfmSessionKeyEncrypted: this.crypto.encrypt(session.sessionKey),
    };

    await this.prisma.userSettings.upsert({
      where: { userId: BigInt(userId) },
      create: { userId: BigInt(userId), ...patch },
      update: patch,
    });
    await this.invalidateUserSettings(userId);

    return this.getStatus(userId);
  }

  async unlinkLastfm(userId: string): Promise<IntegrationStatus> {
    await this.prisma.userSettings.upsert({
      where: { userId: BigInt(userId) },
      create: { userId: BigInt(userId) },
      update: {
        lastfmUsername: null,
        lastfmSessionKeyEncrypted: null,
      },
    });
    await this.invalidateUserSettings(userId);
    return this.getStatus(userId);
  }
}
