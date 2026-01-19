# GitHub Copilot Instructions for ValueOS

AI agent workflow platform with multi-tenant architecture, agent fabric orchestration, and server-driven UI.

---

## Architecture Overview

**ValueOS** is a multi-tenant SaaS platform combining React (Vite), Supabase backend, and an AI agent orchestration system. Key characteristics:

- **Frontend:** React + TypeScript + Vite + TailwindCSS, Server-Driven UI (SDUI) system with semantic design tokens
- **Backend:** Express (Node.js) for billing/webhooks, Supabase for data/auth/RLS
- **Agent Fabric:** Orchestrated workflows via `WorkflowOrchestrator`, event-driven via `MessageBus`
- **Database:** PostgreSQL with Row-Level Security (RLS), managed via Supabase
- **Observability:** OpenTelemetry tracing, structured logging with `src/lib/logger.ts`
- **Security:** Secrets manager (AWS/Vault), RLS policies, multi-tenant isolation
- **Testing:** Vitest (unit/integration), Playwright (E2E), sequential execution (`fileParallelism: false`)

**Service Boundaries:**

- Frontend communicates via Supabase client (anon key)
- Backend uses service_role key ONLY for `AuthService`, `TenantProvisioning`, `CronJobs`
- Agents communicate asynchronously via `MessageBus` (CloudEvents protocol)
- Workflows persist state to Supabase after every DAG node transition

---

## Critical Multi-Tenancy Rules

**ALL database operations MUST scope by `organization_id` or `tenant_id`:**

```typescript
// ✅ CORRECT - Scoped query
const data = await supabase
  .from("workflows")
  .select("*")
  .eq("organization_id", user.organizationId);

// ❌ WRONG - Missing tenant scope
const data = await supabase.from("workflows").select("*");
```

**Memory/Vector Queries:**

```typescript
// ✅ CORRECT - Memory queries filter by tenant
await memorySystem.query(embedding, {
  metadata: { tenant_id: organizationId },
  limit: 10,
});
```

**RLS Policies:** All tables enforce RLS. Run `npm run test:rls` to validate policies.

---

## Agent Fabric Architecture

### Agent Development (`src/lib/agent-fabric/agents/**`)

**CRITICAL**: ALL production agents are in `src/lib/agent-fabric/agents/`. Legacy `src/agents/` was deleted (Dec 2024).

All agents extend `BaseAgent` and follow strict security patterns:

```typescript
// ✅ SECURE Agent structure
export class MyAgent extends BaseAgent {
  public readonly lifecycleStage = "discovery";
  public readonly version = "1.0.0";
  public readonly name = "MyAgent";

  async execute(sessionId: string, input: Input): Promise<Output> {
    // 1. Define Zod schema with hallucination_check
    const schema = z.object({
      result_field: z.string(),
      confidence_level: z.enum(["high", "medium", "low"]),
      reasoning: z.string(),
      hallucination_check: z.boolean().optional(), // REQUIRED
    });

    // 2. ALWAYS use secureInvoke() - NEVER llmGateway.complete()
    const secureResult = await this.secureInvoke(sessionId, prompt, schema, {
      trackPrediction: true,
      confidenceThresholds: { low: 0.6, high: 0.85 },
      context: { agent: "MyAgent" },
    });

    // 3. Store memory with organizationId (tenant isolation)
    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      "Knowledge to store",
      { metadata: "value" },
      this.organizationId // REQUIRED - prevents cross-tenant leaks
    );

    return secureResult.result;
  }
}
```

**MANDATORY Rules:**

- Each agent = single file `[AgentName]Agent.ts` in `src/lib/agent-fabric/agents/`
- LLM calls ONLY via `this.secureInvoke()` (circuit breakers, hallucination detection, Zod validation)
- ALL memory operations MUST include `this.organizationId` parameter (tenant isolation)
- Confidence thresholds by risk: Financial=0.7-0.9, Commitments=0.6-0.85, Discovery=0.5-0.8
  - **Financial agents** (0.7-0.9): ROI calculations, NPV, payback periods require highest accuracy to prevent financial misrepresentation
  - **Commitment agents** (0.6-0.85): Target metrics, KPIs, business objectives need high confidence but allow reasonable estimates
  - **Discovery agents** (0.5-0.8): Opportunity analysis, intelligence gathering permit exploratory insights with moderate confidence
