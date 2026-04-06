# TENANT_ISOLATION_SPEC.md — ValueOS

> Last updated: adversarial audit — full-stack tenant isolation review.
> Status: **Enforced** — CI lint (`scripts/ci/tenant-isolation-lint.sh`) validates.

---

## 1. Threat Model

ValueOS is a multi-tenant SaaS platform where **one tenant must never see, modify, or infer the existence of another tenant's data**. The adversarial model assumes:

- A malicious tenant can craft arbitrary API requests.
- A compromised JWT may carry a foreign `organization_id`.
- Background jobs and agents run with elevated privileges.
- Redis is a shared resource (no per-tenant Redis instances).
- LLM context windows could leak cross-tenant data.
- A tenant can enumerate or poison shared cache entries.
- A tenant can trigger background jobs that run without tenant context.

---

## 2. Tenant Identity

| Key | Type | Scope | Status |
|---|---|---|---|
| `organization_id` | `UUID` | Canonical key for all new tables | **Active** |
| `tenant_id` | `TEXT` | Legacy key (pre-2026 schema + BullMQ jobs) | **Transitioning** |

### Resolution Rules

1. **HTTP requests**: `req.tenantId` set by `tenantContextMiddleware` — 4-source resolution chain (TCT JWT → service header → user claim → DB lookup). Route parameters are explicitly excluded as a resolution source.
2. **Worker jobs**: `runJobWithTenantContext()` uses `AsyncLocalStorage` → `getTenantId()`.
3. **Agent fabric**: `BaseAgent.organizationId` set at construction by `AgentFactory`.
4. **RLS functions**: `security.user_has_tenant_access(UUID)` and `security.user_has_tenant_access(TEXT)` — dual overloads.

---

## 3. Database Layer

### 3.1 Row-Level Security (RLS)

Every tenant-scoped table **must** have RLS enabled with policies that call
`security.user_has_tenant_access(organization_id)`.

**Verification query** (should return only system/lookup tables):
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_policies GROUP BY tablename
  );
```

### 3.2 RLS Policy Pattern Standards

**Approved pattern** — uses the canonical `security.user_has_tenant_access()` SECURITY DEFINER function:
```sql
CREATE POLICY foo_tenant_isolation ON public.foo
  FOR ALL TO authenticated
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));
```

**Unsafe pattern** — inline subquery with `LIMIT 1` (present in `20261008000000_sprint1_rls_hardening.sql` for 4 tables: `scenarios`, `sensitivity_analysis`, `promise_baselines`, `promise_kpi_targets`):
```sql
-- UNSAFE: LIMIT 1 is non-deterministic for users in multiple orgs
USING (organization_id = (
  SELECT organization_id FROM public.user_tenants
  WHERE user_id = auth.uid() LIMIT 1
))
```

**Fix** — migrate these 4 tables to the canonical helper:
```sql
-- Migration: fix_sprint1_rls_subquery_policies.sql
ALTER POLICY scenarios_tenant_isolation ON public.scenarios
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

ALTER POLICY sensitivity_analysis_tenant_isolation ON public.sensitivity_analysis
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

ALTER POLICY promise_baselines_tenant_isolation ON public.promise_baselines
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

