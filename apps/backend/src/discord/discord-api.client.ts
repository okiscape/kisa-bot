import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ErrorCodes } from "../common/types/error-codes";
import {
  DiscordApiChannel,
  DiscordApiGuild,
  DiscordApiRole,
  DiscordApiUser,
  DiscordTokenResponse,
  SETTINGS_CHANNEL_TYPES,
} from "./discord.types";

export interface DiscordTokenBundle {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

type TokenKind = "Bearer" | "Bot";

interface RequestOptions {
  method?: string;
  token?: string;
  tokenKind?: TokenKind;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
}

@Injectable()
export class DiscordApiClient {
  private readonly logger = new Logger(DiscordApiClient.name);
  private readonly baseUrl = "https://discord.com/api/v10";

  constructor(private readonly config: ConfigService) {}

  private discordConfig(
    key: "clientId" | "clientSecret" | "redirectUri" | "botToken" | "botPermissions",
  ): string {
    const nested = this.config.get<string>(`discord.${key}`);
    if (nested) return nested;
    const envMap = {
      clientId: "DISCORD_CLIENT_ID",
      clientSecret: "DISCORD_CLIENT_SECRET",
      redirectUri: "DISCORD_REDIRECT_URI",
      botToken: "DISCORD_BOT_TOKEN",
      botPermissions: "DISCORD_BOT_PERMISSIONS",
    } as const;
    if (key === "botPermissions") {
      return this.config.get<string>(envMap[key]) || "285280256824";
    }
    return this.config.getOrThrow<string>(envMap[key]);
  }

  getBotInviteUrl(guildId?: string): string {
    const clientId = this.discordConfig("clientId");
    const permissions = this.discordConfig("botPermissions");
    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("permissions", permissions);
    url.searchParams.set("scope", "bot applications.commands");
    if (guildId) {
      url.searchParams.set("guild_id", guildId);
      url.searchParams.set("disable_guild_select", "true");
    }
    return url.toString();
  }

