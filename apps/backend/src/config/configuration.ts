export default () => {
  const sessionSecret =
    process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    backendPort: parseInt(process.env.BACKEND_PORT || "3001", 10),
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    databaseUrl: process.env.DATABASE_URL,
    session: {
      secret: sessionSecret,
      cookieName: process.env.SESSION_COOKIE_NAME || "kisa_session",
      ttlDays: parseInt(process.env.SESSION_TTL_DAYS || "7", 10),
      // Prefer explicit flag; otherwise Secure only for non-localhost production.
      secure:
        process.env.COOKIE_SECURE === "true"
          ? true
          : process.env.COOKIE_SECURE === "false"
            ? false
            : (process.env.NODE_ENV || "development") === "production" &&
              !(process.env.FRONTEND_URL || "").includes("localhost") &&
              !(process.env.FRONTEND_URL || "").includes("127.0.0.1"),
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      redirectUri: process.env.DISCORD_REDIRECT_URI,
      botToken: process.env.DISCORD_BOT_TOKEN,
      botPermissions:
        process.env.DISCORD_BOT_PERMISSIONS || "285280256824",
    },
    redis: {
      url: process.env.REDIS_URL || "",
    },
    cache: {
      defaultTtlSeconds: parseInt(
        process.env.CACHE_DEFAULT_TTL_SECONDS || "60",
        10,
      ),
    },
    metrics: {
      staleAfterSeconds: parseInt(
        process.env.METRICS_STALE_AFTER_SECONDS || "120",
        10,
      ),
    },
  };
};
