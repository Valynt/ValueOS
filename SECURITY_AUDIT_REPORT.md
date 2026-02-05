# Enterprise SaaS Agentic Repository Security Audit Report

_Date:_ 2026-02-05  
_Scope reviewed:_ application backend middleware, deployment manifests, environment and compliance automation in this repository.

## 1) **Critical** — Potential sensitive data leakage through request/audit logging

**Evidence**
- Request audit middleware persists `req.query`, route parameters, actor labels, and request metadata directly into audit events without explicit field-level redaction in this middleware path. This can capture credentials, tokens, PHI/PII, and other regulated values if they arrive through query strings or route parameters.  

**Why this matters**
- Violates least-data principles and can create direct GDPR/HIPAA exposure if personal/sensitive data is retained in logs.
- Increases blast radius during incident response because logs become a secondary sensitive data store.

**Recommended remediation**
1. Implement a centralized structured-log redaction policy (denylist + allowlist) for `query`, `params`, `headers`, and `eventData` before persistence.
2. Blocklist known sensitive keys (`token`, `authorization`, `password`, `otp`, `ssn`, `dob`, `email`, etc.) and add regex detectors for bearer/JWT/API-key patterns.
3. Add retention minimization and differential retention (short TTL for raw security logs, long TTL only for summarized events).
4. Add unit tests asserting redaction behavior for query/params and CI gate on redaction regressions.

---

## 2) **High** — JWT local-verification fallback can weaken trust boundaries

**Evidence**
- Authentication first verifies with Supabase, then falls back to local JWT verification using `SUPABASE_JWT_SECRET` or `JWT_SECRET` if present.
- If secret management or rotation is inconsistent, locally accepted tokens may diverge from identity-provider session state.

**Why this matters**
- Can enable acceptance of stale/forged tokens in misconfigured environments.
- Creates two trust anchors (IdP + local secret) that must remain perfectly synchronized.

**Recommended remediation**
1. In production, enforce IdP introspection/verification as the only source of truth; disable local fallback unless a formally approved break-glass mode is enabled.
2. If fallback must remain, scope it to emergency mode with explicit feature flag, alerting, and short expiration windows.
3. Rotate JWT secrets through managed KMS/Vault, with dual-key validation windows and audit trails.
4. Add startup hard-fail in production when required identity verification dependencies are unavailable.

---

## 3) **High** — Data-in-transit controls are inconsistent across environments/services

**Evidence**
- Example environment uses `sslmode=disable` for Postgres local/dev connection strings.
- Production compose declares Kafka listeners as `PLAINTEXT` and Redis as password-protected but not TLS-enabled in this manifest.
- mTLS/TLS hardening exists in separate compose overlays, indicating encryption is optional rather than enforced baseline everywhere.

**Why this matters**
- Internal east-west traffic may be exposed in flat networks or compromised host scenarios.
- Compliance frameworks typically expect encryption in transit for sensitive/regulated data and credentials.

**Recommended remediation**
1. Define mandatory TLS baseline for all production service-to-service traffic (DB, Redis, Kafka, internal HTTP).
2. Enforce secure transport via policy-as-code checks in CI/CD (reject plaintext listeners in prod manifests).
3. Adopt mTLS between services (service mesh or reverse-proxy identity).
4. Keep non-TLS development defaults isolated to non-production profiles only, with clear guardrails.

---

## 4) **High** — Secrets management posture is mixed; some flows allow insecure operational states

**Evidence**
- Secret hydration is skipped in development by design, and secret watcher handles dynamic reload; this is good for operability but can create drift between environments.
- Cache encryption warns and generates non-persistent random keys if `CACHE_ENCRYPTION_KEY` is missing; encryption can be disabled via env flag.

**Why this matters**
- Non-persistent/random keys can break deterministic secret handling and incident forensics.
- Ability to disable encryption via environment toggles can violate production controls if not guarded.

