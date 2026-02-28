import { afterEach, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../validateEnv.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateEnv transport security", () => {
  it("rejects insecure postgres and redis configuration in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.internal:5432/valueos");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("REDIS_URL", "redis://redis.internal:6379");
    vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "false");
    vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "");
    vi.stubEnv("REDIS_TLS_CA_CERT", "");
    vi.stubEnv("REDIS_TLS_SERVERNAME", "");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("sslmode=require"))).toBe(true);
    expect(result.errors.some((error) => error.includes("rediss://"))).toBe(true);
    expect(result.errors.some((error) => error.includes("REDIS_TLS_REJECT_UNAUTHORIZED"))).toBe(true);
    expect(result.errors.some((error) => error.includes("REDIS_TLS_CA_CERT_PATH"))).toBe(true);
    expect(result.errors.some((error) => error.includes("REDIS_TLS_SERVERNAME"))).toBe(true);
  });

  it("accepts strict TLS URLs in staging", () => {
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.internal:5432/valueos?sslmode=verify-full");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("REDIS_URL", "rediss://redis.internal:6379");
    vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
    vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "/run/secrets/redis-ca.crt");
    vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.internal");

    const result = validateEnv();

    expect(result.valid).toBe(true);
  });
});
