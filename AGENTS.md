# AGENTS.md — ValueOS

Single source of truth for AI coding agents. Tool-specific configs (`.github/copilot-instructions.md`, `.windsurf/rules/`, `GEMINI.md`) should reference this file rather than duplicate its content.

## Architecture

pnpm monorepo. Frontend apps in `apps/` (ValyntApp, VOSAcademy, mcp-dashboard). Libraries and services in `packages/` (agents, agent-fabric, backend, components, infra, integrations, mcp, memory, sdui, sdui-types, services, shared, test-utils, config-v2).

**Stack:** React + Vite + Tailwind (frontend), Node.js + Express (backend), Supabase (Postgres + RLS + Auth + Realtime), Redis, BullMQ queues, CloudEvents messaging.

**Agent system:** 8-agent fabric in `packages/backend/src/lib/agent-fabric/`. Agents: OpportunityAgent, TargetAgent, FinancialModelingAgent, IntegrityAgent, RealizationAgent, ExpansionAgent, NarrativeAgent, ComplianceAuditorAgent. Orchestration via six runtime services in `packages/backend/src/runtime/` (DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine). Vector memory with tenant-scoped queries. Inter-agent messaging via `MessageBus` (CloudEvents).

## Non-Negotiable Rules

### 1. Tenant isolation

Every database query MUST include `organization_id` or `tenant_id`. Every vector/memory query MUST filter on `tenant_id` in metadata. No exceptions.

```typescript
// ✅
await supabase.from("workflows").select("*").eq("organization_id", orgId);
await memorySystem.query(embedding, { metadata: { tenant_id: orgId }, limit: 10 });

// ❌ Data leak
await supabase.from("workflows").select("*");
await memorySystem.query(embedding, { limit: 10 });
```

Validate with: `pnpm run test:rls`

### 2. LLM calls via secureInvoke only

All production agent LLM calls use `this.secureInvoke(sessionId, prompt, zodSchema, options)` from `BaseAgent`. This wraps calls with circuit breaker, multi-signal hallucination detection, and Zod validation. Never call `llmGateway.complete()` directly from agent code.

`secureInvoke` returns `hallucination_check` (boolean) and `hallucination_details` (full signal breakdown with grounding score). High-severity signals trigger escalation logging. See `BaseAgent.checkHallucination()` for the detection pipeline.

### 3. service_role restrictions

`service_role` bypasses RLS. Use it only for: AuthService, tenant provisioning, cron jobs.

### 4. No cross-tenant data transfer

Block any operation that copies, moves, or exports data between tenants.

## Agent Development

Location: `packages/backend/src/lib/agent-fabric/agents/` — one class per file, named `XAgent.ts`.

Requirements:
- Extend `BaseAgent`
- Define `lifecycleStage`, `version`, `name`
- Use Zod schemas for LLM responses; include `hallucination_check: boolean`
- Store memory with `this.organizationId` (tenant isolation)
- Use Handlebars templates for prompts (no string concatenation)
- Confidence thresholds by risk: financial 0.7–0.9, commitment 0.6–0.85, discovery 0.5–0.8

```typescript
export class MyAgent extends BaseAgent {
  public readonly lifecycleStage = "discovery";
  public readonly version = "1.0.0";
  public readonly name = "MyAgent";

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const schema = z.object({
      result: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      reasoning: z.string(),
      hallucination_check: z.boolean().optional(),
    });

    const result = await this.secureInvoke(sessionId, prompt, schema, {
      trackPrediction: true,
      confidenceThresholds: { low: 0.6, high: 0.85 },
      context: { agent: "MyAgent" },
    });

    await this.memorySystem.storeSemanticMemory(
      sessionId, this.name, "episodic", content, metadata, this.organizationId
    );

    return this.prepareOutput(result, "success");
  }
}
```

## Workflows & Messaging

- DAG definitions: `packages/backend/src/data/lifecycleWorkflows.ts`
- Orchestration: six runtime services in `packages/backend/src/runtime/` (DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine)
- Inter-agent communication: `MessageBus` (CloudEvents) — propagate `trace_id` across async boundaries
- Workflows are DAGs; cycles are forbidden
- Saga pattern: every state mutation needs a compensation function
- Persist `WorkflowState` to Supabase after every node transition

## Coding Conventions