**Recommended remediation**
1. Enforce production startup hard-fail when mandatory secret inputs (`CACHE_ENCRYPTION_KEY`, service keys, identity tokens) are absent.
2. Move all high-value secrets to KMS/Vault-backed retrieval with automatic rotation and immutable audit logs.
3. Restrict dangerous flags (e.g., disable-encryption switches) in production by compile-time/runtime policy checks.
4. Add drift detection between declared secret inventory and runtime loaded secrets.

---

## 5) **Medium** — API security/rate limiting is strong in key paths but uneven across the full surface

**Evidence**
- Tiered rate limiting is implemented with per-IP and per-user token bucket logic and health endpoint exclusions.
- Server mounts route protections inconsistently by route group (some use `createSecureRouter`, others rely on per-router middleware).

**Why this matters**
- Uneven middleware application can produce bypass opportunities as code evolves.
- Newly added endpoints may miss required controls (auth, CSRF, service identity, rate limits) if not standardized.

**Recommended remediation**
1. Mandate secure router factory for all state-changing/API routes by default.
2. Add automated route-security inventory test to assert required middleware chain on every route.
3. Add endpoint-specific anti-abuse controls for auth-sensitive flows (login, reset, verify) including IP/device heuristics and CAPTCHA/risk scoring where needed.

---

## 6) **Medium** — Compliance automation exists, but evidence quality and control attestations need hardening

**Evidence**
- SOC 2 evidence script exists and packages artifacts.
- Compliance script contains static or assumed statements (e.g., encryption/monitoring lines) that may not be runtime-verified controls.
- GDPR DSR utility exists for locate/export/anonymize workflows.

**Why this matters**
- Auditors require verifiable, source-backed evidence; static assertions reduce defensibility.
- HIPAA applicability requires explicit PHI data-flow mapping, BAA/vendor boundary controls, and minimum necessary safeguards.

**Recommended remediation**
1. Convert compliance script checks from declarative text to executable assertions (pull live config/API evidence).
2. Build a control matrix mapping SOC 2 CCs and GDPR articles to concrete technical controls/tests.
3. If HIPAA is in scope, add PHI classification, BAA inventory, access break-glass policy, and immutable access audit for PHI tables.
4. Implement data retention/deletion SLAs and prove them with scheduled evidence reports.

---

## 7) **Low** — Security documentation and runtime implementation are partially divergent

**Evidence**
- Security headers documentation includes some headers/policies not directly visible in runtime middleware implementation path.

**Why this matters**
- Drift between docs and implementation can mislead internal teams and auditors.

**Recommended remediation**
1. Generate security docs directly from live configuration/tests where possible.
2. Add doc-validation checks in CI to detect policy mismatch.
3. Keep a single source of truth for security header policy definitions.

---

## Positive Controls Observed

- Multi-layer HTTP security headers and CSP with production/development profiles.
- Service identity with timestamp+nonce replay protections.
- Tenant context and membership verification middleware.
- Route-level and tiered rate limiting with response headers and retry hints.
- RLS linting tests for tenant isolation expectations.
- Secret volume watcher for graceful secret reload/restart behavior.

---

## Recommended 30/60/90-Day Remediation Plan

### 0–30 days
- Ship redaction middleware for audit/request logging and cover with tests.
- Disable production JWT local fallback by default.
- Add CI policy checks rejecting plaintext transport configs in production manifests.

### 31–60 days
- Standardize all routers on a mandatory secure middleware chain with route inventory tests.
- Enforce production secret prerequisites with startup hard-fail and monitoring alerts.
- Upgrade compliance evidence collection to runtime-verified controls.

### 61–90 days
- Implement end-to-end mTLS for east-west traffic in production.
- Complete SOC2/GDPR control mapping and continuous evidence pipeline.
- If HIPAA applicable, complete PHI boundary mapping and HIPAA-specific technical/administrative safeguards.