ALTER POLICY promise_kpi_targets_tenant_isolation ON public.promise_kpi_targets
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));
```

### 3.3 Repository Pattern

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

### 3.4 Banned Patterns

| Pattern | Risk | Replacement |
|---|---|---|
| `import { supabase } from '../lib/supabase.js'` | Singleton proxy — bypasses RLS | Inject `SupabaseClient` via constructor |
| `createServerSupabaseClient()` | Deprecated, forwards to service_role | `createWorkerServiceSupabaseClient()` |
| `createServiceRoleSupabaseClient()` in repositories | Bypasses RLS silently | Inject client from caller |
| Module-level singleton `export const fooRepo = new FooRepo()` | Cannot inject RLS client | Instantiate per-request |
| Inline `LIMIT 1` subquery in RLS policy | Non-deterministic for multi-org users | `security.user_has_tenant_access()` |

### 3.5 `search_semantic_memory` RPC — Critical Fix Applied

`VectorSearchService.searchByEmbedding()` called `supabase.rpc("search_semantic_memory")` with a `filter_clause` string that optionally included `organization_id`. The RPC did not exist in migrations — only `match_semantic_memory` (with mandatory `p_organization_id`) and `search_semantic_memory_filtered` existed.

**Fix applied** (migration `20261009000000_add_search_semantic_memory_rpc.sql`):
- Created `search_semantic_memory(query_embedding, p_organization_id, ...)` with `p_organization_id uuid` as a **mandatory** parameter.
- Updated `VectorSearchService.searchByEmbedding()` to extract `organization_id` from filters and throw if absent.
- `searchWithTenant()` remains the approved production path — it always passes `tenantId` explicitly.

### 3.6 `company_*` Tables Migration

Migration `20261007000000_company_tables_add_organization_id.sql` adds `organization_id UUID`
to all 8 `company_*` tables. Transition-period RLS policies accept either
`organization_id` or `tenant_id`. The legacy `tenant_id`-only policies will be
dropped after all application code is migrated.

---

## 4. Redis / Cache Layer

### 4.1 Key Namespacing Standard

All Redis keys **must** include the tenant identifier as the first segment:

```
{tenant_id}:{service}:{resource}:{hash_or_id}
```

| Subsystem | Key pattern | Status |
|---|---|---|
| `CacheService` | `tenant:{tid}:{namespace}:v{n}:{key}` | Enforced — throws `MissingTenantContextError` if `tid` absent |
| `LLMCache` | `llm:cache:{tenantId}:{model}:{sha256[0:16]}` | Enforced — throws if `tenantId` absent |
| `ReadThroughCacheService` | `tenant:{tid}:read-cache:{endpoint}:{scope}:{hash}` | Enforced via `tenantReadCacheKey()` |
| `TenantCache` | `tenant:{tid}:{resource}:{id}` | Enforced — `assertTenantScopedKey()` validates prefix |
| Rate limiters | `ratelimit:{service}:{tier}:{tenantId}:{resource}` | Enforced via `RateLimitKeyService` |
| `UsageCache` | `usage:{tenantId}:{metric}` | Enforced |
| `GroundTruthCache` / `BenchmarkRetrievalService` | `tenant:{tenantId}:benchmark:{industry}:{kpi}` | **Fixed this audit** |
| `SDUICacheService` head pointers | `sdui:head:{tenantId}:{workspaceId}` | **Fixed this audit** |
| `SDUICacheService` CAS entries | `sdui:cas:{hash}` | Safe — content-addressed, no tenant data in value |

### 4.2 Previously Unsafe Patterns — Fixed

**`BenchmarkRetrievalService.buildCacheKey()`** previously produced:
```
benchmark:{industry}:{kpi}:{companySize}
```
This is a global key — all tenants shared the same benchmark cache entry. A tenant could poison benchmark data for all other tenants.

**Fix applied** (`BenchmarkRetrievalService.ts`):
```typescript
// Before (unsafe — global key):
private buildCacheKey(query: BenchmarkQuery): string {
  const parts = ["benchmark", query.industry, query.kpi ?? "unknown"];
  return parts.join(":");
}

// After (tenant-scoped):
private buildCacheKey(query: BenchmarkQuery): string {
  const tenantPrefix = query.tenantId ? `tenant:${query.tenantId}:` : "global:";
  const parts = [`${tenantPrefix}benchmark`, query.industry, query.kpi ?? "unknown"];
  return parts.join(":");
}
```

**`SDUICacheService.headKey()`** previously produced:
```
sdui:head:{workspaceId}
```
`workspaceId` values are not globally unique — two tenants could have the same workspace ID, causing one tenant's schema head pointer to overwrite another's.

**Fix applied** (`SDUICacheService.ts`):
```typescript
// Before (unsafe — workspaceId not globally unique):
function headKey(workspaceId: string): string {
  return `sdui:head:${workspaceId}`;
}

