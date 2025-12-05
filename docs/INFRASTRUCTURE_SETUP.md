# Infrastructure & Security Setup Guide

**Last Updated:** December 5, 2025  
**Version:** 1.0.0

This guide consolidates the phase-based infrastructure/security checklists into a single reference. It is derived from:

- `PHASE1_INFRASTRUCTURE_CHECKLIST.md`
- `PHASE2_INFRASTRUCTURE_CHECKLIST.md`
- `PHASE3_INFRASTRUCTURE_CHECKLIST.md`

---

## 1. High-Level Checklist

- [ ] Gateway / Load Balancer security headers
- [ ] HSTS + HTTPS enforcement
- [ ] Auth rate limiting & CSRF
- [ ] Supabase Auth configuration + secure cookies
- [ ] MFA, password policy, breach check
- [ ] Basic RLS policies
- [ ] Service mesh & mTLS between services
- [ ] NetworkPolicies / Security Groups
- [ ] Service-to-service authentication
- [ ] Agent autonomy limits & approval gates
- [ ] Advanced RLS + ABAC
- [ ] Data retention (TTL jobs + archives)
- [ ] Audit logs immutability (WORM)
- [ ] Data classification, masking, encryption
- [ ] Verification tests & manual checks

---

## 2. Gateway / Load Balancer Security (Phase 1)

### 2.1 Security Headers

Apply **at the edge** (Nginx / Apache / Cloudflare / ALB):

- `Content-Security-Policy`
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

Key points:

- Only add `preload` to HSTS after submitting domain to https://hstspreload.org/
- CSP must allow Supabase and LLM endpoints in `connect-src`.

### 2.2 Auth Route Rate Limiting

- Apply stricter limits to `/auth/*` than general traffic.
- Examples provided for:
  - Nginx `limit_req` zones (`auth_zone` 5 rpm vs `general_zone` 60 rpm)
  - ALB + WAF / API Gateway
  - Cloudflare Workers using KV / Durable Objects for rate limiting

**Checklist:**

- [ ] Dedicated rate limit policy for `/auth/login`, `/auth/register`, `/auth/reset-password`
- [ ] 429 responses wired to monitoring/alerts

---

## 3. Supabase Auth & Session Security (Phase 1)

### 3.1 Session & Cookie Configuration

- Set in Supabase Auth settings:
  - JWT expiry: ~1h
  - Session idle timeout: ~30m
  - Refresh token rotation enabled

- Client config (`createClient`):
  - `persistSession: true`
  - `flowType: 'pkce'`
  - Custom storage backed by **secure HttpOnly cookies** via backend API.

- Server endpoints:
  - `/api/auth/session` POST → sets `sb-session` cookie with:
    - `HttpOnly`, `Secure`, `SameSite=Strict`, `maxAge` ~1h
  - `/api/auth/session` DELETE → clears cookie

### 3.2 Password Policy & MFA

- Enforce strong password policy via DB function or edge function:
  - Length ≥ 12
  - Uppercase, lowercase, number, special
- MFA (Supabase dashboard): enable TOTP, optionally SMS.
- Lockout table `auth.login_attempts` + `check_account_lockout()` function.
- Password breach check edge function using HaveIBeenPwned (k-anonymity).

### 3.3 Baseline RLS Policies

- Enable RLS on core tables (e.g. `cases`, `workflows`, `messages`).
- Apply **CRUD policies** with `auth.uid()` ownership checks.

---

## 4. Auth Router Integration (Phase 1)

- Dedicated Express router under `/auth` with:
  - Rate limiter middleware for auth endpoints
  - CSRF protection middleware
  - Login: lockout check + breach check + logging to `login_attempts`
  - Register: password strength + breach check
  - Logout: clears `sb-session` cookie + Supabase sign-out

- Mount router in main server (`app.use('/auth', authRouter)`).

**Verification:**

- [ ] Login/register enforce password policy
- [ ] Weak/breached passwords rejected
- [ ] CSRF attempts fail (403)
- [ ] Session cookie is HttpOnly + Secure + SameSite=Strict

---

## 5. Service Mesh & mTLS (Phase 2)

### 5.1 SPIFFE / SPIRE (Workload Identity)

