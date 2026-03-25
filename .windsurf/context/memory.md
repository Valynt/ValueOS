<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Constitutional rules: value truth · economic defensibility · evidence over assertion ·
auditability · lifecycle continuity · integrity before convenience · tenant discipline ·
agents serve the value model.
Full policy: docs/AGENTS.md -->

# Long-Term Memory — Lessons Learned

Persistent record of non-obvious decisions, recurring mistakes, and patterns that worked.
This is the "why we do it this way" layer — things not obvious from reading the code.

Add entries here when you solve a problem that took more than one attempt, or when you
notice a pattern being re-introduced that was previously removed.

---

## Architecture Patterns That Work

### Agent persistence: always write to DB, never rely on MemorySystem alone
`MemorySystem` is an in-process store. It does not survive HTTP request boundaries in
direct-mode execution (`enable_persistence: false`). Any agent output that needs to be
read by the frontend or by a subsequent agent in a different request MUST be written to
a Supabase table via a repository. The three agents that do this correctly are
`OpportunityAgent` → `hypothesis_outputs`, `TargetAgent` → `value_tree_nodes`,
`FinancialModelingAgent` → `financial_model_snapshots`. All others are memory-only and
their output is lost on restart.

**Pattern:** Agent writes to DB in `execute()`. API endpoint reads from DB. Frontend hook
polls the API. Never read from `MemorySystem` in an API handler.

---

### secureInvoke is not optional
Early versions of agents called `llmGateway.complete()` directly. This bypassed circuit
breaker, hallucination detection, and Zod validation. A security audit (Dec 2025) found
8 agents doing this and required a full replacement pass. All agents now use
`this.secureInvoke()`. The linting rule in `.windsurf/rules/agents.md` enforces this.
Never revert to direct `llmGateway.complete()` calls in agent code.

---

### RLS + application-level tenant filter = defense in depth
RLS alone is not sufficient. A historical vulnerability in `agent_predictions` used
`organization_id IS NULL OR organization_id = ...` which allowed NULL to bypass the
policy. The fix was to require `organization_id IS NOT NULL` in the policy AND add
`.eq("organization_id", orgId)` in every application query. Both layers must be present.
See `PRODUCTION_READINESS_CRITICAL_GAPS.md` for the original vulnerability analysis.

---

### Workflow topology must be a DAG — enforce before merging
Cycles in the agent workflow DAG cause infinite loops that are hard to detect in tests
because they only manifest under specific execution paths. The saga pattern requires
every state mutation to have a compensation function — if you add a new workflow node,
add the compensation at the same time or the PR should be blocked.

---

### SDUI component registration requires two files
Registering a new SDUI component in only `config/ui-registry.json` or only
`packages/sdui/src/registry.tsx` causes a silent runtime failure — the component
renders nothing with no error. Both files must be updated in the same commit.

---

## Anti-Patterns to Avoid

### ❌ Hardcoding "Acme Corp" or demo data in UI components
Multiple stages (`IntegrityStage`, `RealizationStage`, `NarrativeStage`,
`ValueCaseCanvas` header, `CRMIntegrationService`) contain hardcoded "Acme Corp"
strings. This pattern was introduced as a placeholder during rapid prototyping and
has persisted. Every new component must use real data from a hook from day one.
Placeholder data in a component is a debt item the moment it is committed.

---

### ❌ Using `provider: "openai"` in LLMGateway config
`LLMGateway` only implements `together`. Using any other provider string throws
`'Provider not implemented'` at runtime. This is not a TypeScript error — it compiles
fine. The bug in `UnifiedAgentOrchestrator.ts:414` and `getDirectFactory()` was
introduced this way. Always use `provider: "together"` until additional providers
are explicitly implemented and tested.

---

### ❌ Standalone agents in `packages/agents/`
The Express microservices in `packages/agents/` were the original architecture. They
use mock data and Python-style FastAPI patterns ported to Node. They were superseded
by the agent-fabric in `packages/backend/src/lib/agent-fabric/`. Do not add features
to `packages/agents/` — they are deprecated. Any new agent work goes in the fabric.

---

### ❌ Default exports
The codebase uses named exports exclusively. Default exports were removed during the
monorepo restructure (Phase 3, early 2026). Introducing a default export breaks
tree-shaking and causes inconsistent import patterns. ESLint enforces this.

---

### ❌ `any` as a shortcut
The codebase has 1,977 `any` usages as of Feb 2026 — a known debt baseline. The rule
is: do not introduce new `any`. Use `unknown` + type guards. Every file you touch
should leave fewer `any` usages than it had before. The burn-down target is <100.

---