// After (tenant-scoped):
function headKey(tenantId: string, workspaceId: string): string {
  return `sdui:head:${tenantId}:${workspaceId}`;
}
```

### 4.3 Near-Cache (L1)

L1 near-cache uses `Map<string, CacheEntry>` keyed by the same tenant-prefixed
key, so cross-tenant pollution is prevented by key isolation.

---

## 5. Agent Fabric

### 5.1 Invocation Boundary

`secureInvoke()` is the **only** approved path for LLM calls from agents. It:
1. Validates `organizationId` matches `context.organization_id` via `assertTenantContextMatch()`.
2. Injects `tenantId: this.organizationId` into every `LLMRequest.metadata`.
3. Records execution lineage (org-scoped).
4. Persists reasoning traces (org-scoped).
5. Runs hallucination detection.

`secureLLMComplete()` is the approved path for non-agent service/worker LLM calls. It:
1. Requires `organizationId` or `tenantId` in options — throws if absent.
2. Rejects conflicting `organizationId` vs `tenantId` values.
3. Sanitizes prompts for PII before forwarding to `LLMGateway`.

`LLMGateway.complete()` enforces tenant presence at the gateway level — throws if no tenant identifier is present in `request.metadata`.

Direct `llmGateway.complete()` calls outside `BaseAgent` and `secureLLMComplete` are **forbidden** and caught by `scripts/ci/check-direct-llm-calls.mjs`.

### 5.2 Memory Isolation

| Store | Isolation | Mechanism |
|---|---|---|
| `SupabaseSemanticStore` | Enforced | `organization_id` in all queries + `match_semantic_memory()` SECURITY DEFINER |
| `SupabaseVectorStore` | Enforced | `organization_id` in all queries + HNSW index |
| `MemorySystem` (in-process) | Enforced | Index key: `{agent_id}:{organization_id}:{memory_type}` |
| `SupabaseMemoryBackend` | Enforced | Throws if `organization_id` absent; cross-workspace reads require agent allowlist + reason |
| Cross-workspace reads | Allowlisted | `CROSS_WORKSPACE_ALLOWED_AGENTS` (only `compliance-auditor`); requires `cross_workspace_reason` |

### 5.3 Tool Execution

Tools run inside `ToolRegistry.execute()` which receives a `ToolExecutionContext`
containing `tenantId`. Tools that access data must propagate this ID to their DB queries.
The `authorizationPolicyGateway.authorize()` call receives `tenantId` for policy evaluation.

---

## 6. Background Jobs

### 6.1 Tenant Context Propagation

BullMQ jobs carry `tenantId` in their payload. The `runJobWithTenantContext()`
wrapper sets `AsyncLocalStorage` so any downstream code can call `getTenantId()`.

**All tenant-aware workers must wrap their handler in `runJobWithTenantContext()`.**

### 6.2 Worker Compliance Matrix

| Worker | `tenantId` in payload | `runJobWithTenantContext()` | Status |
|---|---|---|---|
| `ArtifactGenerationWorker` | Yes | Yes | Compliant |
| `CertificateGenerationWorker` | Yes | Yes | Compliant |
| `WebhookRetryWorker` | Yes | Yes | Compliant |
| `researchWorker` | Yes | Yes | Compliant |
| `crmWorker` | Yes | Yes (`tenantContextStorage.run`) | Compliant |
| `UsageQueueConsumerWorker` | Yes | Yes | Compliant |
| `mcpIntegrationWorker` | Yes | Yes — **Fixed this audit** | Compliant |
| `WorkflowWatchdogWorker` | N/A (cross-tenant system job) | N/A | Documented exception |
| `StripeReconciliationWorker` | N/A (external billing) | N/A | Documented exception |
| `AlertingRulesWorker` | N/A (cross-tenant system job) | N/A | Documented exception |
| `billingAggregatorWorker` | N/A (delegates to `UsageQueueConsumerWorker`) | N/A | Compliant via delegate |

### 6.3 `mcpIntegrationWorker` — Critical Fix Applied

Both `validationWorker` and `syncWorker` extracted `tenantId` from the job payload and passed it to downstream functions, but never called `runJobWithTenantContext()`. `AsyncLocalStorage` was never populated — any code calling `getTenantId()` downstream would receive `undefined`.

**Fix applied** (`mcpIntegrationWorker.ts`):
```typescript
// Before (unsafe — ALS never set):
async (job: Job<McpQueuePayload>) => {
  const { tenantId } = job.data;
  const metadata = await loadIntegrationMetadata(tenantId, integrationId);
  // ...
}

