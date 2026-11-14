import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { CacheService } from "../cache/cache.service";
import {
  reactionRoleGuildCacheKey,
  reactionRoleMessageCacheKey,
} from "../cache/app-cache-keys";
import { ErrorCodes } from "../common/types/error-codes";
import { DiscordApiClient } from "../discord/discord-api.client";
import { PrismaService } from "../prisma/prisma.service";
import { SETTINGS_CHANNEL_TYPES } from "../discord/discord.types";
import { UpsertReactionRoleDto } from "./dto/upsert-reaction-role.dto";
import {
  MAX_REACTION_ROLE_PANELS,
  type ReactionRoleMode,
  type ReactionRoleType,
} from "./reaction-roles.constants";
import {
  embedToDiscordPayload,
  normalizeUpsert,
  parseStoredEmbed,
  reactionEmojiPath,
} from "./reaction-roles.normalize";
import type {
  GuildEmojiDto,
  ReactionRolePanelDto,
  ReactionRolePairDto,
} from "./reaction-roles.types";

type PanelRow = Prisma.ReactionRolePanelGetPayload<{
  include: { pairs: true };
}>;

@Injectable()
export class ReactionRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discord: DiscordApiClient,
    private readonly cache: CacheService,
    private readonly auth: AuthService,
  ) {}

  async list(guildId: string): Promise<ReactionRolePanelDto[]> {
    await this.requireBotInstalled(guildId);
    const rows = await this.prisma.reactionRolePanel.findMany({
      where: { guildId: BigInt(guildId) },
      include: { pairs: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => this.toDto(row));
  }

  async getEmojis(guildId: string): Promise<GuildEmojiDto[]> {
    await this.requireBotInstalled(guildId);
    const { value } = await this.cache.getOrSet(
      `discord:guild:${guildId}:emojis`,
      () => this.discord.getGuildEmojis(guildId),
      { ttlSeconds: 300, staleSeconds: 3600, staleIfError: true },
    );
    return value.map((e) => ({
      id: e.id,
      name: e.name,
      animated: e.animated,
      available: e.available,
      url: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}?size=64&quality=lossless`,
      key: e.animated ? `a:${e.name}:${e.id}` : `${e.name}:${e.id}`,
    }));
  }

  async create(
    guildId: string,
    dto: UpsertReactionRoleDto,
  ): Promise<ReactionRolePanelDto> {
    await this.requireBotInstalled(guildId);
    const normalized = normalizeUpsert(dto, guildId);
    await this.validateChannelAndRoles(
      guildId,
      normalized.channelId,
      normalized.pairs.map((p) => p.roleId),
    );

    const count = await this.prisma.reactionRolePanel.count({
      where: { guildId: BigInt(guildId) },
    });
    if (count >= MAX_REACTION_ROLE_PANELS) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `At most ${MAX_REACTION_ROLE_PANELS} reaction role panels per server`,
      });
    }

    let messageId: string;
    let botOwned: boolean;

    if (normalized.mode === "existing") {
      const msg = await this.discord.getChannelMessage(
        normalized.channelId,
        normalized.existingMessageId!,
      );
      messageId = msg.id;
      const bot = await this.discord.getBotUser();
      botOwned = msg.author.id === bot.id;

      const taken = await this.prisma.reactionRolePanel.findUnique({
        where: { messageId: BigInt(messageId) },
      });
      if (taken) {
        throw new ConflictException({
          code: ErrorCodes.CONFLICT,
          message: "That message already has a reaction role panel",
        });
      }
    } else {
      const payload = this.buildMessagePayload(
        normalized.mode,
        normalized.content,
        normalized.embed,
      );
      const msg = await this.discord.createChannelMessage(
        normalized.channelId,
        payload,
      );
      messageId = msg.id;
      botOwned = true;
    }

    await this.syncReactions(
      normalized.channelId,
      messageId,
      [],
      normalized.pairs.map((p) => p.emoji),
    );

    const row = await this.prisma.reactionRolePanel.create({
      data: {
        guildId: BigInt(guildId),
        channelId: BigInt(normalized.channelId),
        messageId: BigInt(messageId),
        mode: normalized.mode,
        type: normalized.type,
        content: normalized.content,
        embed:
          normalized.embed === null
            ? Prisma.JsonNull
            : (normalized.embed as unknown as Prisma.InputJsonValue),
        botOwned,
        pairs: {
          create: normalized.pairs.map((p) => ({
            emoji: p.emoji,
            roleId: BigInt(p.roleId),
            position: p.position,
          })),
        },
      },
      include: { pairs: { orderBy: { position: "asc" } } },
    });

    await this.invalidateCaches(guildId, messageId);
    return this.toDto(row);
  }

  async update(
    guildId: string,
    panelId: string,
    dto: UpsertReactionRoleDto,
  ): Promise<ReactionRolePanelDto> {
    await this.requireBotInstalled(guildId);
    const existing = await this.prisma.reactionRolePanel.findFirst({
      where: { id: panelId, guildId: BigInt(guildId) },
      include: { pairs: { orderBy: { position: "asc" } } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: "Reaction role panel not found",
      });
    }

    const normalized = normalizeUpsert(dto, guildId);
    await this.validateChannelAndRoles(
      guildId,
      normalized.channelId,
      normalized.pairs.map((p) => p.roleId),
    );

    if (!existing.messageId) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: "Panel has no Discord message",
      });
    }

    const messageId = String(existing.messageId);
    const channelId = normalized.channelId;
    const oldChannelId = String(existing.channelId);

    // Existing-message panels keep their message; channel/message cannot move.
    if (existing.mode === "existing" || !existing.botOwned) {
      if (channelId !== oldChannelId) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Cannot change channel for an existing-message panel",
        });
      }
      if (
        normalized.mode === "existing" &&
        normalized.existingMessageId &&
        normalized.existingMessageId !== messageId
      ) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Cannot switch to a different message; create a new panel",
        });
      }
    } else if (existing.botOwned) {
      // Bot-owned: edit message content/embed in place (channel change not supported).
      if (channelId !== oldChannelId) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Cannot move a panel to another channel; create a new one",
        });
      }
      if (normalized.mode === "existing") {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Cannot convert a posted panel to existing-message mode",
        });
      }
      const payload = this.buildMessagePayload(
        normalized.mode,
        normalized.content,
        normalized.embed,
      );
      await this.discord.editChannelMessage(channelId, messageId, {
        content: payload.content ?? "",
        embeds: payload.embeds ?? [],
      });
    }

    const oldEmojis = existing.pairs.map((p) => p.emoji);
    const newEmojis = normalized.pairs.map((p) => p.emoji);
    await this.syncReactions(channelId, messageId, oldEmojis, newEmojis);

    await this.prisma.reactionRolePair.deleteMany({
      where: { panelId: existing.id },
    });

    const row = await this.prisma.reactionRolePanel.update({
      where: { id: existing.id },
      data: {
        channelId: BigInt(channelId),
        mode:
          existing.mode === "existing" ? existing.mode : normalized.mode,
        type: normalized.type,
        content:
          existing.botOwned && existing.mode !== "existing"
            ? normalized.content
            : existing.content,
        embed:
          existing.botOwned && existing.mode !== "existing"
            ? normalized.embed === null
              ? Prisma.JsonNull
              : (normalized.embed as unknown as Prisma.InputJsonValue)
            : (existing.embed as Prisma.InputJsonValue),
        pairs: {
          create: normalized.pairs.map((p) => ({
            emoji: p.emoji,
            roleId: BigInt(p.roleId),
            position: p.position,
          })),
        },
      },
      include: { pairs: { orderBy: { position: "asc" } } },
    });

    await this.invalidateCaches(guildId, messageId);
    return this.toDto(row);
  }

  async remove(guildId: string, panelId: string): Promise<void> {
    await this.requireBotInstalled(guildId);
    const existing = await this.prisma.reactionRolePanel.findFirst({
      where: { id: panelId, guildId: BigInt(guildId) },
      include: { pairs: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: "Reaction role panel not found",
      });
    }

    const channelId = String(existing.channelId);
    const messageId = existing.messageId ? String(existing.messageId) : null;

    if (messageId) {
      try {
        if (existing.botOwned) {
          await this.discord.deleteChannelMessage(channelId, messageId);
        } else {
          for (const pair of existing.pairs) {
            try {
              await this.discord.deleteOwnReaction(
                channelId,
                messageId,
                reactionEmojiPath(pair.emoji),
              );
            } catch {
              // best-effort
            }
          }
        }
      } catch {
        // still drop DB row if Discord cleanup fails
      }
    }

    await this.prisma.reactionRolePanel.delete({ where: { id: existing.id } });
    await this.invalidateCaches(guildId, messageId);
  }

  private buildMessagePayload(
    mode: ReactionRoleMode,
    content: string,
    embed: ReturnType<typeof normalizeUpsert>["embed"],
  ): { content?: string; embeds?: Array<Record<string, unknown>> } {
    if (mode === "post_message") {
      return { content: content || undefined, embeds: [] };
    }
    const discordEmbed = embedToDiscordPayload(embed);
    return {
      content: content || undefined,
      embeds: discordEmbed ? [discordEmbed] : [],
    };
  }

  private async syncReactions(
    channelId: string,
    messageId: string,
    oldEmojis: string[],
    newEmojis: string[],
  ): Promise<void> {
    const next = new Set(newEmojis);
    const prev = new Set(oldEmojis);
    for (const emoji of oldEmojis) {
      if (next.has(emoji)) continue;
      try {
        await this.discord.deleteOwnReaction(
          channelId,
          messageId,
          reactionEmojiPath(emoji),
        );
      } catch {
        // ignore missing reactions
      }
    }
    for (const emoji of newEmojis) {
      if (prev.has(emoji)) continue;
      await this.discord.createReaction(
        channelId,
        messageId,
        reactionEmojiPath(emoji),
      );
    }
  }

  private async validateChannelAndRoles(
    guildId: string,
    channelId: string,
    roleIds: string[],
  ): Promise<void> {
    const [channels, roles] = await Promise.all([
      this.discord.getGuildChannels(guildId),
      this.discord.getGuildRoles(guildId),
    ]);
    const textish = new Set<number>([
      SETTINGS_CHANNEL_TYPES.GUILD_TEXT,
      SETTINGS_CHANNEL_TYPES.GUILD_ANNOUNCEMENT,
    ]);
    const channel = channels.find((c) => c.id === channelId);
    if (!channel || !textish.has(channel.type)) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Pick a text channel",
      });
    }
    const roleSet = new Set(roles.map((r) => r.id));
    for (const roleId of roleIds) {
      if (!roleSet.has(roleId)) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `Unknown role: ${roleId}`,
        });
      }
    }
  }

  private async requireBotInstalled(guildId: string): Promise<void> {
    const ids = await this.auth.getCachedBotGuildIds();
    if (!ids.includes(guildId)) {
      throw new ConflictException({
        code: ErrorCodes.BOT_NOT_INSTALLED,
        message: "Bot is not installed in this guild",
        details: { botInviteUrl: this.discord.getBotInviteUrl(guildId) },
      });
    }
  }

  private async invalidateCaches(
    guildId: string,
    messageId: string | null,
  ): Promise<void> {
    await this.cache.delete(reactionRoleGuildCacheKey(guildId));
    if (messageId) {
      await this.cache.delete(reactionRoleMessageCacheKey(messageId));
    }
  }

  private toDto(row: PanelRow): ReactionRolePanelDto {
    return {
      id: row.id,
      guildId: String(row.guildId),
      channelId: String(row.channelId),
      messageId: row.messageId ? String(row.messageId) : null,
      mode: row.mode as ReactionRoleMode,
      type: row.type as ReactionRoleType,
      content: row.content,
      embed: parseStoredEmbed(row.embed),
      botOwned: row.botOwned,
      pairs: row.pairs
        .slice()
        .sort((a, b) => a.position - b.position)
        .map(
          (p): ReactionRolePairDto => ({
            id: p.id,
            emoji: p.emoji,
            roleId: String(p.roleId),
            position: p.position,
          }),
        ),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