- SPIRE server & agents deployed in `spire` namespace.
- Trust domain configured (e.g. `valuecanvas.example.com`).
- Agents run as DaemonSet exposing `/run/spire/sockets`.

Purpose:
- Strong workload identity for mTLS & authz.

### 5.2 Service Mesh (Istio Recommended)

- Install Istio with default profile.
- Label app namespaces for sidecar injection.
- Configure global `PeerAuthentication` with `mtls.mode: STRICT`.

### 5.3 Authorization & Egress Policies

- AuthorizationPolicy:
  - Default deny; explicit allow for frontend → API, API → DB.
- ServiceEntry + Sidecar config:
  - Allow egress only to approved external hosts: `api.together.xyz`, `api.openai.com`, etc.
  - Use `outboundTrafficPolicy.mode: REGISTRY_ONLY`.

**Verification:**

- [ ] Requests without sidecar certs fail
- [ ] Only explicitly allowed service-to-service flows succeed
- [ ] Egress limited to whitelisted domains/ports

---

## 6. Network Policies & Security Groups (Phase 2)

### 6.1 Kubernetes NetworkPolicies

- Global `default-deny-all` in each namespace.
- Explicit policies:
  - `allow-frontend-to-api` on port 3000
  - `allow-api-to-db` on port 5432
  - `allow-api-egress` (HTTPS + DNS only)

### 6.2 Cloud Provider Security Groups (AWS Example)

- Separate SGs for frontend, API, DB.
- Allow rules:
  - Frontend → API (TCP 3000)
  - API → DB (TCP 5432)
  - API → Internet (TCP 443) for LLM APIs only (ideally tightened via proxies).

**Verification:**

- [ ] Frontend pods cannot connect directly to DB
- [ ] Random pods cannot reach API/DB without matching labels/SGs

---

## 7. Service-to-Service Authentication (Phase 2)

### 7.1 Signed Internal Requests

- All internal HTTP calls include signed identity headers:
  - `X-Service-Identity`
  - `X-Service-Nonce`
  - `X-Service-Timestamp`
  - `X-Service-Signature`

- `addServiceIdentityHeader()` used at call sites.
- `serviceIdentityMiddleware` applied to all `/internal/*` endpoints.

### 7.2 Nonce & Clock Skew

- Nonce store (Redis recommended) to prevent replay.
- Clock skew tolerance ~2 minutes.

**Verification:**

- [ ] Internal calls without headers → 401
- [ ] Replayed timestamps/nonce rejected

---

## 8. Agent Autonomy & Approval Gates (Phase 2)

### 8.1 Autonomy Configuration

- `autonomyConfig` defines per-agent:
  - Autonomy level (`low|medium|high`)
  - Max cost, max duration
  - Per-action approval requirements (high-cost, destructive, data export)

- Global limits:
  - Max total cost per hour
  - Max concurrent agents
  - Always-approval actions (e.g. `DELETE_USER`, `EXPORT_ALL_DATA`).

### 8.2 Enforcement in BaseAgent

- BaseAgent checks:
  - Approval required? Queue `approval_requests` row + notify admins.
  - Cost/duration over limits → reject.

### 8.3 Approval UI & API

- React `ApprovalRequest` component supports:
  - Dual control for high-cost actions (> threshold)
- Express `/api/approvals/:id/approve` and `/reject` endpoints update:
  - `approval_requests` (status)
  - `approvals` table (audit trail)

**Verification:**

- [ ] High-cost/destructive actions create approval requests
- [ ] Dual control required for configured actions
- [ ] Approved tasks execute only after approval

---

## 9. Advanced RLS & ABAC (Phase 3)

### 9.1 RLS on All Tables

- RLS enabled for:
  - `cases`, `workflows`, `messages`, `agent_executions`, `sdui_layouts`,
  - `user_sessions`, `approval_requests`, `audit_logs`, `data_exports`, etc.

### 9.2 Role-Based Policies

- Roles stored in JWT / metadata: `admin`, `manager`, `analyst`, `viewer`.
- Examples:
  - Admin: full access `FOR ALL` on key tables.
  - Manager: department-scoped access via `user_departments`.
  - Analyst: own records only.
  - Viewer: assigned records only.
