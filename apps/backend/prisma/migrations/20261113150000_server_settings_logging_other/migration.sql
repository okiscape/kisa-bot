-- Additive: logging rules + other dashboard settings.
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "logging_config" JSONB;
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "honeypot_channel" BIGINT;
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "reaction_roles" JSONB;
