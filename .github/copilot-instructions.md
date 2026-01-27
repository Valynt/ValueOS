````instructions
# GitHub Copilot Instructions for ValueOS

Multi-tenant AI orchestration platform: React (Vite) + Supabase (PostgreSQL/RLS) + Node.js backend + agent workflows (DAGs) + vector memory + async messaging.

---

## 90-Second Architecture Summary

**Monorepo:** pnpm workspaces — `apps/` (ValyntApp, VOSAcademy) and `packages/` (backend, agent-fabric, memory, sdui, services, shared, components, integrations)

**Critical Data Boundaries:**
- **Frontend:** anon key only → Supabase REST
- **Backend:** service_role ONLY for AuthService, TenantProvisioning, CronJobs
- **Agents:** ALL LLM calls via `secureInvoke()` (circuit breaker + hallucination detection + Zod validation)
- **Memory:** Vector DB with mandatory tenant-scoped queries
- **Messaging:** CloudEvents via `MessageBus` (async inter-agent communication)

**Dev Stack:** `pnpm run dx` orchestrates Supabase + migrations + backend + frontend with Caddy HTTPS
**Testing:** Vitest sequential (`fileParallelism: false`), RLS validation (`pnpm run test:rls`), agent security suite (`bash scripts/test-agent-security.sh`)

---

## CRITICAL Multi-Tenancy Rules (Non-Negotiable)

**Rule 1: Every database query MUST include `organization_id` or `tenant_id` filter**
```typescript
// ✅ CORRECT
const data = await supabase.from("workflows").select("*").eq("organization_id", org);

// ❌ WRONG - data leak
const data = await supabase.from("workflows").select("*");
```

**Rule 2: Memory queries MUST specify `tenant_id` metadata filter**
```typescript
// ✅ CORRECT
await memorySystem.query(embedding, { metadata: { tenant_id: org }, limit: 10 });

// ❌ WRONG - cross-tenant exposure
await memorySystem.query(embedding, { limit: 10 });
```

**Rule 3: service_role bypasses RLS — only for auth, tenant provisioning, cron jobs**

Validate: `pnpm run test:rls`

---

## Agent Development (`src/lib/agent-fabric/agents/`)

**ALL production agents must:**

1. Extend `BaseAgent` with `lifecycleStage`, `version`, `name` properties
2. ALWAYS use `this.secureInvoke(sessionId, prompt, zodSchema, options)` for LLM calls (NEVER direct `llmGateway.complete()`)
3. Include `hallucination_check: boolean` in Zod schema
4. Store memory with `this.organizationId` parameter (tenant isolation required)
5. Set confidence thresholds by risk:
   - **Financial agents:** 0.7-0.9 (ROI, NPV, payback — highest accuracy required)
   - **Commitment agents:** 0.6-0.85 (targets, KPIs, objectives)
   - **Discovery agents:** 0.5-0.8 (opportunity analysis, intelligence gathering)

```typescript
// ✅ SECURE Agent Pattern
export class MyAgent extends BaseAgent {
  public readonly lifecycleStage = "discovery";
  public readonly version = "1.0.0";
  public readonly name = "MyAgent";

  async execute(sessionId: string, input: Input): Promise<Output> {
    const schema = z.object({
      result: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      reasoning: z.string(),
      hallucination_check: z.boolean().optional(), // REQUIRED
    });

    const result = await this.secureInvoke(sessionId, prompt, schema, {
      trackPrediction: true,
      confidenceThresholds: { low: 0.6, high: 0.85 },
      context: { agent: "MyAgent" },
    });

    // MUST include organizationId for tenant isolation
    await this.memorySystem.storeSemanticMemory(
      sessionId, this.agentId, "Knowledge", { metadata: "value" }, this.organizationId
    );

    return result.result;
  }
}
```

**Test Coverage:** 100% required. Mock `LLMGateway` and `MemorySystem`. Never test with real LLM calls.

---

## Workflows & Orchestration

**Workflows are DAGs** defined in `src/data/lifecycleWorkflows.ts`, executed via `WorkflowOrchestrator.executeWorkflow(definitionId, context)`:

```typescript
const workflow: WorkflowDAG = {
  initial_stage: "start",
  stages: {
    start: { agent: "DiscoveryAgent", retry: { max: 3, delay: 1000 } },
    analysis: { agent: "AnalysisAgent", compensation: "rollback_analysis" },
  },
  transitions: {
    start: [{ to: "analysis", condition: "has_data" }],
  },
};
```

**Rules:**
- Workflows MUST be acyclic (no cycles)
- Saga pattern: compensation function for every state mutation
- Persist `WorkflowState` to Supabase after EVERY node transition
- Inter-agent messaging only via `MessageBus` (async, CloudEvents, trace_id propagation required)

---

## Backend Services (`src/services/`)

