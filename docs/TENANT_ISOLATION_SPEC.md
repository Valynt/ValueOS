# TENANT_ISOLATION_SPEC.md — ValueOS

> Last updated: auto-generated during tenant isolation hardening sprint.
> Status: **Enforced** — CI lint (`scripts/ci/tenant-isolation-lint.sh`) validates.

---

## 1. Threat Model

ValueOS is a multi-tenant SaaS platform where **one tenant must never see, modify, or infer the existence of another tenant's data**. The adversarial model assumes:

- A malicious tenant can craft arbitrary API requests.
- A compromised JWT may carry a foreign `organization_id`.
- Background jobs and agents run with elevated privileges.
- Redis is a shared resource (no per-tenant Redis instances).
- LLM context windows could leak cross-tenant training data.

---

## 2. Tenant Identity

| Key | Type | Scope | Status |
|---|---|---|---|
| `organization_id` | `UUID` | Canonical key for all new tables | **Active** |
| `tenant_id` | `TEXT` | Legacy key (Sep 2026 schema + BullMQ jobs) | **Transitioning** |

### Resolution Rules

1. User-facing API requests: `req.tenantId` (set by `tenantContextMiddleware`).
2. Worker jobs: `runJobWithTenantContext()` uses `AsyncLocalStorage` → `getTenantId()`.
3. Agent fabric: `BaseAgent.organizationId` (set at construction by `AgentFactory`).
4. RLS functions: `security.user_has_tenant_access(UUID)` and `security.user_has_tenant_access(TEXT)` — dual overloads.

---

## 3. Database Layer

### 3.1 Row-Level Security (RLS)

Every tenant-scoped table **must** have RLS enabled with policies that call
`security.user_has_tenant_access(organization_id)`.

**Verification:** `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT tablename FROM pg_policies GROUP BY tablename);` should return only system/lookup tables.

### 3.2 Repository Pattern

Repositories **must not** hold singleton Supabase clients. The approved patterns are:

| Context | Client factory | Example |
|---|---|---|
| HTTP request handler | `getRequestSupabaseClient(req)` | Routes, controllers |
| Background worker | `createWorkerServiceSupabaseClient({ justification })` | BullMQ processors |
| Agent fabric | `createWorkerServiceSupabaseClient({ justification })` | BaseAgent, lifecycle agents |
| Cron / system admin | `createCronSupabaseClient({ justification })` | Watchdog, reconciliation |
| Tenant provisioning | `createAuthProvisioningSupabaseClient({ justification })` | AuthService |

Repositories accept `SupabaseClient` via constructor injection:
```typescript
export class FooRepository {
  constructor(private readonly db: SupabaseClient) {}
}
```

### 3.3 Banned Patterns

| Pattern | Risk | Replacement |
|---|---|---|
| `import { supabase } from '../lib/supabase.js'` | Hard-fail proxy → runtime crash | Inject `SupabaseClient` via constructor |
| `createServerSupabaseClient()` | Deprecated, forwards to service_role | `createWorkerServiceSupabaseClient()` |
| `createServiceRoleSupabaseClient()` in repositories | Bypasses RLS silently | Inject client from caller |
| Module-level singleton `export const fooRepo = new FooRepo()` | Can't inject RLS client | Instantiate per-request |

### 3.4 company_* Tables Migration

Migration `20261007000000_company_tables_add_organization_id.sql` adds `organization_id UUID`
to all 8 `company_*` tables. Transition-period RLS policies accept either
`organization_id` or `tenant_id`. The legacy `tenant_id`-only policies will be
dropped after all application code is migrated.

---

## 4. Redis / Cache Layer

### 4.1 Key Namespacing

All Redis keys **must** include the tenant identifier:

| Subsystem | Key pattern | Status |
|---|---|---|
| CacheService | `tenant:{tid}:{namespace}:{key}` | ✅ Enforced |
| LLMCache | `tenant:{tid}:llm:{hash}` | ✅ Enforced |
| Rate limiters | `ratelimit:{tid}:{endpoint}` | ✅ Enforced |
| DLQ | `dlq:{tenantId}:agent_tasks` | ✅ Fixed this sprint |
| BullMQ jobs | Job payload contains `tenantId`; `runJobWithTenantContext()` sets ALS | ✅ Enforced |

### 4.2 Near-Cache (L1)

L1 near-cache uses `Map<string, CacheEntry>` keyed by the same tenant-prefixed
key, so cross-tenant pollution is prevented by key isolation.

---

## 5. Agent Fabric

### 5.1 Invocation Boundary

`secureInvoke()` is the **only** approved path for LLM calls. It:
1. Validates `organizationId` matches `context.organizationId` via `assertTenantContextMatch()`.
2. Records execution lineage (org-scoped).
3. Persists reasoning traces (org-scoped).
4. Runs hallucination detection.

Direct `llmGateway.complete()` is **forbidden** in production agents.

### 5.2 Memory Isolation

| Store | Isolation | Mechanism |
|---|---|---|
| `SupabaseSemanticStore` | ✅ | `organization_id` in all queries + `match_semantic_memory()` SECURITY DEFINER |
| `SupabaseVectorStore` | ✅ | `organization_id` in all queries + HNSW index |
| `MemorySystem` | ✅ | Delegates to org-scoped backends |