- 100% test coverage required (mock `LLMGateway` and `MemorySystem`)
- NO direct `llmGateway.complete()` calls (100% security bypass)
- NO direct agent-to-agent memory access

### Workflow Orchestration (`src/services/WorkflowOrchestrator.ts`)

Workflows are DAGs defined in `src/data/lifecycleWorkflows.ts`:

```typescript
// Workflow = DAG with stages and transitions
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

- Workflows MUST be acyclic (cycles forbidden)
- Saga pattern: every state mutation needs a compensation function
- Persist `WorkflowState` to Supabase after EVERY node transition
- Use `WorkflowOrchestrator.executeWorkflow(definitionId, context)`

### Inter-Agent Communication (`src/services/MessageBus.ts`)

Agents communicate via CloudEvents-compliant messages:

```typescript
// ✅ Asynchronous event
await messageBus.publish({
  type: 'workflow.stage.completed',
  source: 'DiscoveryAgent',
  data: { findings: [...] },
  trace_id: context.traceId // MUST propagate
});

// ❌ WRONG - NO synchronous agent calls (except Orchestrator)
const result = await otherAgent.execute(data);
```

**Rules:**

- Default: asynchronous messaging
- `trace_id` MUST propagate across all async boundaries
- Use `MessageBus` for cross-agent communication
- Share data via `SharedArtifacts` table, not direct memory access

---

## Service Layer Patterns (`src/services/**`)

Backend services are stateless and tenant-aware:

```typescript
export class MyService {
  // ✅ Services must NOT hold state between requests
  async processData(organizationId: string, data: any) {
    // Always use supabase.auth.getUser() for context
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Multi-table writes in SQL transactions
    const { data: result } = await supabase.rpc("atomic_update", {
      org_id: organizationId,
      payload: data,
    });

    return result;
  }
}
```

**Bypass RLS with service_role ONLY for:**

- `AuthService` (user provisioning)
- `TenantProvisioning` (org creation)
- `CronJobs` (background tasks)

---

## Server-Driven UI (SDUI) (`src/sdui/**`)

Components must be registered in TWO places:

1. `config/ui-registry.json` (intent mappings)
2. `src/sdui/registry.tsx` (component exports)

```json
// config/ui-registry.json
{
  "intentType": "visualize_graph",
  "component": "SystemMapCanvas",
  "fallback": "JsonViewer"
}
```

```typescript
// src/sdui/registry.tsx
export const componentRegistry = {
  SystemMapCanvas: lazy(() => import("./components/SystemMapCanvas")),
};
```

**AI-Generated Content:**

- Mark with `GhostPreview` wrapper or "AI Generated" badge
- Use `useRealtimeUpdates` for WebSocket subscriptions

---

## Design Rules (VALYNT Brand)

**North Star Rule:** If a design or UI decision does not reinforce VALYNT as a dark-first, system-level, economically grounded Value Operating System, it is incorrect.

**Semantic Tokens Required:**

```tsx
// ✓ Required
<div className="bg-vc-surface-2 border-vc-border-default" />

// ✗ Forbidden
<div style={{ background: "#101010", border: "1px solid #2A2A2A" }} />
```

**Visual Metaphor:**

- Value Intelligence → Teal scale
- Structure/Graph/Evidence → Grey scale

---

## Tool System (`src/tools/**`, `src/services/tools/**`)

```typescript
// ✅ Tool implementation
export class MyTool implements Tool<Input, Output> {
  async execute(input: Input, context: ToolContext): Promise<Output> {
    // Check LocalRules before execution (LR-001)
    await checkLocalRules(context.organizationId, "tool.my_tool");

    // External APIs MUST use RateLimiter middleware
    const result = await rateLimiter.execute(() => externalApi.call(input), {
      key: `tool:${context.organizationId}`,
    });

    return result;
  }
}
```

**Rules:**

- Implement `Tool<TInput, TOutput>` interface
- Register in `ToolRegistry.ts` (dynamic creation FORBIDDEN)
- External API tools require `RateLimiter` middleware

---

## Development Workflow

### Start Development

```bash
npm run setup              # Initial setup
npm run dx                  # Start local dev environment (orchestrator)
npm run dev                 # Frontend dev server
npm run dx:docker           # Docker-based dev environment
npm run db:setup            # Bootstrap Supabase locally
npm run db:types            # Regenerate TypeScript types
```

### Testing

```bash
npm run test                # Unit + integration (sequential)
npm run test:rls            # RLS policy validation
npm run test:watch          # Watch mode
npm run typecheck           # TypeScript validation
npm run ci:verify           # Full CI pipeline locally
npm run security:scan       # Dependency audit
```

**Test Configuration:**

- `fileParallelism: false` (avoid race conditions on single container)
- Mock Supabase with `createBoltClientMock()` from `test/mocks/mockSupabaseClient`
- Timeout: 30s tests, 120s hooks
- Agent security tests: `src/lib/agent-fabric/agents/__tests__/*.security.test.ts`
- Run security suite: `bash scripts/test-agent-security.sh`

**Test Environment (Node.js):**
Backend/agent tests run in Node.js (no browser APIs). Guard browser-only code:

```typescript
// tests/setup.ts - Conditional browser API mocks
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}
```

### Codemap Workflows

Use `@codemap` feature for dependency tracing:

```typescript
// Trace opportunity flow
@{opportunity-flow-map}: OpportunityAgent → TargetAgent → ValueMappingAgent

// Infrastructure validation
@{infra-map}: devcontainer.json → .devcontainer/scripts/*

// Security verification
@{security-map}: LLMGateway.ts incoming calls → piiFilter.ts
```

### Staging → Production Deployment Flow

**Workflow:** Local tests → Staging deploy → 48hr observation → Production release

1. **Staging Deployment:**
   - Run security test suite: `bash scripts/test-agent-security.sh`
   - Build staging: `npm run build`
   - Deploy and run smoke tests (OpportunityAgent, FinancialModelingAgent)
   - Validate cross-tenant isolation (Org A cannot access Org B data)
   - Monitor circuit breakers, hallucination detection rates, latency

2. **Observation Period (48 hours):**
   - Grafana metrics: agent confidence scores, error rates, memory usage
   - Security audit: zero cross-tenant leaks, zero RLS violations
   - Performance: latency increase < 10% baseline

3. **Production Release:**
   - Sign-off from Engineering, Security, DevOps
   - Gradual rollout with feature flags
   - Rollback plan ready (circuit breaker stuck open, hallucination rate > 20%)

**Complete checklist:** `STAGING_DEPLOYMENT_CHECKLIST.md` (9-step guide with verification commands)

### Pre-Production Verification

```bash
# Automated verification suite
./scripts/verify-production.sh staging

# SQL health checks
psql $DATABASE_URL -f scripts/verify-production-readiness.sql

# Critical queries
SELECT * FROM security.verify_rls_enabled();
SELECT * FROM security.health_check();
```

**Before Production Deploy:**

- Configure JWT custom claims (`organization_id` in token)
- Test cross-tenant access isolation in staging
- Enable service role operation monitoring
- Deploy Edge Functions with secure secrets
- Configure Storage RLS policies

### Path Aliases

```typescript
import { logger } from "@lib/logger";
import { MyService } from "@services/MyService";
import { Button } from "@components/ui/Button";
```

Configured in `vitest.config.ts` and `tsconfig.json`.

---

## Security & Compliance

### Secrets Management

- `SECRETS_MANAGER_ENABLED=true` (AWS or Vault)
- `.env` for non-sensitive defaults only
- NEVER commit `SUPABASE_SERVICE_KEY` or `STRIPE_SECRET_KEY`

### Input Sanitization

```typescript
// ✅ Sanitize SDUI payloads
import { SDUISanitizer } from "@lib/security/SDUISanitizer";
const clean = SDUISanitizer.sanitize(userInput);

// ✅ Validate with Zod
const schema = z.object({ email: z.string().email() });
const validated = schema.parse(req.body);
```

### Logging

```typescript
// ✅ Structured logging (NO console.log)
logger.info("Workflow started", {
  workflowId,
  organizationId,
  trace_id: context.traceId,
});

// ❌ NEVER log sensitive data
logger.error("Auth failed", { password: user.password }); // WRONG
```

Run `npm run lint:console` to detect console.log usage.

---

## Communication Style

**Be concise. NO conversational filler.**

Examples:

- ❌ "Sure, I can help with that. Here's the code..."
- ✅ _Just provide the code with filename_
- ❌ "I've updated the file to add the feature."
- ✅ _Perform the edit silently_

Only explain complex logic or architectural decisions, not obvious code changes.

## Recent Security Improvements (Dec 2024 - Jan 2026)

**Agent Security Overhaul**: All 8 production agents now use `secureInvoke()` with:

- ✅ Circuit breaker protection (prevents runaway LLM costs)
- ✅ Hallucination detection via `hallucination_check` flag in schemas
- ✅ Structured output validation with Zod
- ✅ Tenant isolation in all memory operations (organizationId required)
- ✅ Confidence score tracking for accuracy metrics

**Global Rules Enforcement**: Policy-as-Code for systemic safety, data sovereignty, PII protection, cost control, audit compliance.

**Design System**: Semantic token-based styling with VALYNT brand enforcement.

**Codemap Integration**: Live dependency graphs, blast radius analysis, hot path detection.

**Verification**: Zero agents bypass security (verified via `grep -r "llmGateway\.complete" src/lib/agent-fabric/agents/*.ts`)

**⚠️ Legacy Code Warning**: The `src/agents/` directory was **deleted** in Dec 2024 (backup: `backup/legacy-agents-*/`). All production agents are now in `src/lib/agent-fabric/agents/`. If you find references to `src/agents/` in:

- Import statements (e.g., `from '../../agents/OpportunityAgent'`)
- Documentation or comments
- Configuration files
- Test files

**Action required**: Update paths to `src/lib/agent-fabric/agents/` or remove obsolete references. Verify with:

```bash
grep -r "src/agents/" --include="*.ts" --include="*.tsx" --include="*.md"
```

---

## Key Files Reference

| Path                                                    | Purpose                              |
| ------------------------------------------------------- | ------------------------------------ |
| `src/services/WorkflowOrchestrator.ts`                  | Workflow DAG execution engine        |
| `src/services/MessageBus.ts`                            | CloudEvents message bus              |
| `src/lib/agent-fabric/agents/BaseAgent.ts`              | Agent base class with secureInvoke() |
| `src/lib/agent-fabric/MemorySystem.ts`                  | Vector memory (tenant-scoped)        |
| `src/lib/agent-fabric/SafeJSONParser.ts`                | JSON error recovery (400+ lines)     |
| `src/lib/supabase.ts`                                   | Supabase client singleton            |
| `config/ui-registry.json`                               | SDUI component mappings              |
| `supabase/tests/database/rls_policies.test.sql`         | RLS test suite                       |
| `docs/database/enterprise_saas_hardened_config_v2.sql`  | Production database schema           |
| `scripts/test-agent-security.sh`                        | Agent security test runner           |
| `scripts/cleanup-legacy-agents.sh`                      | Legacy code cleanup (with backup)    |
| `STAGING_DEPLOYMENT_CHECKLIST.md`                       | Deployment verification guide        |
| `.windsurf/rules/`                                      | AI agent behavior rules              |
| `docs/guides/instructions/design rules.instructions.md` | UI design token rules                |
| `scripts/bin/.windsurfrules.md`                         | Workspace and codemap rules          |

**Detailed instructions:** See `.github/instructions/{agents,backend,frontend,orchestration,memory,communication,tools}.instructions.md` for domain-specific guidelines.

---

**Last Updated:** 2026-01-18 (Added design rules, codemap workflows, updated development commands)
