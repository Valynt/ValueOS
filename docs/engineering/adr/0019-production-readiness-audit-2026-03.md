# ADR-0019: Production Readiness Audit Controls (March 27, 2026)

- Status: Accepted
- Date: 2026-03-27
- Scope: Auth fallback controls, tenant isolation validation, billing safety, CI required checks, worker coordination, observability.

## Context

ValueOS completed a production readiness audit that identified critical controls requiring hardening and several validated controls requiring explicit ADR-level documentation.

## Decision

1. **Emergency auth fallback is retained as break-glass only** with mandatory structured audit events, Prometheus metric `auth_fallback_activations_total`, and immediate critical alerting.
2. **Auth fallback environment variable surface is controlled**:
   - `AUTH_FALLBACK_EMERGENCY_MODE`
   - `AUTH_FALLBACK_EMERGENCY_TTL_UNTIL`
   - `AUTH_FALLBACK_INCIDENT_ID`
   - `AUTH_FALLBACK_INCIDENT_SEVERITY`
   - `AUTH_FALLBACK_INCIDENT_STARTED_AT`
   - `AUTH_FALLBACK_ALLOWED_ROUTES`
   - `AUTH_FALLBACK_ALLOWED_ROLES`
   - `AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE`
   - `AUTH_FALLBACK_INCIDENT_SIGNING_SECRET`
   - `AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS`
   - `AUTH_FALLBACK_ALERT_THRESHOLD`
   - `AUTH_FALLBACK_ALERT_WINDOW_SECONDS`
   - `ALLOW_LOCAL_JWT_FALLBACK` (explicitly forbidden in production)
3. **Tenant controls validated and documented**:
   - Tenant resolution chain in `tenantContext.ts`: TCT JWT → verified service header → user JWT claim → DB lookup, with conflict rejection.
   - DB transaction-scoped tenant context in `tenantDbContext.ts` via `SET LOCAL app.tenant_id` + RLS policies.
4. **CI now requires real Supabase integration lane** (`integration-supabase`) covering:
   - `security/rls-policies.test.ts` (mandatory multi-tenant RLS matrix).
   - `resiliency/advisory-lock-idempotency.test.ts`.
   - `integration/subscription-lifecycle.test.ts`.
   - `integration/quota-enforcement.test.ts`.
5. **Validated strong controls acknowledged**:
   - Webhook DB-constraint idempotency gate.
   - Transactional subscription change intent-log reference path.
   - Redis-backed billing rate-limit fail-open behavior.
   - OpenTelemetry bootstrap and auto-instrumentation.
   - CRM token encryption with AES-256-GCM envelope model.
   - SSRF/HMAC timing-safe verification in CRM provider integrations.
6. **Validated control crosswalk captured in this ADR (no separate ADR required)**:
   - AUTH-02 tenant resolution chain rationale (TCT JWT → service header → user claim → DB lookup + conflict rejection).
   - AUTH-03 transaction-scoped RLS via `SET LOCAL app.tenant_id`.
   - BILLING-04 webhook idempotency through DB `UNIQUE` constraints.
   - BILLING-05 plan-change intent log / saga path.
   - BILLING-08 Redis-backed rate limiting with fail-open.
   - BILLING-09 Prometheus billing metrics inventory.
   - RESIL-03 per-agent Redis kill switches.
   - RESIL-04 E2B sandboxing with code blocklist.
   - WORKERS-03 BullMQ webhook retry and deterministic job IDs.
   - WORKERS-04 workers deployed as separate Kubernetes Deployment.
   - OBS-01 OpenTelemetry auto-instrumentation config.
   - CRYPTO-01 AES-256-GCM envelope encryption + key versioning.
   - CRYPTO-02 SSRF controls + timing-safe HMAC verification.
   - CICD-05 emergency skip requires incident evidence.
   - CICD-06 PR gate inventory with 30+ checks.
   - CICD-07 staging performance gates + Cosign verification.

## Consequences

- Emergency fallback is auditable and immediately visible in monitoring.
- Merge-gate confidence for RLS and billing correctness increases due to real DB coverage.
- Audit evidence now includes explicit, durable rationale for previously implicit controls.
