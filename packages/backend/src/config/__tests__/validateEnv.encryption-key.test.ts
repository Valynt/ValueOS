import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateEnv } from "../validateEnv.js";

/**
 * ENCRYPTION_KEY production enforcement.
 *
 * validateEnv() must error when NODE_ENV=production and ENCRYPTION_KEY is
 * absent or too short. Accepted formats: hex (64 chars), base64 (44 chars),
 * pbkdf2:<iterations>:<salt>:<passphrase>, or prefixed hex:/base64:.
 */
describe("validateEnv — ENCRYPTION_KEY production enforcement", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Isolate env mutations per test. Satisfy all other required vars so
    // ENCRYPTION_KEY is the only variable under test.
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://localhost:5432/test",
      SUPABASE_URL: "http://localhost:54321",
      NODE_ENV: "production",
      TOGETHER_API_KEY: "test-key",
      MFA_ENABLED: "true",
      REDIS_URL: undefined,
    };
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("errors when ENCRYPTION_KEY is absent in production", () => {
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(true);
  });

  it("errors when ENCRYPTION_KEY is too short (< 44 chars, no prefix)", () => {
    process.env.ENCRYPTION_KEY = "tooshort";
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(true);
  });

  it("accepts a valid hex key (64 chars)", () => {
    // openssl rand -hex 32
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(false);
  });

  it("accepts a valid base64 key (44 chars)", () => {
    // openssl rand -base64 32 produces 44 chars
    process.env.ENCRYPTION_KEY = "a".repeat(44);
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(false);
  });

  it("accepts a hex:-prefixed key regardless of length", () => {
    process.env.ENCRYPTION_KEY = "hex:short";
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(false);
  });

  it("accepts a base64:-prefixed key regardless of length", () => {
    process.env.ENCRYPTION_KEY = "base64:short";
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(false);
  });

  it("accepts a pbkdf2:-prefixed key regardless of length", () => {
    process.env.ENCRYPTION_KEY = "pbkdf2:100000:somesalt:somepassphrase";
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(false);
  });

  it("does not check ENCRYPTION_KEY in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ENCRYPTION_KEY;
    const { errors } = validateEnv();
    expect(errors.some((e) => e.includes("ENCRYPTION_KEY"))).toBe(false);
  });
});
