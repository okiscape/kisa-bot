const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "session",
  "session_token",
  "kisa_session",
]);

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }
  return value;
}

export function redactObject(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactValue(key, value);
  }
  return out;
}
