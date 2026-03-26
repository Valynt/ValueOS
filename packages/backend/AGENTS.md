# packages/backend — Agent Instructions

Extends root `AGENTS.md`. Rules here are specific to the Express backend package.

## Entry points

- Server: `src/index.ts` → `src/app.ts`
- Routes mounted in `src/app.ts`; route files live in `src/api/`
- Health check: `GET /health` (port 3001)

## Key conventions

**No `(req as any)` casts.** All request properties are declared in `src/types/express.d.ts`. Add new properties there.

**Tenant isolation on every query.** Every Supabase query must include `.eq("organization_id", orgId)` or `.eq("tenant_id", tenantId)`. Validate with `pnpm run test:rls`.

**Agent LLM calls via `secureInvoke` only.** Never call `llmGateway.complete()` directly. See `src/lib/agent-fabric/agents/BaseAgent.ts`.

**`service_role` client** is only for AuthService, tenant provisioning, and cron jobs — it bypasses RLS.

Concrete allowlisted directories for backend service-role call sites:
- `src/lib/supabase/privileged/` (factory modules)
- `src/services/auth/`
- `src/services/tenant/`
- `src/workers/`
- `src/jobs/`

Every service-role call site must include:
- an explicit justification literal with tag format
  `service-role:justified <reason>`, for example
  `createCronSupabaseClient({ justification: "service-role:justified nightly usage aggregation" })`.

Request handlers under `src/api/**`, `src/middleware/**`, and `src/routes/**` must not import
service-role clients directly unless CI allowlists the file.

## Agent fabric

- Agents: `src/lib/agent-fabric/agents/` — one class per file, extends `BaseAgent`
- Factory: `src/lib/agent-fabric/AgentFactory.ts`
- Runtime services: `src/runtime/` (DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine)
- Workflow DAGs: `src/data/lifecycleWorkflows.ts`

## Service extraction rules

When a service file exceeds ~1000 lines, extract by cohesion into a sibling file. The original re-exports everything. Canonical extraction targets:
- `src/services/tenant/TenantLimits.ts` — tier limits and feature flags
- `src/services/sdui/CanvasActionApplier.ts` — SDUI atomic actions
- `src/services/agents/resilience/AgentRetryTypes.ts` — retry/resilience types

## Testing

```bash
pnpm --filter backend test          # unit tests
pnpm run test:rls                   # RLS tenant isolation
bash scripts/test-agent-security.sh # agent security suite
```

Mock `LLMGateway` and `MemorySystem` in all agent tests.

## Environment variables

See root `AGENTS.md` § Dev Environment Notes. Critical: `TCT_SECRET`, `SUPABASE_KEY`, `WEB_SCRAPER_ENCRYPTION_KEY`.
