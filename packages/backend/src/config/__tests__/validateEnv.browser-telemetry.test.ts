import { afterEach, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../validateEnv.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function applySecureEnvBaseline(nodeEnv: "staging" | "production"): void {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.internal:5432/valueos?sslmode=require");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_KEY", "anon-key");
  vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("TCT_SECRET", "test-tct-secret-value");
  vi.stubEnv("REDIS_URL", "rediss://redis.internal:6379");
  vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
  vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "/run/secrets/redis-ca.crt");
  vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.internal");
  vi.stubEnv("CACHE_ENCRYPTION_ENABLED", "true");
  vi.stubEnv("CACHE_ENCRYPTION_KEY", "cache-key");
}

describe("validateEnv browser telemetry controls", () => {
  it("fails in staging when browser telemetry ingestion key is missing", () => {
    applySecureEnvBaseline("staging");
    vi.stubEnv("TELEMETRY_LOG_HASH_SALT", "telemetry-log-hash-salt");
    vi.stubEnv("BROWSER_TELEMETRY_ALLOWED_ORIGINS", "https://app.valueos.example");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("BROWSER_TELEMETRY_INGESTION_KEY"))).toBe(true);
  });

  it("fails in production when browser telemetry allowed origins are missing", () => {
    applySecureEnvBaseline("production");
    vi.stubEnv("TELEMETRY_LOG_HASH_SALT", "telemetry-log-hash-salt");
    vi.stubEnv("BROWSER_TELEMETRY_INGESTION_KEY", "browser-telemetry-secret");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("BROWSER_TELEMETRY_ALLOWED_ORIGINS"))).toBe(true);
  });

  it("fails in staging when browser telemetry allowed origins include wildcard", () => {
    applySecureEnvBaseline("staging");
    vi.stubEnv("TELEMETRY_LOG_HASH_SALT", "telemetry-log-hash-salt");
    vi.stubEnv("BROWSER_TELEMETRY_INGESTION_KEY", "browser-telemetry-secret");
    vi.stubEnv("BROWSER_TELEMETRY_ALLOWED_ORIGINS", "*");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("must not include wildcard origins"))).toBe(true);
  });

  it("fails in secure envs when TELEMETRY_LOG_HASH_SALT is missing", () => {
    applySecureEnvBaseline("production");
    vi.stubEnv("BROWSER_TELEMETRY_INGESTION_KEY", "browser-telemetry-secret");
    vi.stubEnv("BROWSER_TELEMETRY_ALLOWED_ORIGINS", "https://app.valueos.example");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("TELEMETRY_LOG_HASH_SALT"))).toBe(true);
  });

  it("does not require TELEMETRY_LOG_HASH_SALT in non-secure envs", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/valueos");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_KEY", "anon-key");
    vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("TCT_SECRET", "test-tct-secret-value");

    const result = validateEnv();

    expect(result.errors.some((error) => error.includes("TELEMETRY_LOG_HASH_SALT"))).toBe(false);
  });
});
