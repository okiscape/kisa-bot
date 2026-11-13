-- Additive OAuth link credentials for osu! and Last.fm (encrypted at rest by backend).
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "osu_user_id" BIGINT;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "osu_access_token_encrypted" TEXT;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "osu_refresh_token_encrypted" TEXT;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "osu_token_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "lastfm_username" TEXT;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "lastfm_session_key_encrypted" TEXT;
