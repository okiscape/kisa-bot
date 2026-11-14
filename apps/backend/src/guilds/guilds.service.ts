import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { DiscordApiClient } from "../discord/discord-api.client";
import { AuthService } from "../auth/auth.service";
import { guildIconUrl } from "../discord/discord-cdn.util";
import {
  DiscordApiChannel,
  DiscordApiGuild,
  DiscordApiRole,
} from "../discord/discord.types";
import { ErrorCodes } from "../common/types/error-codes";
import { UpdateGuildSettingsDto } from "./dto/update-guild-settings.dto";
import {
  BAD_WORDS_ACTIONS,
  GuildSettingsDto,
  mergeGuildSettings,
  SUPPORTED_LANGUAGES,
  defaultGuildSettings,
} from "./guild-settings.defaults";
import { normalizeMessageConfig } from "./message-config";
import { normalizeLoggingConfig } from "./logging-config";
import { guildSettingsCacheKey } from "../cache/app-cache-keys";

const PERMISSIONS = {
  ADMINISTRATOR: 0x8n,
  MANAGE_GUILD: 0x20n,
} as const;

const CHANNEL_FIELDS = [
  "notifyChannel",
  "joinChannel",
  "leaveChannel",
  "postChannel",
  "logChannel",
  "privateCrChannel",
  "ticketCategory",
  "privateCategory",
  "honeypotChannel",
] as const;

const ROLE_FIELDS = [
  "muteRole",
  "autoRole",
] as const;

export interface GuildDiscoveryItem {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
  isAdmin: boolean;
  isManageable: boolean;
  hasBot: boolean;
  canInviteBot: boolean;
  botInviteUrl: string | null;
}

export interface GuildDetail extends GuildDiscoveryItem {
  icon: string | null;
}

const bigIntFields = [
  "notifyChannel",
  "joinChannel",
  "leaveChannel",
  "postChannel",
  "muteRole",
  "autoRole",
  "logChannel",
  "ticketCategory",
  "privateCrChannel",
  "privateCategory",
  "honeypotChannel",
] as const;

