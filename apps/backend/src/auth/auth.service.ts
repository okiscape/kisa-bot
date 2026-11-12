import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscordUser } from "./discord-user.interface";
import {
  ActiveSession,
  DiscordTokenBundle,
  SessionService,
} from "./session.service";
import { ErrorCodes } from "../common/types/error-codes";

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

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
  private readonly discordApi = "https://discord.com/api/v10";
  private botGuildsCache: { data: Set<string>; expiresAt: number } | null =
    null;
  private readonly BOT_GUILDS_CACHE_TTL = 60_000;

  constructor(
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
  ) {}

  private async fetchWithRetry(
    input: string | URL,
    init?: RequestInit,
    retries = 2,
    delayMs = 500,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(input, init);
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after") || "1");
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        return res;
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  private discordConfig(key: "clientId" | "clientSecret" | "redirectUri" | "botToken") {
    const nested = this.config.get<string>(`discord.${key}`);
    if (nested) return nested;
    const envMap = {
      clientId: "DISCORD_CLIENT_ID",
      clientSecret: "DISCORD_CLIENT_SECRET",
      redirectUri: "DISCORD_REDIRECT_URI",
      botToken: "DISCORD_BOT_TOKEN",
    } as const;
    return this.config.getOrThrow<string>(envMap[key]);
  }

  async exchangeCode(code: string): Promise<DiscordTokenBundle> {
    const res = await this.fetchWithRetry(`${this.discordApi}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.discordConfig("clientId"),
        client_secret: this.discordConfig("clientSecret"),
        grant_type: "authorization_code",
        code,
        redirect_uri: this.discordConfig("redirectUri"),
      }),
    });
    if (!res.ok) {
      throw new Error("Failed to exchange Discord code");
    }
    const data = (await res.json()) as DiscordTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresIn: data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<DiscordTokenBundle> {
    const res = await this.fetchWithRetry(`${this.discordApi}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.discordConfig("clientId"),
        client_secret: this.discordConfig("clientSecret"),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      throw new UnauthorizedException({
        code: ErrorCodes.SESSION_EXPIRED,
        message: "Failed to refresh Discord token",
      });
    }
    const data = (await res.json()) as DiscordTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
    };
  }

  async getUser(accessToken: string): Promise<DiscordUser> {
    const res = await this.fetchWithRetry(`${this.discordApi}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) {
      throw new UnauthorizedException({
        code: ErrorCodes.SESSION_EXPIRED,
        message: "Discord access token rejected",
      });
    }
    if (!res.ok) {
      throw new Error("Failed to fetch Discord user");
    }
    return res.json() as Promise<DiscordUser>;
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
      const refreshed = await this.refreshAccessToken(refreshToken);
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

  async getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
    const res = await this.fetchWithRetry(
      `${this.discordApi}/users/@me/guilds`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch Discord guilds");
    return res.json() as Promise<DiscordGuild[]>;
  }

  private async fetchBotGuildIds(): Promise<Set<string>> {
    const botToken = this.discordConfig("botToken");
    let allGuilds: { id: string }[] = [];
    let after: string | undefined;

    while (true) {
      const url = new URL(`${this.discordApi}/users/@me/guilds`);
      url.searchParams.set("limit", "200");
      if (after) url.searchParams.set("after", after);

      const res = await this.fetchWithRetry(url, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch bot guilds");

      const page = (await res.json()) as { id: string }[];
      if (page.length === 0) break;

      allGuilds = allGuilds.concat(page);
      after = page[page.length - 1].id;
      if (page.length < 200) break;
    }

    return new Set(allGuilds.map((g) => g.id));
  }

  private async getBotGuildIds(): Promise<Set<string>> {
    const now = Date.now();
    if (this.botGuildsCache && this.botGuildsCache.expiresAt > now) {
      return this.botGuildsCache.data;
    }

    const data = await this.fetchBotGuildIds();
    this.botGuildsCache = {
      data,
      expiresAt: now + this.BOT_GUILDS_CACHE_TTL,
    };
    return data;
  }

  hasRequiredPermission(guild: DiscordGuild): boolean {
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
  ): Promise<boolean> {
    const guilds = await this.getUserGuilds(accessToken);
    const guild = guilds.find((g) => g.id === guildId);
    if (!guild) return false;
    return this.hasRequiredPermission(guild);
  }

  async getAllUserGuildsWithBotStatus(
    accessToken: string,
  ): Promise<GuildWithBotStatus[]> {
    const [userGuilds, botGuildIds] = await Promise.all([
      this.getUserGuilds(accessToken),
      this.getBotGuildIds(),
    ]);

    return userGuilds
      .filter((g) => this.hasRequiredPermission(g))
      .sort((a, b) => {
        const aBot = botGuildIds.has(a.id) ? 0 : 1;
        const bBot = botGuildIds.has(b.id) ? 0 : 1;
        return aBot - bBot;
      })
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner: g.owner,
        hasBot: botGuildIds.has(g.id),
      }));
  }

  async getGuildInfo(
    guildId: string,
  ): Promise<{ id: string; name: string; icon: string | null }> {
    const botToken = this.discordConfig("botToken");
    const res = await this.fetchWithRetry(
      `${this.discordApi}/guilds/${guildId}`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch guild info");
    const guild = (await res.json()) as {
      id: string;
      name: string;
      icon: string | null;
    };
    return { id: guild.id, name: guild.name, icon: guild.icon };
  }

  async getGuildRoles(guildId: string): Promise<DiscordGuildRole[]> {
    const botToken = this.discordConfig("botToken");
    const res = await this.fetchWithRetry(
      `${this.discordApi}/guilds/${guildId}/roles`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch guild roles");
    const roles = (await res.json()) as Array<{
      id: string;
      name: string;
      color: number;
      position: number;
      mentionable: boolean;
      hoist: boolean;
    }>;
    return roles
      .filter((r) => r.id !== guildId)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        position: r.position,
        mentionable: r.mentionable,
        hoist: r.hoist,
      }));
  }
}
