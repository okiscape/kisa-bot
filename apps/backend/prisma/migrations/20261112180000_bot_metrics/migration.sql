-- Additive: singleton bot metrics snapshot (bot writes, backend reads).
CREATE TABLE IF NOT EXISTS "bot_metrics" (
  "id" INTEGER PRIMARY KEY,
  "guild_count" INTEGER NOT NULL DEFAULT 0,
  "user_count" INTEGER NOT NULL DEFAULT 0,
  "command_count" INTEGER NOT NULL DEFAULT 0,
  "channel_count" INTEGER NOT NULL DEFAULT 0,
  "shard_count" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER NOT NULL DEFAULT 0,
  "uptime_seconds" INTEGER NOT NULL DEFAULT 0,
  "version" TEXT NOT NULL DEFAULT '',
  "online" BOOLEAN NOT NULL DEFAULT FALSE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
