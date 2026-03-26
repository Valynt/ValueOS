# IDOR Audit — Mutating API Endpoints

**Last Updated:** 2026-05-24  
**Owner:** Security team  
**Review cadence:** Every sprint for new endpoints; full audit quarterly

---

## Purpose

Maps every mutating API endpoint (POST/PUT/PATCH/DELETE) to its authorization mechanism. An endpoint is production-ready only when it has at least one of:

- **RLS** — Supabase Row-Level Security policy enforced at the database layer
- **requirePermission** — RBAC permission check via `rbac.ts`
- **requireRole** — Role check via `rbac.ts`
- **requireOwnership** — Explicit ownership check via `requireOwnership` middleware
- **requirePolicy** — ABAC policy check via `requirePolicy`
- **Payload-scoped** — `tenantId`/`userId` from authenticated request threaded into all queries (no ambient context)

Endpoints marked **⚠️ GAP** have no application-layer authorization and must be remediated before production promotion.

---

## Authorization mechanism key

| Symbol | Meaning |
|---|---|
| ✅ RLS | Supabase RLS policy covers the table |
| ✅ RBAC | `requirePermission` or `requireRole` middleware present |
| ✅ Ownership | `requireOwnership` or explicit `.eq('user_id', userId)` / `.eq('tenant_id', tenantId)` in handler |
| ✅ ABAC | `requirePolicy` middleware present |
| ✅ Auth | `requireAuth` + tenant-scoped query (tenantId from req threaded into all DB calls) |
| ⚠️ GAP | No authorization mechanism — remediation required |
| 🔒 Admin-only | Requires admin role + permission; no user-level IDOR risk |

---

## Endpoint matrix

### Value Cases (`/api/value-cases`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/value-cases` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | tenantId from req |
| PATCH | `/api/value-cases/:id` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | tenantId scoped |
| DELETE | `/api/value-cases/:id` | ✅ Auth | ✅ RBAC (`requireRole(['admin'])`) + ✅ RLS | Admin-only |
| PATCH | `/api/value-cases/:id/status` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | |
| POST | `/api/value-cases/:id/kpi-targets` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | |
| POST | `/api/value-cases/:id/financial-models` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | |
| PATCH | `/api/value-cases/:id/financial-models/:modelId` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | |
| POST | `/api/value-cases/:id/checkpoints` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | |
| DELETE | `/api/value-cases/:id/checkpoints/:checkpointId` | ✅ Auth | ✅ RBAC (`requireRole(['admin','member'])`) + ✅ RLS | |

### Approvals (`/api/approvals`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/approvals/request` | ✅ Auth | ✅ RBAC (`requirePermission('approvals:create')`) + ✅ RLS | |
| POST | `/api/approvals/:requestId/approve` | ✅ Auth | ✅ RBAC (`requirePermission('approvals:manage')`) + ✅ RLS | |
| POST | `/api/approvals/:requestId/reject` | ✅ Auth | ✅ RBAC (`requirePermission('approvals:manage')`) + ✅ RLS | |
| DELETE | `/api/approvals/:requestId` | ✅ Auth | ✅ RBAC (`requirePermission('approvals:create')`) + ✅ RLS | Creator-only delete |

### Artifacts (`/api/artifacts`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/artifacts` | ✅ Auth | ✅ Auth + ✅ Ownership (tenantId + caseId from req) | Enqueues BullMQ job; tenantId from authenticated request |
| PATCH | `/api/artifacts/:id` | ✅ Auth | ✅ Auth + ✅ RLS | |

### Integrations (`/api/integrations`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/integrations` | ✅ Auth | ✅ RBAC (`requirePermission('integrations:manage')`) + ✅ RLS | |
| DELETE | `/api/integrations/:id` | ✅ Auth | ✅ RBAC (`requirePermission('integrations:manage')`) + ✅ RLS | |
| POST | `/api/integrations/:id/sync` | ✅ Auth | ✅ RBAC (`requirePermission('integrations:manage')`) + ✅ RLS | |
| POST | `/api/integrations/:id/disconnect` | ✅ Auth | ✅ RBAC (`requirePermission('integrations:manage')`) + ✅ RLS | |

### Teams (`/api/teams`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/teams` | ✅ Auth | ✅ RBAC (`requirePermission('users.read')`) + ✅ RLS | |
| PATCH | `/api/teams/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| DELETE | `/api/teams/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| DELETE | `/api/teams/:id/members/:userId` | ✅ Auth | ✅ RBAC + ✅ RLS | |

### Admin (`/api/admin`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/admin/users/invite` | ✅ Auth | ✅ RBAC (`requirePermission`) + 🔒 Admin-only | |
| POST | `/api/admin/users/:id/role` | ✅ Auth | ✅ RBAC + 🔒 Admin-only | |
| PATCH | `/api/admin/users/:id` | ✅ Auth | ✅ RBAC + 🔒 Admin-only | |
| DELETE | `/api/admin/users/:id` | ✅ Auth | ✅ RBAC + 🔒 Admin-only | |
| POST | `/api/admin/roles` | ✅ Auth | ✅ RBAC (`requireAllPermissions`) + 🔒 Admin-only | |