**Services must be stateless:**
```typescript
// ✅ CORRECT - Always fetch user context
export class MyService {
  async processData(organizationId: string, data: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const result = await supabase.from("table").select("*").eq("organization_id", organizationId);
    return result;
  }
}

// ❌ WRONG - Holding state between requests
let cachedUser = null;
export class BadService {
  async processData(data: any) {
    if (!cachedUser) cachedUser = await supabase.auth.getUser();
  }
}
```

---

## Server-Driven UI (`src/sdui/`)

Components must be registered in **TWO places:**
1. `config/ui-registry.json` (intent mappings)
2. `src/sdui/registry.tsx` (component exports)

Mark AI-generated content with `GhostPreview` wrapper or "AI Generated" badge. Use semantic tokens (no hard-coded colors):
```tsx
// ✅ CORRECT
<div className="bg-vc-surface-2 border-vc-border-default" />

// ❌ WRONG
<div style={{ background: "#101010" }} />
```

---

## Development Workflow

**Setup & Run:**
```bash
pnpm run setup              # Initial setup (one-time)
pnpm run dx                 # Full stack (Supabase + backend + frontend)
pnpm run dx:docker          # Docker-based environment
pnpm run dev                # Frontend only (requires backend running)
```

**Testing & Validation:**
```bash
pnpm run test               # Unit + integration (sequential)
pnpm run test:rls           # RLS policy validation
pnpm run test:watch         # Watch mode
pnpm run typecheck          # TypeScript check
bash scripts/test-agent-security.sh  # Agent security suite
```

**Database:**
```bash
pnpm run db:setup           # Bootstrap Supabase
pnpm run db:types           # Regenerate TypeScript types
pnpm run db:push            # Push migrations to staging
pnpm run db:pull            # Pull remote schema
```

---

## Critical Files Reference

| Path | Purpose |
|------|---------|
| `src/services/WorkflowOrchestrator.ts` | Workflow DAG execution engine |
| `src/services/MessageBus.ts` | CloudEvents async messaging |
| `src/lib/agent-fabric/agents/BaseAgent.ts` | Agent base class + secureInvoke() |
| `src/lib/agent-fabric/MemorySystem.ts` | Vector memory (tenant-scoped) |
| `src/lib/supabase.ts` | Supabase client singleton |
| `config/ui-registry.json` | SDUI component mappings |
| `supabase/tests/database/rls_policies.test.sql` | RLS validation |
| `scripts/test-agent-security.sh` | Agent security test runner |
| `.windsurf/rules/*.md` | AI behavior guidelines (global, agents, backend, frontend, orchestration, memory) |
| `docs/dx-architecture.md` | DX environment setup & troubleshooting |

---

## Security & Compliance

**Secrets:** Never commit `.env.local` or secrets. Use environment templates in `deploy/envs/`.

**Input Sanitization:**
```typescript
import { SDUISanitizer } from "@lib/security/SDUISanitizer";
const clean = SDUISanitizer.sanitize(userInput);

const schema = z.object({ email: z.string().email() });
const validated = schema.parse(req.body);
```

**Logging:** Use structured logging only. Never log sensitive data:
```typescript
logger.info("Workflow started", { workflowId, organizationId, trace_id });
```

---

## Project-Specific Conventions

- **Path aliases:** `@lib/*`, `@services/*`, `@components/*` (tsconfig.json + vitest.config.ts)
- **Prompts:** Handlebars templates (no string concatenation)
- **Tools:** Static registration in `ToolRegistry.ts` (no dynamic creation)
- **Memory sharing:** Via `MessageBus` events or `SharedArtifacts` table (no cross-tenant direct access)
- **Design north star:** VALYNT = dark-first, system-level, economically grounded Value Operating System
- **Styling:** Semantic tokens (teal for Value Intelligence, grey for Structure/Graph/Evidence)

---

## Recent Security Improvements (Dec 2024 – Jan 2026)

- ✅ All agents use `secureInvoke()` with circuit breaker + hallucination detection + Zod validation
- ✅ Tenant isolation in ALL memory operations (organizationId required)
- ✅ Global rules enforcement (Policy-as-Code for safety, data sovereignty, PII protection, cost control)
- ✅ Semantic token-based design system with VALYNT brand enforcement
- ✅ Codemap integration for live dependency graphs and blast radius analysis
- ⚠️ **Legacy Warning:** `src/agents/` deleted Dec 2024. All production agents now in `src/lib/agent-fabric/agents/`. Update references or verify with: `grep -r "src/agents/" --include="*.ts" --include="*.tsx" --include="*.md"`

---

**Last Updated:** 2026-01-26 | **Next:** Review `.windsurf/rules/` for AI guidelines, `docs/ENVIRONMENT.md` for env setup, `STAGING_DEPLOYMENT_CHECKLIST.md` for release process
````
