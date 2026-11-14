import { Injectable, UnauthorizedException } from "@nestjs/common";
import { DiscordUser } from "./discord-user.interface";
import {
  ActiveSession,
  DiscordTokenBundle,
  SessionService,
} from "./session.service";
import { ErrorCodes } from "../common/types/error-codes";
import {
  DiscordApiClient,
  DiscordTokenBundle as ClientTokenBundle,
} from "../discord/discord-api.client";
import { DiscordApiGuild } from "../discord/discord.types";
import { CacheService } from "../cache/cache.service";
import {
  DISCORD_BOT_GUILDS_STALE_SECONDS,
  DISCORD_BOT_GUILDS_TTL_SECONDS,
  DISCORD_USER_GUILDS_STALE_SECONDS,
  DISCORD_USER_GUILDS_TTL_SECONDS,
  DISCORD_USER_ME_STALE_SECONDS,
  DISCORD_USER_ME_TTL_SECONDS,
  discordBotGuildIdsCacheKey,
  discordUserGuildsCacheKey,
  discordUserMeCacheKey,
} from "../cache/app-cache-keys";

export type DiscordGuild = DiscordApiGuild;

export interface GuildWithBotStatus {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  hasBot: boolean;
}

export interface DiscordGuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  mentionable: boolean;
  hoist: boolean;
}

const PERMISSIONS = {
  ADMINISTRATOR: 0x8n,
  MANAGE_GUILD: 0x20n,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly discord: DiscordApiClient,
    private readonly sessions: SessionService,
    private readonly cache: CacheService,
  ) {}

  exchangeCode(code: string): Promise<DiscordTokenBundle> {
    return this.discord.exchangeCode(code) as Promise<DiscordTokenBundle>;
  }

  refreshAccessToken(refreshToken: string): Promise<DiscordTokenBundle> {
    return this.discord.refreshAccessToken(
      refreshToken,
    ) as Promise<DiscordTokenBundle>;
  }

  async getUser(accessToken: string): Promise<DiscordUser> {
    return this.discord.getCurrentUser(accessToken) as Promise<DiscordUser>;
  }

  async getCachedUser(
    accessToken: string,
    userId: string,
  ): Promise<DiscordUser> {
    const { value } = await this.cache.getOrSet(
      discordUserMeCacheKey(userId),
      () => this.discord.getCurrentUser(accessToken) as Promise<DiscordUser>,
      {
        ttlSeconds: DISCORD_USER_ME_TTL_SECONDS,
        staleSeconds: DISCORD_USER_ME_STALE_SECONDS,
        staleIfError: true,
      },
    );
    return value;
  }

  /**
   * Refresh Discord access token if expired or Discord returns 401 once.
   * Current-user profile is cached to avoid hitting /users/@me on every request.
   */
  async ensureFreshAccessToken(
    active: ActiveSession,
  ): Promise<{ accessToken: string; user: DiscordUser }> {
    let accessToken = active.accessToken;
    let refreshToken = active.refreshToken;
    let didRefresh = false;
    const userId = String(active.session.userId);

    const tryRefresh = async () => {
      if (!refreshToken) {
        await this.sessions.revoke(active.session.id);
        throw new UnauthorizedException({
          code: ErrorCodes.SESSION_EXPIRED,
          message: "Session expired",
        });
      }
      const refreshed: ClientTokenBundle =
        await this.discord.refreshAccessToken(refreshToken);
      await this.sessions.rotateTokens(active.session.id, refreshed);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken ?? null;
      didRefresh = true;
    };

    if (this.sessions.isAccessTokenExpired(active.session)) {
      await tryRefresh();
    }

    const loadUser = async () => {
      if (didRefresh) {
        await this.cache.delete(discordUserMeCacheKey(userId));
      }
      return this.getCachedUser(accessToken, userId);
    };

    try {
      const user = await loadUser();
      return { accessToken, user };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        await tryRefresh();
        await this.cache.delete(discordUserMeCacheKey(userId));
        const user = await this.getCachedUser(accessToken, userId);
        return { accessToken, user };
      }
      throw err;
    }
  }

  getUserGuilds(accessToken: string): Promise<DiscordApiGuild[]> {
    return this.discord.getUserGuilds(accessToken);
  }

  async getCachedUserGuilds(
    accessToken: string,
    userId: string,
  ): Promise<DiscordApiGuild[]> {
    const { value } = await this.cache.getOrSet(
      discordUserGuildsCacheKey(userId),
      () => this.discord.getUserGuilds(accessToken),
      {
        ttlSeconds: DISCORD_USER_GUILDS_TTL_SECONDS,
        staleSeconds: DISCORD_USER_GUILDS_STALE_SECONDS,
        staleIfError: true,
      },
    );
    return value;
  }

  async getCachedBotGuildIds(): Promise<string[]> {
    const { value } = await this.cache.getOrSet(
      discordBotGuildIdsCacheKey(),
      () => this.discord.getBotGuildIds(),
      {
        ttlSeconds: DISCORD_BOT_GUILDS_TTL_SECONDS,
        staleSeconds: DISCORD_BOT_GUILDS_STALE_SECONDS,
        staleIfError: true,
      },
    );
    return value;
  }

  /** Drop Discord caches for a user (logout / token revoke). */
  async invalidateDiscordUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cache.delete(discordUserMeCacheKey(userId)),
      this.cache.delete(discordUserGuildsCacheKey(userId)),
    ]);
  }

  hasRequiredPermission(guild: DiscordApiGuild): boolean {
    if (guild.owner) return true;
    const permBits = BigInt(guild.permissions);
    return (
      (permBits & PERMISSIONS.ADMINISTRATOR) !== 0n ||
      (permBits & PERMISSIONS.MANAGE_GUILD) !== 0n
    );
  }

  async checkUserGuildAccess(
    accessToken: string,
    guildId: string,
    userId?: string,
  ): Promise<boolean> {
    const guilds = userId
      ? await this.getCachedUserGuilds(accessToken, userId)
      : await this.getUserGuilds(accessToken);
    const guild = guilds.find((g) => g.id === guildId);
    if (!guild) return false;
    return this.hasRequiredPermission(guild);
  }

  async getAllUserGuildsWithBotStatus(
    accessToken: string,
    userId?: string,
  ): Promise<GuildWithBotStatus[]> {
    const [userGuilds, botGuildIds] = await Promise.all([
      userId
        ? this.getCachedUserGuilds(accessToken, userId)
        : this.getUserGuilds(accessToken),
      this.getCachedBotGuildIds(),
    ]);
    const botSet = new Set(botGuildIds);

    return userGuilds
      .filter((g) => this.hasRequiredPermission(g))
      .sort((a, b) => {
        const aBot = botSet.has(a.id) ? 0 : 1;
        const bBot = botSet.has(b.id) ? 0 : 1;
        return aBot - bBot;
      })
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner: g.owner,
        hasBot: botSet.has(g.id),
      }));
  }

  getGuildInfo(guildId: string) {
    return this.discord.getGuild(guildId);
  }

  async getGuildRoles(guildId: string): Promise<DiscordGuildRole[]> {
    return this.discord.getGuildRoles(guildId);
  }
}