### Documents (`/api/documents`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/documents` | ✅ Auth | ✅ RBAC (`requirePermission('data.import')`) + ✅ RLS | Router-level permission |

### Workflow (`/api/workflow`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/workflows/execute` | ✅ Auth | ✅ RBAC (`requirePermission('agents:execute')`) + rate limit | Router-level auth + permission |
| POST | `/api/workflow/execute` | ✅ Auth | ✅ RBAC (`requirePermission('agents:execute')`) + rate limit | Alias route |

### Agents (`/api/agents`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/agents/execute` | ✅ Auth | ✅ RBAC + ✅ RLS + rate limit (strict) | tenantId from TCT |
| POST | `/api/agents/:agentId/run` | ✅ Auth | ✅ RBAC + ✅ RLS | |

### Value Drivers (`/api/value-drivers`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/value-drivers` | ✅ Auth | ✅ RBAC + ✅ RLS | tenantId scoped |
| PATCH | `/api/value-drivers/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| DELETE | `/api/value-drivers/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |

### Value Models (`/api/value-models`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/value-models` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| PATCH | `/api/value-models/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| DELETE | `/api/value-models/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |

### Initiatives (`/api/initiatives`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/initiatives` | ✅ Auth | ✅ Auth + ✅ RLS | tenantId from req |
| PATCH | `/api/initiatives/:id` | ✅ Auth | ✅ Auth + ✅ RLS | |
| DELETE | `/api/initiatives/:id` | ✅ Auth | ✅ Auth + ✅ RLS | |

### Value Commitments (`/api/value-commitments`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/value-commitments` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| PATCH | `/api/value-commitments/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| DELETE | `/api/value-commitments/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |

### Billing (`/api/billing`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/billing/subscriptions` | ✅ Auth | ✅ RBAC + ✅ RLS | Stripe-backed; tenantId scoped |
| POST | `/api/billing/plan-change` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| POST | `/api/billing/payment-methods` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| DELETE | `/api/billing/payment-methods/:id` | ✅ Auth | ✅ RBAC + ✅ RLS | |
| POST | `/api/billing/webhooks` | N/A | Stripe signature verification | Webhook; no user auth |

### Data Subject Requests (`/api/dsr`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/dsr` | ✅ Auth | ✅ RBAC + ✅ RLS | GDPR DSR; tenantId scoped |
| DELETE | `/api/dsr/:id` | ✅ Auth | ✅ RBAC + 🔒 Admin-only | |

### CRM (`/api/crm`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/crm/sync` | ✅ Auth | ✅ RBAC (`requirePermission('integrations:manage')`) | |
| POST | `/api/crm/oauth/callback` | ✅ Auth | ✅ Auth + state param validation | OAuth callback |

### Academy (`/api/academy`)

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/academy/quiz/:id/submit` | ✅ Auth | ✅ Auth + ✅ Ownership (`.eq('user_id', userId)`) | User-scoped |
| POST | `/api/academy/simulations` | ✅ Auth | ✅ Auth + ✅ Ownership | User-scoped |
| PATCH | `/api/academy/simulations/:id` | ✅ Auth | ✅ Auth + ✅ Ownership | |
| DELETE | `/api/academy/simulations/:id` | ✅ Auth | ✅ Auth + ✅ Ownership | |
| POST | `/api/academy/progress` | ✅ Auth | ✅ Auth + ✅ Ownership (`.eq('user_id', userId)`) | |

### Dev Routes (`/api/dev`) — non-production only

| Method | Path | Auth | Mechanism | Notes |
|---|---|---|---|---|
| POST | `/api/dev/seed` | ✅ Auth | `requireDevAdmin` + `shouldEnableDevRoutes()` guard | Disabled in production: `NODE_ENV=production` blocks registration |
| POST | `/api/dev/db/migrations/run` | ✅ Auth | `requireDevAdmin` + dev-only guard | |
| POST | `/api/dev/auth/dev-token` | ✅ Auth | `requireDevAdmin` + dev-only guard | |
| POST | `/api/dev/restart` | ✅ Auth | `requireDevAdmin` + dev-only guard | |
| POST | `/api/dev/clear-cache` | ✅ Auth | `requireDevAdmin` + dev-only guard | |

---

## Gap summary

**No unmitigated gaps found** in the current audit pass.

All mutating endpoints have at least one of: `requireAuth` + tenant-scoped queries, `requirePermission`, `requireRole`, or explicit ownership checks. Dev routes are disabled in production via `shouldEnableDevRoutes()` which requires both `NODE_ENV !== 'production'` AND `ENABLE_DEV_ROUTES === 'true'`.

---

## Remediation tracking

| Endpoint | Gap type | Owner | Status | Due |
|---|---|---|---|---|
| — | — | — | No open gaps | — |

---

## How to update this document

When adding a new mutating endpoint:
1. Add a row to the appropriate section above.
2. Confirm the authorization mechanism is in place before merging.
3. If RLS is the sole mechanism, verify the policy covers the table via `pnpm run test:rls`.
4. If no mechanism is present, mark as ⚠️ GAP and add a row to the Remediation tracking table.

This document is reviewed as part of the security gate on every PR that adds or modifies API routes (enforced by `scripts/ci/express-openapi-security-check.mjs`).
