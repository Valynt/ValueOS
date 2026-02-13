const PII_KEYS = new Set(["password", "token", "secret", "ssn", "creditCard", "email"]);

export function sanitizeForLogging(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    result[key] = PII_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return result;
}

export function sanitizeUser(user: Record<string, unknown>): Record<string, unknown> {
  const { password: _p, token: _t, secret: _s, ...safe } = user;
  return safe;
}