- **TypeScript strict mode.** No `any` — use `unknown` + type guards.
- **Named exports only** (no default exports).
- **Functional React components** with hooks.
- **Zod** for runtime validation.
- **Path aliases** (defined in `tsconfig.app.json`):
  - `@/*` → `./src/*`
  - `@lib/*` → `./src/lib/*`
  - `@shared/*` → `./packages/shared/src/*`
  - `@backend/*` → `./packages/backend/src/*`
  - `@valueos/<pkg>` → `./packages/<pkg>/...`
- **SDUI components:** register in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx`.
- **Tools:** implement `Tool<TInput, TOutput>` interface, register statically in `ToolRegistry.ts`. Dynamic creation forbidden.

## Dev Commands

```bash
pnpm run dx              # Full stack: Supabase + migrations + backend + frontend (Caddy HTTPS)
pnpm run dx:doctor       # Diagnose dev environment issues
pnpm run dev:frontend    # Frontend only
pnpm run dev:backend     # Backend only
pnpm run db:migrate      # Run database migrations
pnpm run lint            # ESLint (cached)
pnpm test                # Vitest (sequential, fileParallelism: false)
pnpm run test:rls        # RLS policy validation
bash scripts/test-agent-security.sh  # Agent security suite
```

## Testing Conventions

- Framework: Vitest with jsdom, globals enabled.
- Tests co-located: `*.test.ts` / `*.spec.ts` next to source files, or in `__tests__/` directories.
- Sequential execution (`fileParallelism: false`).
- Mock `LLMGateway` and `MemorySystem` in agent tests.
- RLS tests validate tenant isolation at the database level.

## Safety & Compliance

- PII detection: block SSN, CC, email lists, phone, passport, DOB, healthcare IDs. Never log PII.
- Dangerous command blocking: DROP/TRUNCATE without WHERE, `rm -rf`, `sudo`, `chmod 777`, `eval`, `kill -9`.
- Network allowlist (production): internal services, LLM providers, monitoring, CDN only. GitHub, pastebin, ngrok, serveo blocked.
- Cost limits per session: dev $5, staging $10, prod $25 (warn at 80%).
- Execution time limits: dev 60s, staging 45s, prod 30s.
- Recursion depth: dev 10, staging 7, prod 5.
- Audit trail required for create/update/delete/export/approve/reject/grant/revoke actions.

Full policy-as-code: `.windsurf/rules/global.md`

## Key File Pointers

| File | Purpose |
|---|---|
| `packages/shared/src/domain/` | **Canonical domain model** — 9 first-class domain objects as Zod schemas (Account, Opportunity, Stakeholder, ValueHypothesis, Assumption, Evidence, BusinessCase, RealizationPlan, ExpansionOpportunity). All agent reasoning must operate on these types. |
| `packages/backend/src/runtime/decision-router/` | DecisionRouter — selects agent/action based on structured domain state. |
| `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts` | `secureInvoke`, hallucination detection, agent base class |
| `packages/backend/src/lib/agent-fabric/agents/OpportunityAgent.ts` | Hypothesis generation (OPPORTUNITY phase) |
| `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts` | KPI target generation (DRAFTING phase) |
| `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts` | Financial model, ROI, sensitivity analysis |
| `packages/backend/src/lib/agent-fabric/agents/IntegrityAgent.ts` | Claim validation, veto decisions (VALIDATING phase) |
| `packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts` | Implementation plans, milestones (REALIZATION phase) |
| `packages/backend/src/lib/agent-fabric/agents/ExpansionAgent.ts` | Growth opportunities, expansion strategies (EXPANSION phase) |
| `packages/backend/src/lib/agent-fabric/agents/NarrativeAgent.ts` | Business narrative generation (COMPOSING phase) |
| `packages/backend/src/lib/agent-fabric/agents/ComplianceAuditorAgent.ts` | Control evidence review, compliance scoring (INTEGRITY phase, audit sub-role) |
| `packages/backend/src/lib/agent-fabric/AgentFactory.ts` | Agent instantiation with dependency injection |
| `packages/backend/src/lib/agent-fabric/MemorySystem.ts` | Tenant-scoped in-memory store (to be replaced with pgvector) |
| `packages/backend/src/lib/agents/` | Agent core library (ValueCaseSaga, EvidenceTiering, ConfidenceScorer, HypothesisLoop, RedTeamAgent) |
| `packages/memory/` | Persistent memory subsystem (semantic, episodic, vector, provenance) |
| `packages/backend/src/runtime/` | Six runtime services that replaced UnifiedAgentOrchestrator: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine |
| `packages/backend/src/runtime/recommendation-engine/` | RecommendationEngine — subscribes to domain events (opportunity.updated, hypothesis.validated, evidence.attached, realization.milestone_reached) and pushes next-best-action recommendations to UI clients via RealtimeBroadcastService |
| `packages/backend/src/types/orchestration.ts` | Canonical orchestration types (AgentResponse, ExecutionEnvelope, StreamingUpdate, etc.) |
| `packages/backend/src/analytics/ValueLoopAnalytics.ts` | Value loop learning: recommendation acceptance, assumption corrections, evidence persuasiveness |
| `packages/backend/src/observability/valueLoopMetrics.ts` | Prometheus metrics for value loop stage transitions, agent invocations, hypothesis confidence |
| `docs/observability/data-asset-inventory.md` | T1/T2/T3 data asset inventory — tables, queues, owners, freshness SLAs, downstream dependency map |
| `packages/backend/src/services/MessageBus.ts` | CloudEvents inter-agent messaging |
| `packages/backend/src/services/ToolRegistry.ts` | Static tool registration |
| `.windsurf/rules/global.md` | Safety and compliance policy |
| `.github/CODEOWNERS` | Review routing by team |

## Context Engineering Layer

`.ona/context/` contains structured context files that give agents the right information at the right time. They complement this file — AGENTS.md is the rule set, `.ona/context/` is the knowledge base.

| File | What it contains | Read when |
|---|---|---|
| `.ona/context/decisions.md` | ADR digest + undocumented architectural decisions | Before changing system boundaries, data flows, or agent configuration |
| `.ona/context/debt.md` | Prioritised technical debt with file locations and issue links | Before sprint planning; before touching any file with known stubs |
| `.ona/context/user-stories.md` | Core user stories with acceptance criteria and implementation status | Before implementing a feature or writing tests for a lifecycle stage |
| `.ona/context/traceability.md` | Full-stack map: agent → DB table → repository → API endpoint → frontend hook → UI component | Before touching any lifecycle stage (Hypothesis, Model, Integrity, Narrative, Realization, Expansion) |
| `.ona/context/memory.md` | Lessons learned, anti-patterns, migration history, pre-PR checklist | Before submitting a PR that touches agent code, DB queries, or UI components |
| `.ona/context/tools.md` | Both tool systems (MCP + BFA Semantic), interfaces, registration pattern, current inventory | Before adding a new tool or calling an existing one from agent code |

### Context file staleness — verify before acting

`debt.md` and the `any` dashboard in `docs/debt/ts-any-dashboard.md` are manually maintained and can lag behind the codebase. Before scheduling work based on either file:

1. **Debt entries:** Read the referenced file before treating a debt item as open. If the code no longer matches the description (e.g. methods are implemented, TODOs are gone), mark the item resolved in `debt.md` rather than scheduling it.
2. **`any` counts:** Re-measure with grep before writing sprint targets or claiming a reduction. Do not trust the table values as current.
   ```bash
   grep -rn ": any\b\|as any\b\|<any>" <path> --include="*.ts" --include="*.tsx" | wc -l
   ```
   Exclude test files when reporting production counts:
   ```bash
   grep -rn ": any\b\|as any\b\|<any>" <path> --include="*.ts" --include="*.tsx" \
     | grep -v "__tests__\|\.test\.\|\.spec\." | wc -l
   ```

### When to update these files

- **`decisions.md`** — after a new ADR is accepted, or when an undocumented decision is made that future agents need to know about.
- **`debt.md`** — when debt is resolved (mark it in the Resolved section) or newly discovered. Link GitHub issues.
- **`user-stories.md`** — when a story's implementation status changes (a stage moves from ❌ to ✅).
- **`traceability.md`** — when a new DB table, repository, endpoint, hook, or UI component is added for a lifecycle stage.
- **`memory.md`** — after solving a non-obvious problem, removing a recurring anti-pattern, or completing a significant migration.
- **`tools.md`** — when a new tool is registered or an existing tool's interface changes.

### Relationship to other context sources

These files do not replace existing sources — they index and summarise them for fast agent orientation:

- **`AGENTS.md`** (this file) — non-negotiable rules and coding conventions. Agents must follow these regardless of context.
- **`.windsurf/rules/`** — glob-triggered rules for Windsurf/Cascade. Enforced automatically on file match.
- **`.windsurf/workflows/`** — step-by-step task workflows (add-feature, database-migration, debug-issue, etc.).
- **`docs/engineering/adr/`** — full ADR records. `decisions.md` is a digest; go here for complete rationale.
- **`docs/architecture/`** — detailed architecture documents. `traceability.md` is a navigation aid into these.