// After (ALS established for all downstream code):
async (job: Job<McpQueuePayload>) => {
  const { tenantId } = job.data;
  return runJobWithTenantContext(
    { tenantId, workerName: "McpIntegrationWorker.validation" },
    async () => {
      const metadata = await loadIntegrationMetadata(tenantId, integrationId);
      // ...
    }
  );
}
```

### 6.4 Cross-Tenant System Jobs

Some jobs legitimately read across tenants:

| Job | Justification |
|---|---|
| `WorkflowWatchdogWorker` | Detects stuck workflows across all tenants; write path is per-row |
| `StripeReconciliationWorker` | Reconciles billing events from Stripe (external) |
| `AlertingRulesWorker` | Evaluates system-level alerting rules |

These jobs use `createWorkerServiceSupabaseClient()` with explicit `justification` strings and their results are never exposed to users.

---

## 7. API Layer

### 7.1 Request Authentication Flow

```
Request → requireAuth → tenantContextMiddleware → route handler
                |                    |
          Verify JWT         Set req.tenantId
          Set req.user       from JWT claims
```

### 7.2 Tenant Resolution Priority

1. **TCT JWT** (`x-tenant-context` header) — cryptographically verified HS256
2. **Service header** (`x-tenant-id`) — only when `serviceIdentityVerified=true`
3. **User JWT claim** (`tenant_id` / `organization_id` canonicalized via DB lookup)
4. **DB lookup** — only when JWT has no tenant claim (logs a warning)

Route parameters are **not** a resolution source — they are user-controlled input.

### 7.3 Defense-in-Depth

1. **RLS at DB layer** — prevents data leakage even if app code is buggy.
2. **Application-level `.eq('organization_id', orgId)`** — explicit filter in every query.
3. **`assertTenantContextMatch()`** — runtime check in agent fabric and workflow executor.
4. **CI lint** — static analysis catches regressions before merge.
5. **`MissingTenantContextError`** — thrown by `ns()` / `getRedisKey()` if tenant absent.

---

## 8. LLM + Tool Calls

### 8.1 Tenant Injection Chain

```
HTTP request
  → tenantContextMiddleware (sets req.tenantId)
  → route handler
  → AgentFactory.create(agentType, organizationId)   <- tenant bound at construction
  → BaseAgent.execute(context)
  → assertTenantContextMatch(organizationId, context.organization_id)
  → BaseAgent.secureInvoke(sessionId, prompt, schema)
  → LLMRequest.metadata.tenantId = this.organizationId  <- injected here
  → LLMGateway.complete(request)
  → throws if metadata.tenantId absent
