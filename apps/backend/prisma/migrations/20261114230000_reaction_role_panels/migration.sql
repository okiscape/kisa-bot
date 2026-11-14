-- Dedicated reaction-role panels + emoji/role pairs.

CREATE TABLE IF NOT EXISTS "reaction_role_panels" (
    "id" TEXT NOT NULL,
    "guild_id" BIGINT NOT NULL,
    "channel_id" BIGINT NOT NULL,
    "message_id" BIGINT,
    "mode" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'normal',
    "content" TEXT NOT NULL DEFAULT '',
    "embed" JSONB,
    "bot_owned" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "reaction_role_panels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reaction_role_panels_guild_id_idx"
  ON "reaction_role_panels" ("guild_id");

CREATE UNIQUE INDEX IF NOT EXISTS "reaction_role_panels_message_id_key"
  ON "reaction_role_panels" ("message_id");

CREATE TABLE IF NOT EXISTS "reaction_role_pairs" (
    "id" TEXT NOT NULL,
    "panel_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "reaction_role_pairs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reaction_role_pairs_panel_id_fkey"
      FOREIGN KEY ("panel_id") REFERENCES "reaction_role_panels"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "reaction_role_pairs_panel_id_emoji_key"
  ON "reaction_role_pairs" ("panel_id", "emoji");

CREATE INDEX IF NOT EXISTS "reaction_role_pairs_panel_id_idx"
  ON "reaction_role_pairs" ("panel_id");