### ❌ Mounting a router without verifying the path in server.ts
`valueCasesRouter` was built and exported but not confirmed as mounted in `server.ts`.
Frontend hooks call `/api/v1/value-cases/...` but the mount path was not found in
`server.ts` during the March 2026 audit. Always verify the full request path from
browser to handler: `server.ts mount` + `router path` + `endpoint path`.

---

## Migration History (for context)

| When | What | Why |
|---|---|---|
| Early 2026 | Monorepo restructure: `src/pages/views/*` → `src/pages/{auth,admin,...}/` | Flatten deep nesting, align with `apps/` workspace structure |
| Early 2026 | Removed `.config/configs/` (20 files) | Obsolete after restructure |
| Early 2026 | Moved `src/components/Layout/` → `src/layouts/` | Separation of layout from components |
| Feb 2026 | All agents migrated from `llmGateway.complete()` to `secureInvoke()` | Security audit finding |
| Feb 2026 | `SupabaseMemoryBackend` added to bridge agent memory to Supabase | Persistence for semantic memory |
| Mar 2026 | E2E test structure consolidated; deprecated path guard added | Prevent test drift between `tests/e2e/` layouts |

---

## Tenant Deletion Workflow (Sprint 16)

`TenantDeletionService` (`packages/backend/src/services/tenant/TenantDeletionService.ts`) implements three-phase offboarding:

1. **Soft delete** (`initiateSoftDelete`) — marks `status = 'pending_deletion'`, sets `deletion_scheduled_at = now + 30 days`, cancels billing via `deprovisionTenant`. Exposed at `POST /admin/tenants/:tenantId/delete`.
2. **Export** (`exportTenantData`) — dumps all tenant rows from every table in FK-safe order to a JSON archive, records `data_exported_at`. Exposed at `POST /admin/tenants/:tenantId/export`. Caller is responsible for storing the archive.
3. **Hard delete** (`hardDelete`) — deletes rows in FK-safe order, marks `status = 'deleted'`. Gated on `data_exported_at IS NOT NULL` and `deletion_scheduled_at <= now`. Exposed at `POST /admin/tenants/:tenantId/hard-delete`.

`processScheduledDeletions()` is the cron entry point — call it daily to process tenants whose 30-day window has elapsed. Exposed at `POST /admin/tenants/process-scheduled-deletions`.

**Non-obvious behaviour:**
- Hard delete continues past per-table errors (partial deletion is retriable; stopping mid-run leaves orphaned rows that are harder to clean up).
- The 30-day window is a constant in the service (`SOFT_DELETE_DAYS = 30`), not a per-tenant config. Change it there if the business requirement changes.
- The export does not include `auth.users` rows — those are managed by Supabase Auth and require a separate erasure call via the Auth admin API.
- `crm_connections` is included in the FK-safe deletion order; encrypted tokens are deleted with the row.

**Migration:** `20260401030000_tenant_deletion_columns.sql` adds `deletion_requested_at`, `deletion_scheduled_at`, `data_exported_at`, `deleted_at`, `deletion_reason`, `deletion_requested_by` to `tenants` and extends the `status` check constraint to include `pending_deletion`.

---

## Sprint Planning Anti-Patterns

### ❌ Trusting debt.md assessments without verifying the file
DEBT-010 claimed `SecurityMonitor` alert channels were TODO stubs. Reading the actual file
(`SecurityMonitor.ts`) revealed all channels are implemented via webhook URLs with graceful
no-op fallbacks. Always read the file before scheduling debt work. Debt entries can become
stale when code is updated without updating the debt register.

### ❌ Using stale `any` counts from debt.md
The `any` debt table in `debt.md` was last updated 2026-03-11 with counts from early 2026.
By 2026-07-15 the actual counts had changed significantly (e.g. `packages/mcp` dropped to 0,
`apps/ValyntApp` production files were ~409 not 839). Always re-measure with grep before
writing sprint targets. Use: `grep -Ern ": any\>|as any\>|<any>" <path> --include="*.ts" --include="*.tsx" | wc -l`.

---

## Recurring Review Checklist

Before submitting any PR that touches agent code, verify:

- [ ] Agent extends `BaseAgent`, defines `lifecycleStage`, `version`, `name`
- [ ] All LLM calls use `this.secureInvoke()` — zero direct `llmGateway.complete()` calls
- [ ] Zod schema includes `hallucination_check: z.boolean().optional()`
- [ ] Memory store calls include `this.organizationId` as the tenant argument
- [ ] Agent output is persisted to a DB table (not memory-only)
- [ ] New DB table has RLS policy with `organization_id IS NOT NULL` check
- [ ] API endpoint includes `organization_id` filter — not just RLS
- [ ] No hardcoded demo data in UI components
- [ ] No new `any` types introduced
- [ ] `pnpm run test:rls` passes