@Injectable()
export class GuildsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly discord: DiscordApiClient,
    private readonly auth: AuthService,
  ) {}

  async listGuilds(
    accessToken: string,
    userId: string,
    filter: "all" | "manageable" = "manageable",
  ): Promise<GuildDiscoveryItem[]> {
    const [userGuilds, botGuildIds] = await Promise.all([
      this.auth.getCachedUserGuilds(accessToken, userId),
      this.auth.getCachedBotGuildIds(),
    ]);
    const botSet = new Set(botGuildIds);

    const mapped = userGuilds.map((g) => this.toDiscoveryItem(g, botSet));
    const filtered =
      filter === "all" ? mapped : mapped.filter((g) => g.isManageable);

    return filtered.sort((a, b) => {
      if (a.hasBot !== b.hasBot) return a.hasBot ? -1 : 1;
      if (a.canInviteBot !== b.canInviteBot) return a.canInviteBot ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getGuildDetail(
    accessToken: string,
    userId: string,
    guildId: string,
  ): Promise<GuildDetail | null> {
    const [userGuilds, botGuildIds] = await Promise.all([
      this.auth.getCachedUserGuilds(accessToken, userId),
      this.auth.getCachedBotGuildIds(),
    ]);
    const guild = userGuilds.find((g) => g.id === guildId);
    if (!guild || !this.auth.hasRequiredPermission(guild)) {
      return null;
    }

    const botSet = new Set(botGuildIds);
    const item = this.toDiscoveryItem(guild, botSet);

    if (item.hasBot) {
      try {
        const meta = await this.getCachedGuildMeta(guildId);
        return {
          ...item,
          name: meta.name,
          icon: meta.icon,
          iconUrl: guildIconUrl(meta.id, meta.icon),
        };
      } catch {
        return { ...item, icon: guild.icon };
      }
    }

    return { ...item, icon: guild.icon };
  }

  async getRoles(guildId: string): Promise<DiscordApiRole[]> {
    const { value } = await this.cache.getOrSet(
      `discord:guild:${guildId}:roles`,
      () => this.discord.getGuildRoles(guildId),
      { ttlSeconds: 300, staleSeconds: 3600, staleIfError: true },
    );
    return value;
  }

  async getChannels(guildId: string): Promise<DiscordApiChannel[]> {
    const { value } = await this.cache.getOrSet(
      `discord:guild:${guildId}:channels`,
      () => this.discord.getGuildChannels(guildId),
      { ttlSeconds: 300, staleSeconds: 3600, staleIfError: true },
    );
    return value;
  }

  async isBotInstalled(guildId: string): Promise<boolean> {
    const ids = await this.auth.getCachedBotGuildIds();
    return ids.includes(guildId);
  }

  async getSettings(guildId: string): Promise<GuildSettingsDto> {
    await this.requireBotInstalled(guildId);
    const row = await this.prisma.serverSettings.findUnique({
      where: { guildId: BigInt(guildId) },
    });
    return mergeGuildSettings(guildId, row);
  }

  async updateSettings(
    guildId: string,
    dto: UpdateGuildSettingsDto,
  ): Promise<GuildSettingsDto> {
    await this.requireBotInstalled(guildId);
    await this.validateChannelAndRoleIds(guildId, dto);

    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if (key === "greetingConfig" || key === "farewellConfig") {
        processed[key] =
          value === null ? null : normalizeMessageConfig(value);
        continue;
      }
      if (key === "loggingConfig") {
        processed[key] =
          value === null ? null : normalizeLoggingConfig(value);
        continue;
      }
      if (
        (bigIntFields as readonly string[]).includes(key) &&
        value !== null
      ) {
        processed[key] = BigInt(value as string);
      } else {
        processed[key] = value;
      }
    }

    // Mirror channel picks into legacy flat columns for dual-read / older bots.
    if (dto.greetingConfig !== undefined) {
      const cfg =
        dto.greetingConfig === null
          ? null
          : normalizeMessageConfig(dto.greetingConfig);
      processed.joinChannel =
        cfg?.enabled && cfg.channelId ? BigInt(cfg.channelId) : null;
    }
    if (dto.farewellConfig !== undefined) {
      const cfg =
        dto.farewellConfig === null
          ? null
          : normalizeMessageConfig(dto.farewellConfig);
      processed.leaveChannel =
        cfg?.enabled && cfg.channelId ? BigInt(cfg.channelId) : null;
    }
    if (dto.loggingConfig !== undefined) {
      const rules =
        dto.loggingConfig === null
          ? []
          : normalizeLoggingConfig(dto.loggingConfig) ?? [];
      const primary = rules.find((r) => r.channelId)?.channelId ?? null;
      processed.logChannel = primary ? BigInt(primary) : null;
    }

    await this.prisma.serverSettings.upsert({
      where: { guildId: BigInt(guildId) },
      create: { guildId: BigInt(guildId), ...processed },
      update: processed,
    });
    await this.cache.delete(guildSettingsCacheKey(guildId));

    return this.getSettings(guildId);
  }

  async deleteSettings(guildId: string): Promise<GuildSettingsDto> {
    await this.requireBotInstalled(guildId);
    try {
      await this.prisma.serverSettings.delete({
        where: { guildId: BigInt(guildId) },
      });
    } catch {
      // already defaults
    }
    await this.cache.delete(guildSettingsCacheKey(guildId));
    return defaultGuildSettings(guildId);
  }

  async getSettingsOptions(guildId: string) {
    await this.requireBotInstalled(guildId);
    const [channels, roles] = await Promise.all([
      this.getChannels(guildId),
      this.getRoles(guildId),
    ]);
    return {
      channels: channels.map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        position: c.position,
        parentId: c.parent_id,
      })),
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        position: r.position,
      })),
      languages: [...SUPPORTED_LANGUAGES],
      badWordsActions: [...BAD_WORDS_ACTIONS],
    };
  }

  private async requireBotInstalled(guildId: string): Promise<void> {
    const installed = await this.isBotInstalled(guildId);
    if (!installed) {
      throw new ConflictException({
        code: ErrorCodes.BOT_NOT_INSTALLED,
        message: "Bot is not installed in this guild",
        details: { botInviteUrl: this.discord.getBotInviteUrl(guildId) },
      });
    }
  }

  private async validateChannelAndRoleIds(
    guildId: string,
    dto: UpdateGuildSettingsDto,
  ): Promise<void> {
    const channelIds = CHANNEL_FIELDS.map((f) => dto[f]).filter(
      (v): v is string => typeof v === "string",
    );
    if (typeof dto.greetingConfig?.channelId === "string") {
      channelIds.push(dto.greetingConfig.channelId);
    }
    if (typeof dto.farewellConfig?.channelId === "string") {
      channelIds.push(dto.farewellConfig.channelId);
    }
    if (Array.isArray(dto.loggingConfig)) {
      for (const rule of dto.loggingConfig) {
        if (typeof rule.channelId === "string") channelIds.push(rule.channelId);
      }
    }
    const roleIds = ROLE_FIELDS.map((f) => dto[f]).filter(
      (v): v is string => typeof v === "string",
    );

    if (channelIds.length === 0 && roleIds.length === 0) return;

    const [channels, roles] = await Promise.all([
      channelIds.length ? this.getChannels(guildId) : Promise.resolve([]),
      roleIds.length ? this.getRoles(guildId) : Promise.resolve([]),
    ]);
    const channelSet = new Set(channels.map((c) => c.id));
    const roleSet = new Set(roles.map((r) => r.id));

    for (const field of CHANNEL_FIELDS) {
      const value = dto[field];
      if (typeof value === "string" && !channelSet.has(value)) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `${field} is not a channel in this guild`,
          details: { field, value },
        });
      }
    }
    for (const [field, value] of [
      ["greetingConfig.channelId", dto.greetingConfig?.channelId],
      ["farewellConfig.channelId", dto.farewellConfig?.channelId],
    ] as const) {
      if (typeof value === "string" && !channelSet.has(value)) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `${field} is not a channel in this guild`,
          details: { field, value },
        });
      }
    }
    for (const field of ROLE_FIELDS) {
      const value = dto[field];
      if (typeof value === "string" && !roleSet.has(value)) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `${field} is not a role in this guild`,
          details: { field, value },
        });
      }
    }
  }

  private toDiscoveryItem(
    guild: DiscordApiGuild,
    botSet: Set<string>,
  ): GuildDiscoveryItem {
    const isAdmin = this.isAdmin(guild);
    const isManageable = this.auth.hasRequiredPermission(guild);
    const hasBot = botSet.has(guild.id);
    const canInviteBot = isManageable && !hasBot;

    return {
      id: guild.id,
      name: guild.name,
      iconUrl: guildIconUrl(guild.id, guild.icon),
      owner: guild.owner,
      permissions: guild.permissions,
      isAdmin,
      isManageable,
      hasBot,
      canInviteBot,
      botInviteUrl: canInviteBot
        ? this.discord.getBotInviteUrl(guild.id)
        : null,
    };
  }

  private isAdmin(guild: DiscordApiGuild): boolean {
    if (guild.owner) return true;
    const bits = BigInt(guild.permissions);
    return (bits & PERMISSIONS.ADMINISTRATOR) !== 0n;
  }

  private async getCachedGuildMeta(guildId: string) {
    const { value } = await this.cache.getOrSet(
      `discord:guild:${guildId}`,
      () => this.discord.getGuild(guildId),
      { ttlSeconds: 300, staleSeconds: 3600, staleIfError: true },
    );
    return value;
  }
}
