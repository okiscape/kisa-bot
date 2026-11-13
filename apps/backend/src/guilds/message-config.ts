export type MessageEmbedConfig = {
  title: string | null;
  description: string | null;
  color: string | null;
  url: string | null;
  authorName: string | null;
  authorIconUrl: string | null;
  authorUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
};

export type MessageConfig = {
  enabled: boolean;
  channelId: string | null;
  sender: "bot" | "webhook";
  webhookUrl: string | null;
  content: string;
  embeds: MessageEmbedConfig[];
};

export function emptyMessageConfig(): MessageConfig {
  return {
    enabled: false,
    channelId: null,
    sender: "bot",
    webhookUrl: null,
    content: "",
    embeds: [],
  };
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeEmbed(raw: unknown): MessageEmbedConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const author =
    e.author && typeof e.author === "object"
      ? (e.author as Record<string, unknown>)
      : null;
  const footer =
    e.footer && typeof e.footer === "object"
      ? (e.footer as Record<string, unknown>)
      : null;

  return {
    title: asString(e.title),
    description: asString(e.description),
    color: asString(e.color),
    url: asString(e.url),
    authorName: asString(e.authorName) ?? asString(author?.name),
    authorIconUrl: asString(e.authorIconUrl) ?? asString(author?.iconUrl),
    authorUrl: asString(e.authorUrl) ?? asString(author?.url),
    footerText: asString(e.footerText) ?? asString(footer?.text),
    footerIconUrl: asString(e.footerIconUrl) ?? asString(footer?.iconUrl),
    thumbnailUrl: asString(e.thumbnailUrl) ?? asString(e.thumbnail),
    imageUrl: asString(e.imageUrl) ?? asString(e.image),
  };
}

export function normalizeMessageConfig(raw: unknown): MessageConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const sender = c.sender === "webhook" ? "webhook" : "bot";
  const embeds = Array.isArray(c.embeds)
    ? c.embeds
        .map(normalizeEmbed)
        .filter((e): e is MessageEmbedConfig => e !== null)
        .slice(0, 10)
    : [];

  return {
    enabled: Boolean(c.enabled),
    channelId: asString(c.channelId),
    sender,
    webhookUrl: asString(c.webhookUrl),
    content: typeof c.content === "string" ? c.content.slice(0, 2000) : "",
    embeds,
  };
}

export function synthesizeGreetingConfig(row: {
  joinChannel: string | null;
  greetText: string | null;
  greetColor: string | null;
  greetImage: string | null;
  customGreet: string | null;
}): MessageConfig {
  const description = row.greetText ?? row.customGreet;
  const hasContent = Boolean(row.joinChannel || description || row.greetImage);
  if (!hasContent) return emptyMessageConfig();

  const embeds: MessageEmbedConfig[] = [];
  if (description || row.greetColor || row.greetImage) {
    embeds.push({
      title: null,
      description,
      color: row.greetColor,
      url: null,
      authorName: null,
      authorIconUrl: null,
      authorUrl: null,
      footerText: null,
      footerIconUrl: null,
      thumbnailUrl: null,
      imageUrl: row.greetImage,
    });
  }

  return {
    enabled: Boolean(row.joinChannel),
    channelId: row.joinChannel,
    sender: "bot",
    webhookUrl: null,
    content: "",
    embeds,
  };
}

export function synthesizeFarewellConfig(row: {
  leaveChannel: string | null;
  fareText: string | null;
  fareColor: string | null;
  fareImage: string | null;
  customFare: string | null;
}): MessageConfig {
  const description = row.customFare ?? row.fareText;
  const hasContent = Boolean(row.leaveChannel || description || row.fareImage);
  if (!hasContent) return emptyMessageConfig();

  const embeds: MessageEmbedConfig[] = [];
  if (description || row.fareColor || row.fareImage) {
    embeds.push({
      title: null,
      description,
      color: row.fareColor,
      url: null,
      authorName: null,
      authorIconUrl: null,
      authorUrl: null,
      footerText: null,
      footerIconUrl: null,
      thumbnailUrl: null,
      imageUrl: row.fareImage,
    });
  }

  return {
    enabled: Boolean(row.leaveChannel),
    channelId: row.leaveChannel,
    sender: "bot",
    webhookUrl: null,
    content: "",
    embeds,
  };
}
