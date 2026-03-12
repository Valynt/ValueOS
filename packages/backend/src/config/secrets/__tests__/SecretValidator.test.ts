import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SecretValidator } from "../SecretValidator.js"

const baseEnv = {
  NODE_ENV: "production",
  ENABLE_BILLING: "true",
  DATABASE_URL: "postgres://user:pass@localhost:5432/valueos",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-key-1234567890",
  SUPABASE_ANON_KEY: "anon-key-1234567890123",
  VITE_SUPABASE_ANON_KEY: "vite-anon-key-1234567890",
  JWT_SECRET: "jwt-secret-123456789012345678901234",
  ENCRYPTION_KEY: "encryption-key-1234567890123456789",
  REDIS_URL: "rediss://localhost:6380",
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_publishable",
};

describe("SecretValidator", () => {
  beforeEach(() => {
    Object.entries(baseEnv).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails validation when a required billing secret is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const validator = new SecretValidator();
    const result = await validator.validateAllSecrets();

    expect(result.isValid).toBe(false);
    expect(result.missingSecrets).toContain("STRIPE_SECRET_KEY");
  });
});
