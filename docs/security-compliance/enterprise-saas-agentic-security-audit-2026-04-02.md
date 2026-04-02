# Enterprise SaaS Agentic Repository Security Audit

**Date:** 2026-04-02  
**Scope:** Repository architecture and controls across backend/API, infra, and compliance artifacts for ValueOS.  
**Method:** Static architecture/control review (code + infrastructure manifests + compliance documents).

---

## Prioritized Findings

### 1) **Critical** — Historical exposure of real Supabase keys (including `service_role`) remains open

**What we observed**
- The secret rotation log records unresolved exposure of real Supabase project keys in git history, including a `service_role` key (RLS-bypass capability), and marks rotation as action-required.  

**Risk**
- Active compromise potential if any exposed key remains valid.
- Full-tenant data access is possible with `service_role` credentials.

**Recommended remediation (immediate)**
1. Rotate affected Supabase keys immediately for all listed projects.
2. Update all runtime secret stores (prod/staging/CI) with rotated values.
3. Audit Supabase access logs from first exposure date to present.
4. Purge historical secret material from git history and force-reset clones.
5. Add closure evidence (ticket, timestamp, operator, validation results) into the rotation log.

**Evidence**
- `docs/security-compliance/secret-rotation-log.md`
- `docs/AGENTS.md` (security controls section references this known exposure)

---

### 2) **High** — Compliance artifacts show unresolved SOC2/HIPAA control gaps in tenant isolation and agent boundaries

**What we observed**
- The compliance guide contains multiple unchecked controls with remediation records (e.g., explicit admin exceptions, agent execution scoping, API key organization scoping, query hardening, and agent prompt/context tenant boundaries).

**Risk**
- Cross-tenant leakage, unauthorized access, and failed attestations during SOC2/HIPAA review.

**Recommended remediation**
1. Promote all open CR-009+ security records into engineering sprint gates with due dates and owners in active backlog.
2. Add CI hard-fail checks for unresolved critical control IDs past due.
3. Enforce policy checks for agent context scoping and API key tenant scope at middleware level.
4. Add control-level test evidence links for each unresolved record.

**Evidence**
- `docs/security-compliance/compliance-guide.md` (multi-tenancy checklist + remediation records)

---

### 3) **High** — Public telemetry endpoint has optional authentication path and depends on header/origin key controls

**What we observed**
- `/api/analytics` includes `optionalAuth`; public telemetry ingestion relies on optional key/origin restrictions and rate limiting.

**Risk**
- Abuse risk (event poisoning, noisy telemetry, data quality degradation, volumetric amplification) if telemetry key policy is weak or absent in some environments.

**Recommended remediation**
1. Require signed ingestion tokens for telemetry in all non-local environments.
2. Enforce strict allowed-origin list by default (deny when unset in production).
3. Add WAF/IP reputation + bot controls for telemetry endpoints.
4. Partition telemetry ingestion onto dedicated endpoint/service with separate rate policy and anomaly alerting.

**Evidence**
- `packages/backend/src/api/analytics.ts`
- `packages/backend/src/server.ts`

---

### 4) **High** — Secrets path naming drift (`valuecanvas` prefix) may create governance and rotation blind spots

**What we observed**
- Tenant secret paths in the manager are still generated under `valuecanvas/{environment}/tenants/...`.

**Risk**
- Operational confusion, missed key rotations, and inconsistent IAM/resource policies due to legacy naming.

**Recommended remediation**
1. Introduce canonical `valueos/...` path format with migration support.
2. Implement dual-read/single-write transition window and cutover checklist.
3. Update IAM policies and secret inventory tooling to canonical namespace.
4. Add startup warning/fail policy if deprecated namespace remains in production after deadline.

**Evidence**
- `packages/backend/src/config/secretsManager.ts`
- `AGENTS.md` (product naming alignment guidance)

---

### 5) **Medium** — Application-layer TLS termination is externalized; verify hard enforcement at ingress and internal service mesh

**What we observed**
- Backend server is standard Express (no local TLS termination), implying TLS enforcement must be guaranteed by edge ingress and mesh policy.
- Istio mesh policies define STRICT mTLS.

**Risk**
- If ingress or service mesh is misconfigured per environment, plaintext hop exposure is possible.

**Recommended remediation**
1. Add automated environment conformance tests proving HTTPS-only ingress and mTLS STRICT in all namespaces.
2. Add CI/CD drift detector for gateway TLS cipher/version policy.
3. Publish environment evidence (cert chain, TLS policy snapshots) to compliance bundle.

**Evidence**
- `packages/backend/src/server.ts`
- `infra/k8s/security/mesh-authentication.yaml`

---

### 6) **Medium** — Rate limiting strategy is robust but still partially environment-dependent (distributed backend + fallback behavior)