```

### 8.2 Prompt Injection Protection

`HardenedAgentRunner` → `AgentSafetyLayer` scans every prompt for injection patterns before the LLM call:

| Pattern ID | Severity | Example |
|---|---|---|
| `role_override` | HIGH | "ignore all previous instructions" |
| `jailbreak_dan` | HIGH | "DAN mode", "do anything now" |
| `exfiltrate_env` | HIGH | "print all environment variables" |
| `exfiltrate_system` | HIGH | "reveal system prompt", "devcontainer" |
| `indirect_injection_marker` | HIGH | `<inject>`, `<cmd>` |
| `delimiter_abuse` | MEDIUM | `[INST]`, `<\|im_start\|>` |
| `base64_instruction` | MEDIUM | "base64 decode instruction" |
| `persona_switch` | MEDIUM | "act as", "pretend you are" |

HIGH signals **block** execution. MEDIUM signals sanitize and continue.

### 8.3 Cross-Tenant Prompt Leakage Prevention

- `sanitizeForAgent()` redacts PII and secret fields from `LifecycleContext` before prompt injection.
- `BaseAgent.secureInvoke()` spreads `sanitizedContext` first, then overrides with explicit named fields — caller-supplied values cannot override `tenantId`.
- Memory retrieval in `secureInvoke` is always scoped to `this.organizationId`.
- Reasoning traces and execution lineage are written with `organization_id = this.organizationId`.

---

## 9. Remaining Technical Debt

### P0 — Fix before next release

| # | Area | Issue | File | Fix |
|---|---|---|---|---|
| 1 | DB | 4 RLS policies use `LIMIT 1` subquery instead of `security.user_has_tenant_access()` | `20261008000000_sprint1_rls_hardening.sql` | New migration to `ALTER POLICY` on `scenarios`, `sensitivity_analysis`, `promise_baselines`, `promise_kpi_targets` |
| 2 | Services | `ArtifactGeneratorService`, `ArtifactEditService`, `UIGenerationTracker`, `WorkflowDAGDefinitions`, `WorkflowDAGIntegration`, `PromiseBaselineService`, `DiffExplainabilityService` import `supabase` singleton | Multiple files in `services/` | Migrate to constructor-injected client |
| 3 | Services | `VectorSearchService` imports `supabase` singleton (not privileged client) | `services/memory/VectorSearchService.ts` | Inject `SupabaseClient` via constructor |
| 4 | Services | `SecretAuditLogger` uses `createServerSupabaseClient()` | `config/secrets/SecretAuditLogger.ts` | Migrate to `createWorkerServiceSupabaseClient()` |

### P1 — Fix within 2 sprints

| # | Area | Issue | File |
|---|---|---|---|
| 5 | DB | `roles` table has `USING (true)` for `authenticated` — acceptable for a global lookup table but should be documented in `rls-coverage-audit.md` as `public_read` with explicit justification | `20260213000007_teams_roles_tables.sql` |
| 6 | Cache | `GroundTruthCache.get/set` accept arbitrary string keys — callers must ensure tenant prefix; no structural enforcement | `GroundTruthCache.ts` |
| 7 | Jobs | `check-queue-tenant-bootstrap.mjs` does not include `mcpIntegrationWorker.ts` in its scan list | `scripts/ci/check-queue-tenant-bootstrap.mjs` |

### P2 — Backlog

| # | Area | Issue |
|---|---|---|
| 8 | Legacy surface | ~60 files still importing the broken `supabase` proxy; ~30 using `createServerSupabaseClient` — tracked in `config/legacy-surface-manifest.json` |
| 9 | SDUI | `CanvasSchemaCache` and `CanvasSchemaService` call `setHead`/`getHead` without passing `tenantId` — will use `"unknown"` prefix until callers are updated |

---

## 10. CI Validation Checklist

### Automated (run on every PR)

Run `scripts/ci/tenant-isolation-lint.sh` which checks:

| # | Check | Severity | Script |
|---|---|---|---|
| 1 | No broken `supabase` proxy imports in S1-01 target files | FAIL | `tenant-isolation-lint.sh` |
| 2 | No `createServiceRoleSupabaseClient()` in repository files | WARN | `tenant-isolation-lint.sh` |
| 3 | DLQ keys are tenant-scoped (no global `dlq:agent_tasks`) | FAIL | `tenant-isolation-lint.sh` |
| 4 | All repository files with `.from()` queries include `organization_id`/`tenant_id` | FAIL | `tenant-isolation-lint.sh` |
| 5 | No obvious global Redis keys | WARN | `tenant-isolation-lint.sh` |
| 6 | No deprecated `createServerSupabaseClient` in S1-02 target files | FAIL | `tenant-isolation-lint.sh` |
| 7 | No direct `llmGateway.complete()` calls outside approved files | FAIL | `check-direct-llm-calls.mjs` |
| 8 | All tenant-aware queue handlers call `runJobWithTenantContext()` | FAIL | `check-queue-tenant-bootstrap.mjs` |
| 9 | New migrations have `ENABLE ROW LEVEL SECURITY` + `organization_id UUID NOT NULL` | FAIL | `check-migration-rls-required.sh` |
| 10 | No `USING (true)` policies for `authenticated` role in new migrations | FAIL | `check-permissive-rls.sh` |
| 11 | No JWT-claim-only tenant predicates in new migrations | FAIL | `check-supabase-tenant-controls.mjs` |

### Manual Audit Checks (run before each release)

```bash
# 1. RLS policy validation against test fixtures
pnpm run test:rls

