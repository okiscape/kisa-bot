CREATE TABLE IF NOT EXISTS "guild_daily_metrics" (
  "guild_id" BIGINT NOT NULL,
  "day" DATE NOT NULL,
  "messages" INTEGER NOT NULL DEFAULT 0,
  "joins" INTEGER NOT NULL DEFAULT 0,
  "leaves" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "guild_daily_metrics_pkey" PRIMARY KEY ("guild_id", "day")
);

CREATE INDEX IF NOT EXISTS "guild_daily_metrics_guild_id_day_idx"
  ON "guild_daily_metrics" ("guild_id", "day");
