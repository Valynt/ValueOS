import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

import { validateEnv } from "../validateEnv.js";

function signIncidentContext(params: {
  incidentId: string;
  incidentSeverity: string;
  incidentStartedAt: string;
  ttlUntil: string;
  allowedRoutes: string;
  allowedRoles?: string;
  signingSecret: string;
}): string {
  return createHmac("sha256", params.signingSecret)
    .update(
      [
        params.incidentId,
        params.incidentSeverity,
        params.incidentStartedAt,
        params.ttlUntil,
        params.allowedRoutes,
        params.allowedRoles ?? "",
      ].join("|")
    )
    .digest("hex");
}

function stubBaselineProductionEnv(): { ttlUntil: string; incidentStartedAt: string } {
  const ttlUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const incidentStartedAt = new Date(Date.now() - 60 * 1000).toISOString();
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
  vi.stubEnv("ALLOW_LOCAL_JWT_FALLBACK", "false");
  vi.stubEnv("AUTH_FALLBACK_EMERGENCY_MODE", "false");
  return { ttlUntil, incidentStartedAt };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateEnv production auth fallback controls", () => {
  it("fails when legacy fallback is enabled in production", () => {
    stubBaselineProductionEnv();
    vi.stubEnv("ALLOW_LOCAL_JWT_FALLBACK", "true");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "ALLOW_LOCAL_JWT_FALLBACK=true is forbidden in production.",
    );
  });

  it("fails when emergency fallback mode lacks signed incident context", () => {
    const { ttlUntil, incidentStartedAt } = stubBaselineProductionEnv();
    vi.stubEnv("AUTH_FALLBACK_EMERGENCY_MODE", "true");
    vi.stubEnv("AUTH_FALLBACK_EMERGENCY_TTL_UNTIL", ttlUntil);
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_ID", "INC-5678");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SEVERITY", "critical");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_STARTED_AT", incidentStartedAt);
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_ROUTES", "/api/secure");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SIGNING_SECRET", "");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE", "");

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes("AUTH_FALLBACK_INCIDENT_SIGNING_SECRET"),
      ),
    ).toBe(true);
  });

  it("fails when emergency fallback TTL exceeds the hard 30-minute limit", () => {
    const { incidentStartedAt } = stubBaselineProductionEnv();
    const ttlUntil = new Date(Date.now() + 45 * 60 * 1000).toISOString();
    vi.stubEnv("AUTH_FALLBACK_EMERGENCY_MODE", "true");
    vi.stubEnv("AUTH_FALLBACK_EMERGENCY_TTL_UNTIL", ttlUntil);
    vi.stubEnv("AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS", "3600");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_ID", "INC-5678");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SEVERITY", "critical");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_STARTED_AT", incidentStartedAt);
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_ROUTES", "/api/secure");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SIGNING_SECRET", "signing-secret");
    vi.stubEnv(
      "AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE",
      signIncidentContext({
        incidentId: "INC-5678",
        incidentSeverity: "critical",
        incidentStartedAt,
        ttlUntil,
        allowedRoutes: "/api/secure",
        signingSecret: "signing-secret",
      }),
    );

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.includes("hard limit of 1800 seconds")),
    ).toBe(true);
  });
});
