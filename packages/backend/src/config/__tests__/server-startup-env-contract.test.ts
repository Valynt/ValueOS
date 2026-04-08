import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateEnvOrThrow } from "../validateEnv.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function seedBaseEnv(nodeEnv: "development" | "production"): void {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.example.com:5432/valueos?sslmode=require");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_KEY", "anon-key");
  vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("TCT_SECRET", "b".repeat(64));
  vi.stubEnv("AUTH_FALLBACK_EMERGENCY_MODE", "false");

  if (nodeEnv === "production") {
    vi.stubEnv("REDIS_URL", "rediss://redis.example.com:6380");
    vi.stubEnv("REDIS_TLS_SERVERNAME", "redis.example.com");
    vi.stubEnv("REDIS_TLS_CA_CERT", "mock-ca-cert");
    vi.stubEnv("REDIS_TLS_REJECT_UNAUTHORIZED", "true");
    vi.stubEnv("CACHE_ENCRYPTION_KEY", "c".repeat(32));
    vi.stubEnv("APP_ENCRYPTION_KEY", "base64:" + "d".repeat(44));
    vi.stubEnv("MFA_ENABLED", "true");
    vi.stubEnv("TELEMETRY_LOG_HASH_SALT", "telemetry-salt");
    vi.stubEnv("BROWSER_TELEMETRY_INGESTION_KEY", "telemetry-ingestion-key");
    vi.stubEnv("BROWSER_TELEMETRY_ALLOWED_ORIGINS", "https://app.valueos.com");
  }
}

describe("server startup env contract", () => {
  it("wires server startup to canonical validateEnvOrThrow path", () => {
    const thisFile = fileURLToPath(import.meta.url);
    const serverPath = path.resolve(path.dirname(thisFile), "../../server.ts");
    const serverSource = readFileSync(serverPath, "utf8");

    expect(serverSource).toContain('import { validateEnvOrThrow } from "./config/validateEnv.js";');
    expect(serverSource).toContain("validateEnvOrThrow();");
  });

  it("fails startup when TCT_SECRET is missing", () => {
    seedBaseEnv("development");
    vi.stubEnv("TCT_SECRET", "");

    expect(() => validateEnvOrThrow()).toThrowError(/Missing TCT_SECRET/);
  });

  it("fails startup in production when Redis TLS is not enforced", () => {
    seedBaseEnv("production");
    vi.stubEnv("REDIS_URL", "redis://redis.example.com:6379");

    expect(() => validateEnvOrThrow()).toThrowError(/REDIS_URL must use TLS/);
  });

  it("fails startup in production when auth fallback controls are unsafe", () => {
    seedBaseEnv("production");
    vi.stubEnv("ALLOW_LOCAL_JWT_FALLBACK", "true");

    expect(() => validateEnvOrThrow()).toThrowError(/ALLOW_LOCAL_JWT_FALLBACK=true is forbidden in production/);
  });
});
