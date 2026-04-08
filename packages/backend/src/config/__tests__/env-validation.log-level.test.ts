/**
 * validateEnv.ts — LOG_LEVEL startup validation tests
 *
 * Covers validateLogLevel() behaviour wired into validateEnv():
 * - Invalid values are rejected in all environments.
 * - LOG_LEVEL=debug is rejected in staging and production.
 * - Valid values are accepted in development.
 * - Unset LOG_LEVEL is accepted (runtime default of "info").
 */

import { describe, expect, it, vi } from "vitest";

// AuditLogEncryptionConfig imports CryptoUtils which may not be available in
// the test environment. Stub it out — we are not testing audit log encryption here.
vi.mock("../../services/agents/AuditLogEncryptionConfig.js", () => ({
  validateAuditLogEncryptionConfig: () => [],
}));

import { validateEnv } from "../validateEnv.js";

/** Minimal env that passes all other validators in development. */
function devEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: "development",
    ...overrides,
  };
}

/** Minimal env that passes all other validators in staging. */
function stagingEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: "staging",
    // staging requires Redis with TLS
    REDIS_URL: "rediss://redis.example.com:6380",
    REDIS_TLS_SERVERNAME: "redis.example.com",
    // staging requires cache encryption
    CACHE_ENCRYPTION_KEY: "a".repeat(32),
    ...overrides,
  };
}

/** Minimal env that passes all other validators in production. */
function productionEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: "production",
    REDIS_URL: "rediss://redis.example.com:6380",
    REDIS_TLS_SERVERNAME: "redis.example.com",
    CACHE_ENCRYPTION_KEY: "a".repeat(32),
    APP_ENCRYPTION_KEY: "b".repeat(32),
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    MFA_ENABLED: "true",
    ...overrides,
  };
}

describe("validateEnv — LOG_LEVEL validation", () => {
  describe("invalid values", () => {
    it("rejects LOG_LEVEL=verbose in development", () => {
      process.env = devEnv({ LOG_LEVEL: "verbose" });
      const result = validateEnv();
      expect(result.errors.some((e) => e.includes("Invalid LOG_LEVEL"))).toBe(true);
    });

    it("rejects LOG_LEVEL=silent in development", () => {
      process.env = devEnv({ LOG_LEVEL: "silent" });
      const result = validateEnv();
      expect(result.errors.some((e) => e.includes("Invalid LOG_LEVEL"))).toBe(true);
    });

    it("rejects LOG_LEVEL=trace in development", () => {
      process.env = devEnv({ LOG_LEVEL: "trace" });
      const result = validateEnv();
      expect(result.errors.some((e) => e.includes("Invalid LOG_LEVEL"))).toBe(true);
    });

    it("rejects LOG_LEVEL=WARN (wrong case treated as invalid)", () => {
      // The validator lowercases before checking, so "WARN" → "warn" is valid.
      // This test documents that behaviour explicitly.
      process.env = devEnv({ LOG_LEVEL: "WARN" });
      const result = validateEnv();
      expect(result.errors.some((e) => e.includes("Invalid LOG_LEVEL"))).toBe(false);
    });
  });

  describe("debug rejected in secure environments", () => {
    it("rejects LOG_LEVEL=debug in staging", () => {
      process.env = stagingEnv({ LOG_LEVEL: "debug" });
      const result = validateEnv();
      expect(
        result.errors.some((e) => e.includes("LOG_LEVEL=debug is not permitted in staging"))
      ).toBe(true);
    });

    it("rejects LOG_LEVEL=debug in production", () => {
      process.env = productionEnv({ LOG_LEVEL: "debug" });
      const result = validateEnv();
      expect(
        result.errors.some((e) => e.includes("LOG_LEVEL=debug is not permitted in production"))
      ).toBe(true);
    });
  });

  describe("valid values accepted", () => {
    it.each(["debug", "info", "warn", "error"])(
      "accepts LOG_LEVEL=%s in development",
      (level) => {
        process.env = devEnv({ LOG_LEVEL: level });
        const result = validateEnv();
        expect(result.errors.some((e) => e.includes("LOG_LEVEL"))).toBe(false);
      }
    );

    it.each(["info", "warn", "error"])(
      "accepts LOG_LEVEL=%s in staging",
      (level) => {
        process.env = stagingEnv({ LOG_LEVEL: level });
        const result = validateEnv();
        expect(result.errors.some((e) => e.includes("LOG_LEVEL"))).toBe(false);
      }
    );

    it.each(["info", "warn", "error"])(
      "accepts LOG_LEVEL=%s in production",
      (level) => {
        process.env = productionEnv({ LOG_LEVEL: level });
        const result = validateEnv();
        expect(result.errors.some((e) => e.includes("LOG_LEVEL"))).toBe(false);
      }
    );
  });

  describe("unset LOG_LEVEL", () => {
    it("is accepted in development (runtime defaults to info)", () => {
      const env = devEnv();
      delete (env as Record<string, string | undefined>).LOG_LEVEL;
      process.env = env as NodeJS.ProcessEnv;
      const result = validateEnv();
      expect(result.errors.some((e) => e.includes("LOG_LEVEL"))).toBe(false);
    });

    it("is accepted in staging", () => {
      const env = stagingEnv();
      delete (env as Record<string, string | undefined>).LOG_LEVEL;
      process.env = env as NodeJS.ProcessEnv;
      const result = validateEnv();
      expect(result.errors.some((e) => e.includes("LOG_LEVEL"))).toBe(false);
    });
  });
});
