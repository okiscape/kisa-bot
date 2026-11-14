import { BadRequestException } from "@nestjs/common";
import { ErrorCodes } from "../common/types/error-codes";
import {
  embedToDiscordApiPayload,
  normalizeMessageEmbed,
  type MessageEmbedConfig,
} from "../guilds/message-config";
import {
  MAX_REACTION_ROLE_PAIRS,
  MESSAGE_CONTENT_MAX,
  REACTION_ROLE_MODES,
  REACTION_ROLE_TYPES,
  type ReactionRoleMode,
  type ReactionRoleType,
} from "./reaction-roles.constants";
import type {
  ReactionRolePairInputDto,
  UpsertReactionRoleDto,
} from "./dto/upsert-reaction-role.dto";

const CUSTOM_EMOJI_RE = /^(a:)?([\w-]{2,32}):(\d{17,20})$/;
const UNICODE_EMOJI_RE =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f)+$/u;
const MESSAGE_LINK_RE =
  /(?:discord(?:app)?\.com|discord\.gg)\/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})/i;
const SNOWFLAKE_RE = /^\d{17,20}$/;

export type NormalizedPair = { emoji: string; roleId: string; position: number };

export type NormalizedUpsert = {
  mode: ReactionRoleMode;
  type: ReactionRoleType;
  channelId: string;
  content: string;
  embed: MessageEmbedConfig | null;
  pairs: NormalizedPair[];
  existingMessageId: string | null;
  existingGuildId: string | null;
};

function fail(message: string): never {
  throw new BadRequestException({
    code: ErrorCodes.VALIDATION_ERROR,
    message,
  });
}

export function normalizeEmoji(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) fail("Emoji is required");

  const mention = trimmed.match(/^<(a)?:([\w-]{2,32}):(\d{17,20})>$/);
  if (mention) {
    return mention[1]
      ? `a:${mention[2]}:${mention[3]}`
      : `${mention[2]}:${mention[3]}`;
  }

  const custom = trimmed.match(CUSTOM_EMOJI_RE);
  if (custom) {
    return custom[1]
      ? `a:${custom[2]}:${custom[3]}`
      : `${custom[2]}:${custom[3]}`;
  }

  if (!UNICODE_EMOJI_RE.test(trimmed) || trimmed.length > 32) {
    fail(`Invalid emoji: ${trimmed}`);
  }
  return trimmed;
}

export function reactionEmojiPath(emoji: string): string {
  const custom = emoji.match(CUSTOM_EMOJI_RE);
  if (custom) return `${custom[2]}:${custom[3]}`;
  return emoji;
}

function embedHasContent(embed: MessageEmbedConfig): boolean {
  return Boolean(
    embed.title ||
      embed.description ||
      embed.imageUrl ||
      embed.thumbnailUrl ||
      embed.authorName ||
      embed.footerText ||
      embed.url ||
      (embed.fields ?? []).some((f) => f.name || f.value),
  );
}

export function normalizeEmbed(
  input: unknown,
  required: boolean,
): MessageEmbedConfig | null {
  if (input == null) {
    if (required) fail("Embed is required for post_embed mode");
    return null;
  }
  const embed = normalizeMessageEmbed(input);
  if (!embed || !embedHasContent(embed)) {
    if (required) fail("Embed needs a title, description, or image");
    return null;
  }
  return embed;
}

export function parseMessageRef(
  raw: string | null | undefined,
  expectedGuildId: string,
  expectedChannelId: string,
): { messageId: string; guildId: string | null; channelId: string | null } {
  if (!raw?.trim()) fail("Message link or ID is required for existing mode");
  const trimmed = raw.trim();

  const link = trimmed.match(MESSAGE_LINK_RE);
  if (link) {
    const [, guildId, channelId, messageId] = link;
    if (guildId !== expectedGuildId) {
      fail("Message link must be from this server");
    }
    if (channelId !== expectedChannelId) {
      fail("Message link channel must match the selected channel");
    }
    return { messageId, guildId, channelId };
  }

  if (!SNOWFLAKE_RE.test(trimmed)) {
    fail("Provide a Discord message link or message ID");
  }
  return { messageId: trimmed, guildId: null, channelId: null };
}

export function normalizePairs(
  pairs: ReactionRolePairInputDto[],
): NormalizedPair[] {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    fail("Add at least one emoji and role");
  }
  if (pairs.length > MAX_REACTION_ROLE_PAIRS) {
    fail(`At most ${MAX_REACTION_ROLE_PAIRS} emoji per panel`);
  }

  const seenEmoji = new Set<string>();
  const seenRoles = new Set<string>();
  const out: NormalizedPair[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const emoji = normalizeEmoji(pairs[i].emoji);
    const roleId = pairs[i].roleId?.trim();
    if (!roleId || !SNOWFLAKE_RE.test(roleId)) fail("Each pair needs a valid role");
    if (seenEmoji.has(emoji)) fail("Duplicate emoji in panel");
    if (seenRoles.has(roleId)) fail("Duplicate role in panel");
    seenEmoji.add(emoji);
    seenRoles.add(roleId);
    out.push({ emoji, roleId, position: i });
  }
  return out;
}

export function normalizeUpsert(
  dto: UpsertReactionRoleDto,
  guildId: string,
): NormalizedUpsert {
  if (!REACTION_ROLE_MODES.includes(dto.mode)) fail("Invalid mode");
  if (!REACTION_ROLE_TYPES.includes(dto.type)) fail("Invalid type");
  if (!SNOWFLAKE_RE.test(dto.channelId)) fail("Invalid channel");

  const content =
    typeof dto.content === "string"
      ? dto.content.trim().slice(0, MESSAGE_CONTENT_MAX)
      : "";

  const embedRequired = dto.mode === "post_embed";
  const embed =
    dto.mode === "post_message"
      ? null
      : normalizeEmbed(dto.embed, embedRequired);

  if (dto.mode === "post_message" && !content) {
    fail("Message content is required for post_message mode");
  }
  if (dto.mode === "post_embed" && !content && !embed) {
    fail("Provide message content or an embed");
  }

  let existingMessageId: string | null = null;
  let existingGuildId: string | null = null;
  if (dto.mode === "existing") {
    const parsed = parseMessageRef(dto.messageRef, guildId, dto.channelId);
    existingMessageId = parsed.messageId;
    existingGuildId = parsed.guildId;
  }

  return {
    mode: dto.mode,
    type: dto.type,
    channelId: dto.channelId,
    content,
    embed,
    pairs: normalizePairs(dto.pairs),
    existingMessageId,
    existingGuildId,
  };
}

export function embedToDiscordPayload(
  embed: MessageEmbedConfig | null,
): Record<string, unknown> | null {
  if (!embed) return null;
  return embedToDiscordApiPayload(embed);
}

export function parseStoredEmbed(value: unknown): MessageEmbedConfig | null {
  return normalizeMessageEmbed(value);
}