### 5.3 Tool Execution

Tools run inside `ToolRegistry.execute()` which receives a `ToolExecutionContext`
containing `organizationId`. Tools that access data must propagate this ID to
their DB queries.

---

## 6. Background Jobs

### 6.1 Tenant Context Propagation

BullMQ jobs carry `tenantId` in their payload. The `runJobWithTenantContext()`
wrapper sets `AsyncLocalStorage` so any downstream code can call `getTenantId()`.

### 6.2 Cross-Tenant System Jobs

Some jobs legitimately read across tenants:

| Job | Justification |
|---|---|
| `WorkflowWatchdogWorker` | Detects stuck workflows across all tenants; write path is per-row |
| `StripeReconciliationWorker` | Reconciles billing events from Stripe (external) |
| `AlertingRulesWorker` | Evaluates system-level alerting rules |

These jobs use `createWorkerServiceSupabaseClient()` with explicit
`justification` strings and their results are never exposed to users.

---

## 7. API Layer

### 7.1 Request Authentication Flow

```
Request → requireAuth → tenantContextMiddleware → route handler
                ↓                    ↓
          Verify JWT         Set req.tenantId
          Set req.user       from JWT claims
```

### 7.2 Defense-in-Depth

1. **RLS at DB layer** — prevents data leakage even if app code is buggy.
2. **Application-level `.eq('organization_id', orgId)`** — explicit filter in every query.
3. **`assertTenantContextMatch()`** — runtime check in agent fabric.
4. **CI lint** — static analysis catches regressions before merge.

---

## 8. CI Validation Checklist

Run `scripts/ci/tenant-isolation-lint.sh` which checks:

| # | Check | Severity |
|---|---|---|
| 1 | No broken `supabase` proxy imports in production code | **FAIL** |
| 2 | No `createServiceRoleSupabaseClient()` in repository files | WARN |
| 3 | DLQ keys are tenant-scoped (no global `dlq:agent_tasks`) | **FAIL** |
| 4 | All repository files with `.from()` queries include `organization_id`/`tenant_id` | **FAIL** |
| 5 | No obvious global Redis keys | WARN |
| 6 | No deprecated `createServerSupabaseClient` usage | WARN |

### Manual Audit Checks

- [ ] Run `pnpm run test:rls` — validates RLS policies against test fixtures.
- [ ] Review `SELECT tablename FROM pg_tables WHERE schemaname='public'` for tables without RLS.
- [ ] `grep -rn 'service_role' packages/` — audit every service_role usage has a justification comment.
- [ ] Verify BullMQ job payloads include `tenantId` for all job types.

---

## 9. Fixes Applied This Sprint

| # | Area | Fix | Files |
|---|---|---|---|
| 1 | Stub repos | Rewrote 6 repos from service_role singletons to injected `(db, orgId)` | ValueTreeNode, RoiModel, RoiModelCalculation, ValueCommit, ValueTreeLink, KpiTarget |
| 2 | Agent fabric | Migrated 3 agents from `createServerSupabaseClient` to `createWorkerServiceSupabaseClient` | FinancialModelingAgent, TargetAgent, RealizationAgent |
| 3 | Schema | Added `organization_id UUID` to 8 `company_*` tables with backfill + RLS | Migration 20261007000000 |
| 4 | DLQ | Scoped Redis keys to `dlq:{tenantId}:agent_tasks` | DeadLetterQueue.ts, admin.ts |
| 5 | Watchdog | Documented cross-tenant read as legitimate system job | WorkflowWatchdogWorker.ts |
| 6 | Broken repos | Converted 6 repos from proxy import to constructor-injected client | FinancialModelSnapshot, AgentExecutionLineage, IntegrityOutput, ReasoningTrace, ValueTree, ProjectRepository |
| 7 | Agent base | Added lazy-initialized repos with privileged client in BaseAgent | BaseAgent.ts |
| 8 | Route handlers | Migrated 3 route files to use `getRequestSupabaseClient(req)` | integrity.routes.ts, reasoningTraces.ts, backHalf.ts |
| 9 | Export service | Migrated to `createWorkerServiceSupabaseClient` + injected snapshot repo | PptxExportService.ts |
| 10 | IntegrityAgent | Replaced singleton import with inline privileged client + repo | IntegrityAgent.ts |
| 11 | CI | Created static analysis script | scripts/ci/tenant-isolation-lint.sh |

---

## 10. Remaining Technical Debt

The CI lint reveals ~60 files still importing the broken `supabase` proxy and ~30 files
using `createServerSupabaseClient`. These are tracked in the legacy surface manifest
(`config/legacy-surface-manifest.json`). Migration priority:

1. **P0 (pre-launch):** All repository files — done ✅
2. **P1 (sprint +1):** Service files that touch tenant data (billing, value, artifacts)
3. **P2 (sprint +2):** Observability/analytics services (read-only, lower risk)
4. **P3 (backlog):** Config/secrets (system-level, no tenant data)