  async exchangeCode(code: string): Promise<DiscordTokenBundle> {
    const res = await this.request("/oauth2/token", {
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
    const res = await this.request("/oauth2/token", {
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

  async getCurrentUser(accessToken: string): Promise<DiscordApiUser> {
    const res = await this.request("/users/@me", {
      token: accessToken,
      tokenKind: "Bearer",
    });
    if (res.status === 401) {
      throw new UnauthorizedException({
        code: ErrorCodes.SESSION_EXPIRED,
        message: "Discord access token rejected",
      });
    }
    if (!res.ok) {
      throw this.mapUpstreamError(res.status, "Failed to fetch Discord user");
    }
    return res.json() as Promise<DiscordApiUser>;
  }

  async getBotUser(): Promise<DiscordApiUser> {
    const res = await this.request("/users/@me", {
      token: this.discordConfig("botToken"),
      tokenKind: "Bot",
    });
    if (!res.ok) {
      throw this.mapUpstreamError(res.status, "Failed to fetch Discord bot user");
    }
    return res.json() as Promise<DiscordApiUser>;
  }

  async getUserById(userId: string): Promise<DiscordApiUser | null> {
    const res = await this.request(`/users/${userId}`, {
      token: this.discordConfig("botToken"),
      tokenKind: "Bot",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw this.mapUpstreamError(res.status, "Failed to fetch Discord user by id");
    }
    return res.json() as Promise<DiscordApiUser>;
  }

  async getUserGuilds(accessToken: string): Promise<DiscordApiGuild[]> {
    const res = await this.request("/users/@me/guilds", {
      token: accessToken,
      tokenKind: "Bearer",
    });
    if (!res.ok) {
      throw this.mapUpstreamError(res.status, "Failed to fetch Discord guilds");
    }
    return res.json() as Promise<DiscordApiGuild[]>;
  }

  async getBotGuildIds(): Promise<string[]> {
    const botToken = this.discordConfig("botToken");
    const ids: string[] = [];
    let after: string | undefined;

    while (true) {
      const searchParams: Record<string, string> = { limit: "200" };
      if (after) searchParams.after = after;

      const res = await this.request("/users/@me/guilds", {
        token: botToken,
        tokenKind: "Bot",
        searchParams,
      });
      if (!res.ok) {
        throw this.mapUpstreamError(res.status, "Failed to fetch bot guilds");
      }

      const page = (await res.json()) as { id: string }[];
      if (page.length === 0) break;
      ids.push(...page.map((g) => g.id));
      after = page[page.length - 1].id;
      if (page.length < 200) break;
    }

    return ids;
  }

  async getGuild(
    guildId: string,
  ): Promise<{ id: string; name: string; icon: string | null }> {
    const res = await this.request(`/guilds/${guildId}`, {
      token: this.discordConfig("botToken"),
      tokenKind: "Bot",
    });
    if (res.status === 404) {
      throw new HttpException(
        {
          code: ErrorCodes.GUILD_NOT_FOUND,
          message: "Guild not found or bot is not a member",
        },
        404,
      );
    }
    if (!res.ok) {
      throw this.mapUpstreamError(res.status, "Failed to fetch guild info");
    }
    const guild = (await res.json()) as {
      id: string;
      name: string;
      icon: string | null;
    };
    return { id: guild.id, name: guild.name, icon: guild.icon };
  }

  async getGuildRoles(guildId: string): Promise<DiscordApiRole[]> {
    const res = await this.request(`/guilds/${guildId}/roles`, {
      token: this.discordConfig("botToken"),
      tokenKind: "Bot",
    });
    if (!res.ok) {
      throw this.mapUpstreamError(res.status, "Failed to fetch guild roles");
    }
    const roles = (await res.json()) as DiscordApiRole[];
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
        managed: r.managed,
      }));
  }

  async getGuildChannels(guildId: string): Promise<DiscordApiChannel[]> {
    const res = await this.request(`/guilds/${guildId}/channels`, {
      token: this.discordConfig("botToken"),
      tokenKind: "Bot",
    });
    if (!res.ok) {
      throw this.mapUpstreamError(res.status, "Failed to fetch guild channels");
    }
    const channels = (await res.json()) as DiscordApiChannel[];
    const allowed = new Set<number>(Object.values(SETTINGS_CHANNEL_TYPES));
    return channels
      .filter((c) => allowed.has(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        position: c.position,
        parent_id: c.parent_id,
      }));
  }

  private async request(
    path: string,
    options: RequestOptions = {},
    retries = 2,
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options.searchParams) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (options.token) {
      const kind = options.tokenKind ?? "Bearer";
      headers.Authorization = `${kind} ${options.token}`;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method: options.method ?? "GET",
          headers,
          body: options.body ?? undefined,
        });

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after") || "1");
          this.logger.warn(
            `Discord rate limited on ${path}; retry-after=${retryAfter}s`,
          );
          if (attempt === retries) {
            throw new HttpException(
              {
                code: ErrorCodes.DISCORD_RATE_LIMITED,
                message: "Discord rate limit exceeded",
                details: { retryAfter },
              },
              429,
            );
          }
          await this.sleep(retryAfter * 1000);
          continue;
        }

        return res;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        lastError = err;
        if (attempt < retries) {
          await this.sleep(500 * (attempt + 1));
          continue;
        }
      }
    }

    this.logger.warn(
      `Discord unavailable for ${path}: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
    throw new ServiceUnavailableException({
      code: ErrorCodes.DISCORD_UNAVAILABLE,
      message: "Discord API unavailable",
    });
  }

  private mapUpstreamError(status: number, message: string): HttpException {
    if (status === 429) {
      return new HttpException(
        {
          code: ErrorCodes.DISCORD_RATE_LIMITED,
          message: "Discord rate limit exceeded",
        },
        429,
      );
    }
    if (status >= 500) {
      return new ServiceUnavailableException({
        code: ErrorCodes.DISCORD_UNAVAILABLE,
        message,
      });
    }
    return new HttpException(
      {
        code: ErrorCodes.INTERNAL_ERROR,
        message,
      },
      status >= 400 && status < 600 ? status : 502,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
