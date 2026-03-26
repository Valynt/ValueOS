import { afterEach, describe, expect, it, vi } from "vitest";

import { validateEnvOrThrow } from "../validateEnv.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateEnvOrThrow Redis transport enforcement", () => {
  it("fails startup in staging when REDIS_URL uses insecure transport", () => {
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.internal:5432/valueos?sslmode=verify-full");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_KEY", "anon-key");
    vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("TCT_SECRET", "test-tct-secret");
    vi.stubEnv("REDIS_URL", "redis://redis.internal:6379");
    vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
    vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "/run/secrets/redis-ca.crt");
    vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.internal");

    expect(() => validateEnvOrThrow()).toThrowError(/REDIS_URL must use TLS/);
  });
});
