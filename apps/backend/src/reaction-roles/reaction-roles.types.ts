import type { MessageEmbedConfig } from "../guilds/message-config";
import type {
  ReactionRoleMode,
  ReactionRoleType,
} from "./reaction-roles.constants";

export type ReactionRoleEmbed = MessageEmbedConfig;

export type ReactionRolePairDto = {
  id: string;
  emoji: string;
  roleId: string;
  position: number;
};

export type ReactionRolePanelDto = {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  mode: ReactionRoleMode;
  type: ReactionRoleType;
  content: string;
  embed: ReactionRoleEmbed | null;
  botOwned: boolean;
  pairs: ReactionRolePairDto[];
  createdAt: string;
  updatedAt: string;
};

export type GuildEmojiDto = {
  id: string;
  name: string;
  animated: boolean;
  available: boolean;
  /** CDN URL for the emoji image. */
  url: string;
  /** Stored reaction key: `name:id` or `a:name:id`. */
  key: string;
};
