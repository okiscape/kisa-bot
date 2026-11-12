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

  /**
   * Refresh Discord access token if expired or Discord returns 401 once.
   */
  async ensureFreshAccessToken(
    active: ActiveSession,
  ): Promise<{ accessToken: string; user: DiscordUser }> {
    let accessToken = active.accessToken;
    let refreshToken = active.refreshToken;

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
    };

    if (this.sessions.isAccessTokenExpired(active.session)) {
      await tryRefresh();
    }

    try {
      const user = await this.getUser(accessToken);
      return { accessToken, user };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        await tryRefresh();
        const user = await this.getUser(accessToken);
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
      `discord:user:${userId}:guilds`,
      () => this.discord.getUserGuilds(accessToken),
      { ttlSeconds: 60, staleSeconds: 120, staleIfError: true },
    );
    return value;
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
      this.cache.getOrSet(
        "discord:bot-guild-ids",
        () => this.discord.getBotGuildIds(),
        { ttlSeconds: 60, staleSeconds: 600, staleIfError: true },
      ),
    ]);
    const botSet = new Set(botGuildIds.value);

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
