-- Additive: total application-command invocations (bot writes, backend reads).
ALTER TABLE "bot_metrics" ADD COLUMN IF NOT EXISTS "used_commands" INTEGER NOT NULL DEFAULT 0;
