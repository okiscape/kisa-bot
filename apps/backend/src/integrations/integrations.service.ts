import { Injectable, Logger } from "@nestjs/common";
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
    pp: number | null;
    globalRank: number | null;
  };
  lastfm: {
    linked: boolean;
    username: string | null;
    configured: boolean;
    scrobbles: number | null;
    topArtistWeek: string | null;
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
  private readonly logger = new Logger(IntegrationsService.name);

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

  private decrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
      return this.crypto.decrypt(value);
    } catch {
      return null;
    }
  }

  private emptyOsuStats() {
    return { pp: null as number | null, globalRank: null as number | null };
  }

  private emptyLastfmStats() {
    return {
      scrobbles: null as number | null,
      topArtistWeek: null as string | null,
    };
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

    const [osuStats, lastfmStats] = await Promise.all([
      osuLinked ? this.fetchOsuStats(userId, row) : this.emptyOsuStats(),
      lastfmLinked && row?.lastfmUsername
        ? this.fetchLastfmStats(row.lastfmUsername)
        : this.emptyLastfmStats(),
    ]);

    return {
      osu: {
        linked: osuLinked,
        username: osuLinked ? (row?.osuUsername ?? null) : null,
        userId:
          osuLinked && row?.osuUserId != null ? String(row.osuUserId) : null,
        configured: this.osu.isConfigured(),
        ...osuStats,
      },
      lastfm: {
        linked: lastfmLinked,
        username: lastfmLinked ? (row?.lastfmUsername ?? null) : null,
        configured: this.lastfm.isConfigured(),
        ...lastfmStats,
      },
    };
  }

  private async fetchOsuStats(
    userId: string,
    row: {
      osuAccessTokenEncrypted: string | null;
      osuRefreshTokenEncrypted: string | null;
      osuTokenExpiresAt: Date | null;
      osuUsername: string | null;
    } | null,
  ): Promise<{ pp: number | null; globalRank: number | null }> {
    try {
      const accessToken = await this.ensureOsuAccessToken(userId, row);
      if (!accessToken) return this.emptyOsuStats();
      const me = await this.osu.getMe(accessToken);
      return { pp: me.pp, globalRank: me.globalRank };
    } catch (err) {
      this.logger.warn(
        `osu stats fetch failed for ${userId}: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return this.emptyOsuStats();
    }
  }

  private async ensureOsuAccessToken(
    userId: string,
    row: {
      osuAccessTokenEncrypted: string | null;
      osuRefreshTokenEncrypted: string | null;
      osuTokenExpiresAt: Date | null;
    } | null,
  ): Promise<string | null> {
    if (!row) return null;
    const accessToken = this.decrypt(row.osuAccessTokenEncrypted);
    if (!accessToken) return null;

    const expiresAt = row.osuTokenExpiresAt?.getTime() ?? 0;
    const stillFresh = expiresAt > Date.now() + 60_000;
    if (stillFresh) return accessToken;

    const refreshToken = this.decrypt(row.osuRefreshTokenEncrypted);
    if (!refreshToken) return accessToken;

    try {
      const refreshed = await this.osu.refreshAccessToken(refreshToken);
      const expires = new Date(Date.now() + refreshed.expiresIn * 1000);
      await this.prisma.userSettings.update({
        where: { userId: BigInt(userId) },
        data: {
          osuAccessTokenEncrypted: this.crypto.encrypt(refreshed.accessToken),
          osuRefreshTokenEncrypted: refreshed.refreshToken
            ? this.crypto.encrypt(refreshed.refreshToken)
            : row.osuRefreshTokenEncrypted,
          osuTokenExpiresAt: expires,
        },
      });
      await this.invalidateUserSettings(userId);
      return refreshed.accessToken;
    } catch {
      return accessToken;
    }
  }

  private async fetchLastfmStats(
    username: string,
  ): Promise<{ scrobbles: number | null; topArtistWeek: string | null }> {
    try {
      return await this.lastfm.getUserStats(username);
    } catch (err) {
      this.logger.warn(
        `last.fm stats fetch failed for ${username}: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return this.emptyLastfmStats();
    }
  }

  /**
   * Decrypt credentials for trusted consumers (e.g. future Discord bot sync).
   * Do not expose via public HTTP.
   */
  async getLinkedCredentials(userId: string): Promise<LinkedIntegrations> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId: BigInt(userId) },
    });

    return {
      userId,
      osu: {
        linked: Boolean(row?.osuUsername && row.osuAccessTokenEncrypted),
        username: row?.osuUsername ?? null,
        userId: row?.osuUserId != null ? String(row.osuUserId) : null,
        accessToken: this.decrypt(row?.osuAccessTokenEncrypted),
        refreshToken: this.decrypt(row?.osuRefreshTokenEncrypted),
        expiresAt: row?.osuTokenExpiresAt?.toISOString() ?? null,
      },
      lastfm: {
        linked: Boolean(row?.lastfmUsername && row.lastfmSessionKeyEncrypted),
        username: row?.lastfmUsername ?? null,
        sessionKey: this.decrypt(row?.lastfmSessionKeyEncrypted),
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
