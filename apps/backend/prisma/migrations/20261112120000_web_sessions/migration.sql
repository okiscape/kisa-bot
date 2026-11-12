-- Additive: backend-owned opaque web sessions
CREATE TABLE IF NOT EXISTS "web_sessions" (
    "id" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT,
    "access_token_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent_hash" TEXT,
    "ip_hash" TEXT,
    CONSTRAINT "web_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "web_sessions_user_id_idx" ON "web_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "web_sessions_expires_at_idx" ON "web_sessions"("expires_at");
