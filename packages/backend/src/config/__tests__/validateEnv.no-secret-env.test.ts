import { describe, expect, it, vi } from "vitest";

import { validateEnv } from "../validateEnv.js";

describe("validateEnv no-secret-in-env policy", () => {
  it("fails in production when sensitive secrets are in process.env without allowlist", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOGETHER_API_KEY", "super-secret-key");
    vi.stubEnv("DATABASE_URL", "postgres://localhost:5432/valueos");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_KEY", "anon");
    vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("TCT_SECRET", "b".repeat(64));

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("TOGETHER_API_KEY"))).toBe(true);
  });

  it("allows explicitly allowlisted secrets in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOGETHER_API_KEY", "super-secret-key");
    vi.stubEnv("SECRET_ENV_ALLOWLIST", "TOGETHER_API_KEY");
    vi.stubEnv("DATABASE_URL", "postgres://localhost:5432/valueos?sslmode=require");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_KEY", "anon");
    vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("TCT_SECRET", "b".repeat(64));
    vi.stubEnv("APP_ENCRYPTION_KEY", `base64:${"c".repeat(44)}`);
    vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
    vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "/tmp/ca.crt");
    vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.internal");

    const result = validateEnv();

    expect(result.errors.some((error) => error.includes("TOGETHER_API_KEY"))).toBe(false);
  });
});
