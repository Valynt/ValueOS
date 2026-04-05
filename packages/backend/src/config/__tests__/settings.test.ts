import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const applyBaseEnv = () => {
  process.env = {
    ...ORIGINAL_ENV,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
  };
};

describe("settings database pool sizing", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("derives a smaller api pool in autoscaled production environments", async () => {
    applyBaseEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "prod";
    process.env.DATABASE_POOL_ROLE = "api";
    process.env.DATABASE_EXPECTED_CONCURRENCY = "8";

    const { settings } = await import("../settings.js");

    expect(settings.databasePool.appEnv).toBe("prod");
    expect(settings.databasePool.role).toBe("api");
    expect(settings.databasePool.expectedConcurrency).toBe(8);
    expect(settings.databasePool.max).toBe(4);
    expect(settings.databasePool.maxSource).toBe("derived");
  });

  it("allows explicit pool overrides when an operator sets DATABASE_POOL_MAX", async () => {
    applyBaseEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "prod";
    process.env.DATABASE_POOL_ROLE = "api";
    process.env.DATABASE_EXPECTED_CONCURRENCY = "8";
    process.env.DATABASE_POOL_MAX = "7";

    const { settings } = await import("../settings.js");

    expect(settings.databasePool.max).toBe(7);
    expect(settings.databasePool.maxSource).toBe("env-override");
  });

  it("accepts DATABASE_POOL_SIZE as a compatibility alias for pool overrides", async () => {
    applyBaseEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "prod";
    process.env.DATABASE_POOL_ROLE = "worker";
    process.env.DATABASE_EXPECTED_CONCURRENCY = "4";
    process.env.DATABASE_POOL_SIZE = "4";

    const { settings } = await import("../settings.js");

    expect(settings.databasePool.role).toBe("worker");
    expect(settings.databasePool.expectedConcurrency).toBe(4);
    expect(settings.databasePool.max).toBe(4);
    expect(settings.databasePool.maxSource).toBe("env-override");
  });

  it("uses a higher local default for api pods when concurrency is not provided", async () => {
    applyBaseEnv();
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "local";

    const { settings } = await import("../settings.js");

    expect(settings.databasePool.appEnv).toBe("local");
    expect(settings.databasePool.role).toBe("api");
    expect(settings.databasePool.expectedConcurrency).toBe(12);
    expect(settings.databasePool.max).toBe(6);
  });
});

describe("settings CORS allowlist requirements", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("fails startup in prod when CORS_ALLOWED_ORIGINS is unset", async () => {
    applyBaseEnv();
    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "prod";
    delete process.env.CORS_ALLOWED_ORIGINS;

    await expect(import("../settings.js")).rejects.toThrow(
      "CORS_ALLOWED_ORIGINS must be explicitly configured when APP_ENV=prod"
    );
  });

  it("fails startup in staging when CORS_ALLOWED_ORIGINS is empty", async () => {
    applyBaseEnv();
    process.env.NODE_ENV = "staging";
    process.env.APP_ENV = "staging";
    process.env.CORS_ALLOWED_ORIGINS = "   ";

    await expect(import("../settings.js")).rejects.toThrow(
      "CORS_ALLOWED_ORIGINS must be explicitly configured when APP_ENV=staging"
    );
  });

  it("keeps localhost fallback in local environments when CORS_ALLOWED_ORIGINS is unset", async () => {
    applyBaseEnv();
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "local";
    delete process.env.CORS_ALLOWED_ORIGINS;

    const { settings } = await import("../settings.js");

    expect(settings.security.corsOrigins).toEqual([
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
    ]);
  });
});
