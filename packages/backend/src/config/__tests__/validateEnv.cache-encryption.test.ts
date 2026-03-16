import { afterEach, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../validateEnv.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateEnv cache encryption enforcement", () => {
  it("fails in production when CACHE_ENCRYPTION_ENABLED=false", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.internal:5432/valueos?sslmode=require");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("TOGETHER_API_KEY", "test-key");
    vi.stubEnv("MFA_ENABLED", "true");
    vi.stubEnv("APP_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("CACHE_ENCRYPTION_ENABLED", "false");
    vi.stubEnv("CACHE_ENCRYPTION_KEY", "test-cache-key");
    vi.stubEnv("REDIS_URL", "rediss://redis.internal:6379");
    vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
    vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "/run/secrets/redis-ca.crt");
    vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.internal");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("CACHE_ENCRYPTION_ENABLED"))).toBe(true);
  });

  it("fails in production when CACHE_ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.internal:5432/valueos?sslmode=require");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("TOGETHER_API_KEY", "test-key");
    vi.stubEnv("MFA_ENABLED", "true");
    vi.stubEnv("APP_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("CACHE_ENCRYPTION_ENABLED", "true");
    vi.stubEnv("CACHE_ENCRYPTION_KEY", "");
    vi.stubEnv("REDIS_URL", "rediss://redis.internal:6379");
    vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
    vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "/run/secrets/redis-ca.crt");
    vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.internal");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("CACHE_ENCRYPTION_KEY"))).toBe(true);
  });
});