**What we observed**
- Tiered rate limiting is implemented with risk metadata and fail-closed behavior for sensitive paths.
- Design still includes fallback mechanics and operator overrides that need governance.

**Risk**
- Under backend degradation or misconfiguration, controls can become less strict than intended.

**Recommended remediation**
1. In production, enforce distributed-only store for all authenticated mutation routes with no fallback override.
2. Alert on any invocation of sensitive fallback override.
3. Add chaos tests for Redis/rate-store outage proving protective behavior remains fail-closed.

**Evidence**
- `packages/backend/src/middleware/rateLimiter.ts`
- `packages/backend/src/server.ts`

---

### 7) **Medium** — Service-role usage remains an architectural high-risk surface requiring continuous hardening

**What we observed**
- Repository policy explicitly recognizes `service_role` as RLS-bypass and constrains usage to specific directories with justification annotations.

**Risk**
- Any route-level misuse or policy drift can bypass tenant data controls.

**Recommended remediation**
1. Keep CI guardrails blocking service-role imports in request handlers.
2. Add periodic automated inventory diff of all service-role call sites + human review signoff.
3. Require runtime audit events for each service-role execution context (who/why/path/tenant).

**Evidence**
- `docs/AGENTS.md`
- `docs/supabase-service-role-audit.md`

---

### 8) **Medium** — Encryption controls are strong in code paths, but require stricter operational proof for at-rest/in-transit attestations

**What we observed**
- Envelope encryption utilities and AES-GCM secret cache encryption paths are present.
- Compliance docs reference encryption assertions and evidence expectations.

**Risk**
- Audit failure if implementation proof (key rotation evidence, effective config state, and environment-level enforcement) is incomplete.

**Recommended remediation**
1. Add automated checks for required encryption env vars in production deploy gates.
2. Emit periodic cryptographic posture report (active KEK version, rotation age, encryption-required flags).
3. Tie encryption evidence artifacts directly to SOC2/HIPAA control IDs.

**Evidence**
- `packages/backend/src/utils/encryption.ts`
- `packages/backend/src/config/secrets/CacheEncryption.ts`
- `docs/security-compliance/compliance-guide.md`

---

### 9) **Low** — Public analytics and optional-auth routes should have explicit data minimization policy controls documented per endpoint

**What we observed**
- Telemetry endpoint includes sanitization and hashing helpers, but route-level data minimization contract is not centrally codified as policy-as-code.

**Risk**
- Long-term privacy drift and inconsistent operational handling of pseudonymous telemetry metadata.

**Recommended remediation**
1. Add explicit schema-level “allowed fields” control registry for telemetry payloads.
2. Add retention limits and auto-purge policy for telemetry records.
3. Add privacy impact review gate for telemetry schema changes.

**Evidence**
- `packages/backend/src/api/analytics.ts`
- `docs/security-compliance/compliance-guide.md`

---

## Focus-Area Summary

### Authentication & Authorization
- Strengths: strong middleware layering (`requireAuth`, tenant context), RBAC patterns, RLS-first architecture.  
- Priority risks: unresolved control checklist items; service-role bypass blast radius.

### Encryption at Rest / In Transit
- Strengths: AES-GCM utilities, KEK versioning, mesh mTLS manifests.  
- Priority risks: operational evidence completeness and environment conformance proof.

### API Security & Rate Limiting
- Strengths: tiered limiter with risk-aware fail-closed behavior for sensitive paths, CSRF handling, audit middleware.  
- Priority risks: public telemetry abuse path and fallback governance.

### SOC2 / GDPR / HIPAA
- Strengths: mature compliance documentation, control registries, evidence workflows.  
- Priority risks: open remediation records and HIPAA readiness depending on technical validation completion.

### Secrets Management & Env Handling
- Strengths: secrets manager, rotation log, scanning and policy documentation.  
- Priority risks: unresolved historical exposure; namespace drift; strict separation enforcement for env files must remain continuously validated.

### Network Security & Access Controls
- Strengths: default-deny NetworkPolicy + Istio STRICT mTLS + AuthorizationPolicy controls.  
- Priority risks: environment drift between declared and effective policy.

---

## Executive Remediation Plan (30/60/90)

### 0–30 days
- Close exposed Supabase key incident end-to-end (rotate, verify, purge history, evidence).
- Convert top open compliance remediation records to blocking CI gates.
- Enforce mandatory telemetry key/origin policy in production.

### 31–60 days
- Complete secret path namespace migration plan (`valuecanvas` -> `valueos`).
- Add automated TLS/mTLS conformance verification across environments.
- Add outage/chaos tests for rate limiter backend and fail-closed guarantees.

### 61–90 days
- Full control-evidence traceability automation for SOC2/GDPR/HIPAA control IDs.
- Quarterly independent security control effectiveness review with red-team scenarios around tenant isolation and service-role misuse.

