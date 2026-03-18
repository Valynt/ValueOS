import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { secretHealthMiddleware, SecretValidator } from "../SecretValidator.js";

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
    vi.restoreAllMocks();
  });

  it("fails validation when a required billing secret is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const validator = new SecretValidator();
    const result = await validator.validateAllSecrets();

    expect(result.isValid).toBe(false);
    const missingOrInvalid = new Set([
      ...result.missingSecrets,
      ...result.invalidSecrets.map((entry) => entry.key),
    ]);
    expect(missingOrInvalid.has("STRIPE_SECRET_KEY")).toBe(true);
  });
});


describe("secretHealthMiddleware", () => {
  beforeEach(() => {
    Object.entries(baseEnv).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });

    vi.spyOn(SecretValidator.prototype, "getSecretHealthCheck").mockResolvedValue({
      status: "healthy",
      details: {
        totalSecrets: 10,
        validSecrets: 10,
        missingSecrets: 0,
        invalidSecrets: 0,
        warnings: 0,
        criticalFailures: 0,
        secretVolumeWatcherActive: true,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not expose detailed posture on the public path", async () => {
    const app = express();
    app.get("/health/secrets/public", secretHealthMiddleware({ mode: "public" }));

    const response = await request(app).get("/health/secrets/public");

    expect(response.status).toBe(200);
    expect(response.body.status).toMatch(/ok|degraded/);
    expect(response.body).not.toHaveProperty("details");
  });

  it("rejects unauthorized callers for privileged posture details", async () => {
    vi.stubEnv("SERVICE_IDENTITY_REQUIRED", "true");

    const app = express();
    app.get(
      "/health/secrets",
      (_req, res, next) => {
        const authHeader = _req.header("x-service-identity");

        if (authHeader !== "trusted-service") {
          res.status(401).json({ error: "Service identity verification failed" });
          return;
        }

        next();
      },
      secretHealthMiddleware({ mode: "privileged" })
    );

    const unauthorized = await request(app).get("/health/secrets");
    expect(unauthorized.status).toBe(401);

    const authorized = await request(app)
      .get("/health/secrets")
      .set("x-service-identity", "trusted-service");

    expect(authorized.status).toBe(200);
    expect(authorized.body).toHaveProperty("details");
    expect(authorized.body.details).toHaveProperty("missingSecrets");
  });
});
