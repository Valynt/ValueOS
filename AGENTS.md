# AGENTS.md — ValueOS

Single source of truth for AI coding agents. Tool-specific configs (`.github/copilot-instructions.md`, `.windsurf/rules/`, `GEMINI.md`) should reference this file rather than duplicate its content.

## Architecture

pnpm monorepo. Frontend apps in `apps/` (ValyntApp, VOSAcademy, mcp-dashboard). Libraries and services in `packages/` (agents, agent-fabric, backend, components, infra, integrations, mcp, memory, sdui, sdui-types, services, shared, test-utils, config-v2).

**Stack:** React + Vite + Tailwind (frontend), Node.js + Express (backend), Supabase (Postgres + RLS + Auth + Realtime), Redis, BullMQ queues, CloudEvents messaging.

**Agent system:** 6-agent fabric in `packages/backend/src/lib/agent-fabric/`. Agents: OpportunityAgent, TargetAgent, FinancialModelingAgent, IntegrityAgent, RealizationAgent, ExpansionAgent. Orchestration via `UnifiedAgentOrchestrator`. Vector memory with tenant-scoped queries. Inter-agent messaging via `MessageBus` (CloudEvents).

**Standalone agents (deprecated):** Express-based microservices in `packages/agents/` (opportunity, target, integrity, realization, expansion, financial-modeling) use mock data and are superseded by the agent-fabric implementations. Do not extend these — use the fabric agents instead.

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

    return this.prepareOutput(result, "completed");
  }
}
```

## Workflows & Messaging

- DAG definitions: `packages/backend/src/data/lifecycleWorkflows.ts`
- Orchestration: `UnifiedAgentOrchestrator` in `packages/backend/src/services/`
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
| `packages/backend/src/runtime/decision-router/` | DecisionRouter — selects agent/action based on workflow state. Extracted from UnifiedAgentOrchestrator in Sprint 2. Sprint 5 target: replace keyword routing with domain-state decisioning. |
| `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts` | `secureInvoke`, hallucination detection, agent base class |
| `packages/backend/src/lib/agent-fabric/agents/OpportunityAgent.ts` | Hypothesis generation (OPPORTUNITY phase) |
| `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts` | KPI target generation (DRAFTING phase) |
| `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts` | Financial model, ROI, sensitivity analysis |
| `packages/backend/src/lib/agent-fabric/agents/IntegrityAgent.ts` | Claim validation, veto decisions (VALIDATING phase) |
| `packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts` | Implementation plans, milestones (REALIZATION phase) |
| `packages/backend/src/lib/agent-fabric/agents/ExpansionAgent.ts` | Growth opportunities, expansion strategies (EXPANSION phase) |
| `packages/backend/src/lib/agent-fabric/AgentFactory.ts` | Agent instantiation with dependency injection |
| `packages/backend/src/lib/agent-fabric/MemorySystem.ts` | Tenant-scoped in-memory store (to be replaced with pgvector) |
| `packages/backend/src/lib/agents/` | Agent core library — migrated from deleted `packages/agents/` in Sprint 2 (ValueCaseSaga, EvidenceTiering, ConfidenceScorer, HypothesisLoop, RedTeamAgent) |
| `packages/memory/` | Persistent memory subsystem (semantic, episodic, vector, provenance) |
| `packages/backend/src/services/UnifiedAgentOrchestrator.ts` | Agent orchestration — **@frozen**, decomposition target Sprint 4 |
| `packages/backend/src/services/MessageBus.ts` | CloudEvents inter-agent messaging |
| `packages/backend/src/services/ToolRegistry.ts` | Static tool registration |
| `.windsurf/rules/global.md` | Safety and compliance policy |
| `.github/CODEOWNERS` | Review routing by team |
