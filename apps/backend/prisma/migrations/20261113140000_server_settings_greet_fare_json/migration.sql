-- Additive: structured greeting / farewell configs (dashboard + bot dual-read).
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "greeting_config" JSONB;
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "farewell_config" JSONB;
