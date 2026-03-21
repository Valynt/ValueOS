import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV,
  resolveAuditLogEncryptionKey,
  validateAuditLogEncryptionConfig,
} from "../../services/agents/AuditLogEncryptionConfig.js";
import { validateEnv } from "../validateEnv.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubBaselineProductionEnv(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://user:pass@db.internal:5432/valueos?sslmode=require",
  );
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_KEY", "anon-key");
  vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("TOGETHER_API_KEY", "test-key");
  vi.stubEnv("TCT_SECRET", "tct-secret");
  vi.stubEnv("MFA_ENABLED", "true");
  vi.stubEnv("APP_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
  vi.stubEnv("REDIS_TLS_CA_CERT_PATH", "/run/secrets/redis-ca.crt");
  vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.internal");
}

describe("validateEnv audit log encryption enforcement", () => {
  it("fails startup validation when audit log encryption is enabled without a configured key", () => {
    stubBaselineProductionEnv();
    vi.stubEnv("AUDIT_LOG_ENCRYPTION_ENABLED", "true");
    vi.stubEnv("AUDIT_LOG_ENCRYPTION_KEY", "");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.includes("AUDIT_LOG_ENCRYPTION_KEY")),
    ).toBe(true);
  });

  it("rejects test-only fallback outside test environments", () => {
    const errors = validateAuditLogEncryptionConfig({
      NODE_ENV: "production",
      AUDIT_LOG_ENCRYPTION_ENABLED: "true",
      AUDIT_LOG_ENCRYPTION_KEY: "",
      [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: "true",
    });

    expect(
      errors.some((error) => error.includes(AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV)),
    ).toBe(true);
  });
});

describe("AuditLogEncryptionConfig", () => {
  it("allows explicit test fallback only in test environments", () => {
    const env = {
      NODE_ENV: "test",
      AUDIT_LOG_ENCRYPTION_ENABLED: "true",
      [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: "true",
    };

    expect(validateAuditLogEncryptionConfig(env)).toEqual([]);
    expect(resolveAuditLogEncryptionKey(env)).toBeTruthy();
  });

  it("never resolves a fallback key in non-test environments", () => {
    const env = {
      NODE_ENV: "production",
      AUDIT_LOG_ENCRYPTION_ENABLED: "true",
      [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: "true",
    };

    expect(resolveAuditLogEncryptionKey(env)).toBeNull();
    expect(validateAuditLogEncryptionConfig(env)[0]).toContain(
      AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV,
    );
  });
});