# 2. Tables without RLS (should return only system/lookup tables)
psql -c "SELECT tablename FROM pg_tables WHERE schemaname='public'
         AND tablename NOT IN (SELECT tablename FROM pg_policies GROUP BY tablename);"

# 3. Audit every service_role usage — each must have a justification comment
grep -rn 'service_role' packages/ | grep -v 'justification\|__tests__\|\.test\.'

# 4. Verify BullMQ job payloads include tenantId for all job types
grep -rn 'new Queue\|\.add(' packages/backend/src --include="*.ts" | grep -v 'tenantId\|tenant_id'

# 5. Verify no global Redis keys (keys without tenant: prefix)
grep -rn '\.set\s*(' packages/backend/src --include="*.ts" \
  | grep -v 'tenant:\|{.*tenantId\|{.*tid\|__tests__\|\.test\.'

# 6. Verify all vector search calls pass organization_id
grep -rn 'searchByEmbedding\|vectorSearch\|hybridSearch' packages/backend/src --include="*.ts" \
  | grep -v '__tests__\|\.test\.'

# 7. Verify agent factory always receives organizationId
grep -rn 'AgentFactory\|agentFactory\.create\|createForStage' packages/backend/src --include="*.ts" \
  | grep -v '__tests__\|\.test\.'
```

### Adversarial Test Scenarios

These must be covered by `pnpm run test:rls` and integration tests:

| Scenario | Expected result |
|---|---|
| Tenant A queries `value_cases` with Tenant B's `organization_id` in JWT | 0 rows returned (RLS blocks) |
| Tenant A calls vector search without `organization_id` in filters | `Error: organization_id is required` thrown |
| Tenant A reads `sdui:head:{tenantB_id}:{workspaceId}` from Redis | Key does not exist (different prefix) |
| Tenant A enqueues a job with `tenantId: tenantB_id` | Job runs in Tenant B's ALS context — blocked by `assertTenantContextMatch` in agent |
| Tenant A injects "ignore all previous instructions" into a prompt | `AgentSafetyLayer` blocks with `SAFETY_BLOCKED` |
| Tenant A calls `MemorySystem.retrieve()` without `organization_id` | `Error: organization_id is required` thrown |
| Tenant A calls `LLMGateway.complete()` without tenant metadata | `Error: LLMGateway.complete requires tenant metadata` thrown |
| Tenant A calls `ns(null, 'key')` | `MissingTenantContextError` thrown |
| Tenant A calls `BenchmarkRetrievalService.retrieveBenchmark()` without `tenantId` | Cache key uses `global:` prefix — isolated from tenant-scoped entries |

---

## 11. Fixes Applied This Audit

| # | Area | Severity | Fix | Files |
|---|---|---|---|---|
| 1 | DB / Vector | CRITICAL | Created `search_semantic_memory` RPC with mandatory `p_organization_id` parameter; updated `VectorSearchService.searchByEmbedding()` to require `organization_id` in filters | `20261009000000_add_search_semantic_memory_rpc.sql`, `VectorSearchService.ts` |
| 2 | Redis / Cache | HIGH | `BenchmarkRetrievalService.buildCacheKey()` now prefixes with `tenant:{tenantId}:` — prevents cross-tenant cache poisoning of benchmark data | `BenchmarkRetrievalService.ts` |
| 3 | Redis / Cache | HIGH | `SDUICacheService.headKey()` now includes `tenantId` — prevents workspace head pointer collision across tenants | `SDUICacheService.ts` |
| 4 | Jobs | HIGH | `mcpIntegrationWorker` validation and sync workers now wrap handlers in `runJobWithTenantContext()` — ALS tenant context is established for all downstream code | `mcpIntegrationWorker.ts` |
| 5 | DB / Vector | MEDIUM | `VectorSearchService.searchByEmbedding()` now throws if `organization_id` absent in filters | `VectorSearchService.ts` |