- Audit logs: read-only, immutable (no UPDATE/DELETE).

### 9.3 ABAC (Attribute-Based Access Control)

- `user_attributes` table (key/value with expiry) + `has_attribute(key, value)` function.
- Policies using attributes:
  - Clearance level vs `metadata->'sensitivity_level'`.
  - Region access vs `metadata->'region'`.

**Verification:**

- [ ] Non-privileged roles cannot see other users’ data
- [ ] Attribute changes correctly affect access

---

## 10. Data Retention & TTL (Phase 3)

### 10.1 Retention Policies

- `retention_policies` table with per-table:
  - `retention_days`
  - `date_column`
  - `archive_before_delete`, `archive_table`

Typical defaults:

- `user_sessions`: 90 days
- `messages`: 2 years → archive
- `agent_executions`: 1 year → archive
- `audit_logs`: 7 years → archive
- `sdui_layouts`: 6 months
- `data_exports`: 30 days

### 10.2 Archive Tables

- `*_archive` tables created `LIKE` originals + `archived_at`.

### 10.3 TTL Function & Scheduling

- `cleanup_expired_data()` function:
  - For each enabled policy:
    - Optionally archive
    - Delete expired rows
    - Update `last_run_at`

- Scheduling:
  - `pg_cron` job daily at 02:00, or
  - Supabase edge function + external cron.

**Verification:**

- [ ] Old data moved to archives or deleted as per policy
- [ ] `retention_policies.last_run_at` updates

---

## 11. Audit Log Immutability & WORM (Phase 3)

### 11.1 Append-Only Audit Logs

- `insert_audit_log(...)` RPC is the **only** way to write.
- RLS + triggers enforce:
  - No UPDATE/DELETE on `audit_logs`
  - INSERT only via secure function

### 11.2 Optional S3 WORM Export

- S3 bucket with Object Lock (COMPLIANCE, 7 years).
- Periodic export of last 24h of logs to S3 with retention lock.

**Verification:**

- [ ] Any UPDATE/DELETE on `audit_logs` fails with error
- [ ] S3 objects locked and not mutable/deletable before retention expiry

---

## 12. Data Classification, Masking & Encryption (Phase 3)

### 12.1 Classification

- `sensitivity_level` enum (`public`, `internal`, `confidential`, `restricted`).
- Columns like `cases.sensitivity`, `messages.sensitivity`, `user_data.sensitivity`.
- Initial classification based on metadata flags.

### 12.2 Masking & Masked Views

- DB functions: `mask_email`, `mask_phone`, `mask_credit_card`, `mask_ssn`, `redact_field`.
- Masked views:
  - `cases_masked` for analysts (no raw PII / reduced metadata).
  - `cases_public` for anon (only public cases, truncated description).

### 12.3 Field-Level Encryption

- `pgcrypto` installed.
- `encrypt_sensitive_field` / `decrypt_sensitive_field` functions using app-level key (`app.encryption_key` GUC / secrets manager).
- Only admins can decrypt; non-admins see `[ENCRYPTED]`.

### 12.4 Application-Level Masking

- `autoMask` utility for masking PII in API responses for non-admins.

**Verification:**

- [ ] Non-admins always see masked PII
- [ ] Encrypted columns stored as ciphertext
- [ ] Decrypt RPC works only for admin role

---

## 13. Verification & Deployment Checklist

### 13.1 Testing

- [ ] Unit tests for security middleware, service identity, autonomy, masking
- [ ] Integration tests for auth flows, approvals, RLS
- [ ] Manual curl/SQL checks from Phase 1–3 docs executed and documented

### 13.2 Production Readiness

- [ ] All three phases’ deployment checklists satisfied
- [ ] Monitoring & alerts in place for:
  - Auth failures & rate limits
  - mTLS / mesh issues
  - TTL job failures
  - Audit export failures
- [ ] Security + compliance sign-off recorded

---

**Owners:**

- Gateway / Network: DevOps / Infrastructure
- Auth / Sessions / RLS: Backend + DBA
- Service Mesh / Identity: Platform / SRE
- Data Governance / Retention / Masking: DBA + Security + Compliance

**Next Review:** January 2026
