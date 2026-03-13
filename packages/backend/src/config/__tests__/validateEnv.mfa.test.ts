import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateEnv } from "../validateEnv.js";

/**
 * MFA production enforcement — regression tests for #1541.
 *
 * validateEnv() must emit a warning when NODE_ENV=production and
 * MFA_ENABLED is absent or not "true". The warning must propagate to
 * the health endpoint via the returned warnings array.
 */
describe("validateEnv — MFA production enforcement", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Isolate env mutations per test
    process.env = {
      ...originalEnv,
      // Satisfy required vars so MFA is the only variable under test
      DATABASE_URL: "postgresql://localhost:5432/test",
      SUPABASE_URL: "http://localhost:54321",
      NODE_ENV: "production",
      TOGETHER_API_KEY: "test-key",
      // Suppress TLS checks that would add unrelated errors
      REDIS_URL: undefined,
    };
    delete process.env.MFA_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("warns when MFA_ENABLED is absent in production", () => {
    const { warnings } = validateEnv();
    expect(warnings.some((w) => w.includes("MFA_ENABLED"))).toBe(true);
  });

  it("warns when MFA_ENABLED=false in production", () => {
    process.env.MFA_ENABLED = "false";
    const { warnings } = validateEnv();
    expect(warnings.some((w) => w.includes("MFA_ENABLED"))).toBe(true);
  });

  it("does not warn when MFA_ENABLED=true in production", () => {
    process.env.MFA_ENABLED = "true";
    const { warnings } = validateEnv();
    expect(warnings.some((w) => w.includes("MFA_ENABLED"))).toBe(false);
  });

  it("does not warn about MFA in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.MFA_ENABLED;
    const { warnings } = validateEnv();
    expect(warnings.some((w) => w.includes("MFA_ENABLED"))).toBe(false);
  });
});
