export const REACTION_ROLE_MODES = [
  "post_embed",
  "post_message",
  "existing",
] as const;

export type ReactionRoleMode = (typeof REACTION_ROLE_MODES)[number];

export const REACTION_ROLE_TYPES = ["normal", "verify", "unique"] as const;

export type ReactionRoleType = (typeof REACTION_ROLE_TYPES)[number];

export const MAX_REACTION_ROLE_PANELS = 20;
export const MAX_REACTION_ROLE_PAIRS = 15;

export const MESSAGE_CONTENT_MAX = 2000;
export const EMBED_TITLE_MAX = 256;
export const EMBED_DESCRIPTION_MAX = 4096;
