import { ServerSettings as PrismaServerSettings } from "@prisma/client";
import {
  emptyMessageConfig,
  MessageConfig,
  normalizeMessageConfig,
  synthesizeFarewellConfig,
  synthesizeGreetingConfig,
} from "./message-config";
import {
  LoggingRule,
  normalizeLoggingConfig,
  normalizeReactionRoles,
  ReactionRole,
  synthesizeLoggingConfig,
} from "./logging-config";

export type { MessageConfig } from "./message-config";
export type { LoggingRule, ReactionRole } from "./logging-config";

export type GuildSettingsDto = {
  guildId: string;
  averageLanguage: string | null;
  badWords: string | null;
  notifiedModerators: string | null;
  notifyChannel: string | null;
  badWordsAction: string | null;
  joinChannel: string | null;
  leaveChannel: string | null;
  postChannel: string | null;
  muteRole: string | null;
  autoRole: string | null;
  logChannel: string | null;
  verifiedRole: string | null;
  ticketCategory: string | null;
  fareText: string | null;
  fareColor: string | null;
  fareImage: string | null;
  greetText: string | null;
  greetColor: string | null;
  greetImage: string | null;
  privateCrChannel: string | null;
  privateCategory: string | null;
  customGreet: string | null;
  customFare: string | null;
  notifyText: string | null;
  collectMetrics: boolean | null;
  greetingConfig: MessageConfig;
  farewellConfig: MessageConfig;
  loggingConfig: LoggingRule[];
  honeypotChannel: string | null;
  reactionRoles: ReactionRole[];
};

export const SUPPORTED_LANGUAGES = ["en", "en_US", "ru"] as const;

export const BAD_WORDS_ACTIONS = [
  "delete",
  "warn",
  "mute",
  "none",
] as const;

export function defaultGuildSettings(guildId: string): GuildSettingsDto {
  return {
    guildId,
    averageLanguage: null,
    badWords: null,
    notifiedModerators: null,
    notifyChannel: null,
    badWordsAction: null,
    joinChannel: null,
    leaveChannel: null,
    postChannel: null,
    muteRole: null,
    autoRole: null,
    logChannel: null,
    verifiedRole: null,
    ticketCategory: null,
    fareText: null,
    fareColor: null,
    fareImage: null,
    greetText: null,
    greetColor: null,
    greetImage: null,
    privateCrChannel: null,
    privateCategory: null,
    customGreet: null,
    customFare: null,
    notifyText: null,
    collectMetrics: null,
    greetingConfig: emptyMessageConfig(),
    farewellConfig: emptyMessageConfig(),
    loggingConfig: [],
    honeypotChannel: null,
    reactionRoles: [],
  };
}

function snowflake(value: bigint | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

export function mergeGuildSettings(
  guildId: string,
  row: PrismaServerSettings | null,
): GuildSettingsDto {
  const defaults = defaultGuildSettings(guildId);
  if (!row) return defaults;

  const joinChannel = snowflake(row.joinChannel);
  const leaveChannel = snowflake(row.leaveChannel);
  const greetText = row.greetText ?? defaults.greetText;
  const greetColor = row.greetColor ?? defaults.greetColor;
  const greetImage = row.greetImage ?? defaults.greetImage;
  const customGreet = row.customGreet ?? defaults.customGreet;
  const fareText = row.fareText ?? defaults.fareText;
  const fareColor = row.fareColor ?? defaults.fareColor;
  const fareImage = row.fareImage ?? defaults.fareImage;
  const customFare = row.customFare ?? defaults.customFare;

  return {
    guildId,
    averageLanguage: row.averageLanguage ?? defaults.averageLanguage,
    badWords: row.badWords ?? defaults.badWords,
    notifiedModerators: row.notifiedModerators ?? defaults.notifiedModerators,
    notifyChannel: snowflake(row.notifyChannel),
    badWordsAction: row.badWordsAction ?? defaults.badWordsAction,
    joinChannel,
    leaveChannel,
    postChannel: snowflake(row.postChannel),
    muteRole: snowflake(row.muteRole),
    autoRole: snowflake(row.autoRole),
    logChannel: snowflake(row.logChannel),
    verifiedRole: snowflake(row.verifiedRole),
    ticketCategory: snowflake(row.ticketCategory),
    fareText,
    fareColor,
    fareImage,
    greetText,
    greetColor,
    greetImage,
    privateCrChannel: snowflake(row.privateCrChannel),
    privateCategory: snowflake(row.privateCategory),
    customGreet,
    customFare,
    notifyText: row.notifyText ?? defaults.notifyText,
    collectMetrics: row.collectMetrics ?? defaults.collectMetrics,
    greetingConfig:
      normalizeMessageConfig(row.greetingConfig) ??
      synthesizeGreetingConfig({
        joinChannel,
        greetText,
        greetColor,
        greetImage,
        customGreet,
      }),
    farewellConfig:
      normalizeMessageConfig(row.farewellConfig) ??
      synthesizeFarewellConfig({
        leaveChannel,
        fareText,
        fareColor,
        fareImage,
        customFare,
      }),
    loggingConfig:
      normalizeLoggingConfig(row.loggingConfig) ??
      synthesizeLoggingConfig(snowflake(row.logChannel)),
    honeypotChannel: snowflake(row.honeypotChannel),
    reactionRoles: normalizeReactionRoles(row.reactionRoles) ?? [],
  };
}
