const REQUIRED = [
  "DATABASE_URL",
  "FRONTEND_URL",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_REDIRECT_URI",
  "DISCORD_BOT_TOKEN",
] as const;

function resolveSessionSecret(env: Record<string, unknown>): string | undefined {
  const sessionSecret = env.SESSION_SECRET;
  if (typeof sessionSecret === "string" && sessionSecret.length > 0) {
    return sessionSecret;
  }
  const legacy = env.NEXTAUTH_SECRET;
  if (typeof legacy === "string" && legacy.length > 0) {
    return legacy;
  }
  return undefined;
}

export function validateEnv(env: Record<string, unknown>) {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    const value = env[key];
    if (typeof value !== "string" || value.trim() === "") {
      missing.push(key);
    }
  }

  const sessionSecret = resolveSessionSecret(env);
  if (!sessionSecret) {
    missing.push("SESSION_SECRET");
  } else if (sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters (or set a strong NEXTAUTH_SECRET during migration)",
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const port = env.BACKEND_PORT;
  if (port !== undefined && port !== "" && Number.isNaN(Number(port))) {
    throw new Error("BACKEND_PORT must be a number");
  }

  return env;
}
