export type LoggingRule = {
  channelId: string | null;
  webhookUrl: string | null;
  eventType: string;
  ignoreItems: string[];
};

export function normalizeLoggingConfig(raw: unknown): LoggingRule[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      channelId:
        typeof item.channelId === "string" && item.channelId.trim()
          ? item.channelId.trim()
          : null,
      webhookUrl:
        typeof item.webhookUrl === "string" && item.webhookUrl.trim()
          ? item.webhookUrl.trim()
          : null,
      eventType:
        typeof item.eventType === "string" && item.eventType.trim()
          ? item.eventType.trim()
          : "all",
      ignoreItems: Array.isArray(item.ignoreItems)
        ? item.ignoreItems.filter((v): v is string => typeof v === "string")
        : [],
    }))
    .slice(0, 50);
}

export function synthesizeLoggingConfig(logChannel: string | null): LoggingRule[] {
  if (!logChannel) return [];
  return [
    {
      channelId: logChannel,
      webhookUrl: null,
      eventType: "all",
      ignoreItems: [],
    },
  ];
}

export type ReactionRole = {
  emoji: string;
  roleId: string;
  messageId: string | null;
};

export function normalizeReactionRoles(raw: unknown): ReactionRole[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      emoji: typeof item.emoji === "string" ? item.emoji : "",
      roleId: typeof item.roleId === "string" ? item.roleId : "",
      messageId:
        typeof item.messageId === "string" && item.messageId.trim()
          ? item.messageId.trim()
          : null,
    }))
    .filter((item) => item.emoji && item.roleId)
    .slice(0, 100);
}
