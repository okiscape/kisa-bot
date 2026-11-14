-- Additive: logging rules + other dashboard settings.
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "logging_config" JSONB;
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "honeypot_channel" BIGINT;
