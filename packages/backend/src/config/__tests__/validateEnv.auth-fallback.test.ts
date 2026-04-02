import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

import { validateEnv } from "../validateEnv.js";

function signIncidentContext(params: {
  incidentId: string;
  incidentSeverity: string;
  incidentStartedAt: string;
  incidentCorrelationId: string;
  ttlUntil: string;
  allowedRoutes: string;
  allowedMethods: string;
  signingSecret: string;
}): string {
  return createHmac("sha256", params.signingSecret)
    .update(
      [
        params.incidentId,
        params.incidentSeverity,
        params.incidentStartedAt,
        params.incidentCorrelationId,
        params.ttlUntil,
        params.allowedRoutes,
        params.allowedMethods,
      ].join("|")
    )
    .digest("hex");
}

function signApprovalArtifactToken(params: {
  incidentId: string;
  incidentCorrelationId: string;
  approvedAt: string;
  expiresAt: string;
  signingSecret: string;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      incidentId: params.incidentId,
      incidentCorrelationId: params.incidentCorrelationId,
      approvedAt: params.approvedAt,
      expiresAt: params.expiresAt,
      scope: "auth-fallback",
    })
  ).toString("base64url");
  const signature = createHmac("sha256", params.signingSecret).update(payload).digest("hex");
  return `v1.${payload}.${signature}`;
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
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_CORRELATION_ID", "CORR-5678");
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_ROUTES", "/api/secure");
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_METHODS", "GET");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SIGNING_SECRET", "");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE", "");
    vi.stubEnv("AUTH_FALLBACK_APPROVAL_TOKEN", "");
    vi.stubEnv("AUTH_FALLBACK_APPROVAL_SIGNING_SECRET", "");
    vi.stubEnv("AUTH_FALLBACK_MAINTENANCE_WINDOW_START", new Date(Date.now() - 60_000).toISOString());
    vi.stubEnv("AUTH_FALLBACK_MAINTENANCE_WINDOW_END", new Date(Date.now() + 60_000).toISOString());

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
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_CORRELATION_ID", "CORR-5678");
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_ROUTES", "/api/secure");
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_METHODS", "GET");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SIGNING_SECRET", "signing-secret");
    vi.stubEnv(
      "AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE",
      signIncidentContext({
        incidentId: "INC-5678",
        incidentSeverity: "critical",
        incidentStartedAt,
        incidentCorrelationId: "CORR-5678",
        ttlUntil,
        allowedRoutes: "/api/secure",
        allowedMethods: "GET",
        signingSecret: "signing-secret",
      }),
    );
    vi.stubEnv("AUTH_FALLBACK_APPROVAL_SIGNING_SECRET", "approval-secret");
    vi.stubEnv(
      "AUTH_FALLBACK_APPROVAL_TOKEN",
      signApprovalArtifactToken({
        incidentId: "INC-5678",
        incidentCorrelationId: "CORR-5678",
        approvedAt: new Date(Date.now() - 60_000).toISOString(),
        expiresAt: ttlUntil,
        signingSecret: "approval-secret",
      }),
    );
    vi.stubEnv("AUTH_FALLBACK_MAINTENANCE_WINDOW_START", new Date(Date.now() - 60_000).toISOString());
    vi.stubEnv("AUTH_FALLBACK_MAINTENANCE_WINDOW_END", new Date(Date.now() + 60_000).toISOString());

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.includes("hard limit of 1800 seconds")),
    ).toBe(true);
  });

  it("fails when emergency fallback mode is outside approved maintenance window", () => {
    const { ttlUntil, incidentStartedAt } = stubBaselineProductionEnv();
    vi.stubEnv("AUTH_FALLBACK_EMERGENCY_MODE", "true");
    vi.stubEnv("AUTH_FALLBACK_EMERGENCY_TTL_UNTIL", ttlUntil);
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_ID", "INC-5678");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SEVERITY", "critical");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_STARTED_AT", incidentStartedAt);
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_CORRELATION_ID", "CORR-5678");
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_ROUTES", "/api/secure");
    vi.stubEnv("AUTH_FALLBACK_ALLOWED_METHODS", "GET");
    vi.stubEnv("AUTH_FALLBACK_INCIDENT_SIGNING_SECRET", "signing-secret");
    vi.stubEnv(
      "AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE",
      signIncidentContext({
        incidentId: "INC-5678",
        incidentSeverity: "critical",
        incidentStartedAt,
        incidentCorrelationId: "CORR-5678",
        ttlUntil,
        allowedRoutes: "/api/secure",
        allowedMethods: "GET",
        signingSecret: "signing-secret",
      }),
    );
    vi.stubEnv("AUTH_FALLBACK_APPROVAL_SIGNING_SECRET", "approval-secret");
    vi.stubEnv(
      "AUTH_FALLBACK_APPROVAL_TOKEN",
      signApprovalArtifactToken({
        incidentId: "INC-5678",
        incidentCorrelationId: "CORR-5678",
        approvedAt: new Date(Date.now() - 60_000).toISOString(),
        expiresAt: ttlUntil,
        signingSecret: "approval-secret",
      }),
    );
    vi.stubEnv("AUTH_FALLBACK_MAINTENANCE_WINDOW_START", new Date(Date.now() + 10 * 60_000).toISOString());
    vi.stubEnv("AUTH_FALLBACK_MAINTENANCE_WINDOW_END", new Date(Date.now() + 20 * 60_000).toISOString());

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.includes("approved maintenance window")),
    ).toBe(true);
  });
});
