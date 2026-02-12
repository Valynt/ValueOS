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

## Global Safety and Compliance Rules

**Systemic Safety:**
- Block dangerous commands: SQL destructive ops (DROP, TRUNCATE without WHERE), shell cmds (rm -rf, sudo), process manipulation (kill -9), credential exposure
- Network allowlist: Internal (\*.supabase.co, localhost), LLM providers (api.together.ai, api.openai.com, api.anthropic.com), monitoring (_.sentry.io, _.datadoghq.com), CDN (_.cloudflare.com, _.fastly.net); block GitHub (_.github.com, _.githubusercontent.com), pastebin (_.pastebin.com), ngrok (_.ngrok.io), serveo (\*.serveo.net) (blocked in production for data exfiltration prevention)
- Recursion depth limit: Dev 10, Staging 7, Prod 5

**Data Sovereignty:**
- Tenant isolation: All DB ops include tenant_id
- Block cross-tenant data transfer

**PII Protection:**
- Detect/block PII: SSN, CC, emails, phones, passports, DOB, healthcare IDs
- Prevent PII in logs

**Cost Control:**
- Reasoning loop limits: Dev 20 steps/50 calls, Staging 15/30, Prod 10/20

See `.windsurf/rules/global.md` for full details.

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
# GitHub Copilot Instructions for ValueOS (Concise)

Purpose: give AI coding agents the minimal, actionable knowledge to be productive in this monorepo.

- Architecture snapshot: monorepo (pnpm workspaces). Frontend apps in `apps/`, services and libraries in `packages/`. Key systems: Supabase (Postgres + RLS), Node backend, Agent Fabric, Vector Memory, MessageBus (CloudEvents).

- Non-negotiables:
  - Tenant isolation: every DB, memory, or vector query MUST include `organization_id` or `tenant_id`. See `supabase` usage in `src/lib/supabase.ts` and RLS tests in `supabase/tests/database/rls_policies.test.sql`.
  - All LLM calls in production agents use `secureInvoke()` from `src/lib/agent-fabric/agents/BaseAgent.ts` (circuit breaker, hallucination detection, Zod validation). NEVER call LLMs directly.
  - `service_role` bypasses RLS — use only for AuthService, tenant provisioning, and cron jobs.

- Quick developer commands:
  - Setup: `pnpm run setup`
  - Full stack (dev DX): `pnpm run dx`
  - Frontend dev only: `pnpm run dev`
  - Run tests: `pnpm run test` (vitest sequential); RLS validation: `pnpm run test:rls`
  - Agent security suite: `bash scripts/test-agent-security.sh`

- Agent patterns (concrete):
  - File location: `src/lib/agent-fabric/agents/` — one class per agent named `XAgent.ts`.
  - Must extend `BaseAgent` and define `lifecycleStage`, `version`, `name`.
  - Use Zod schemas and include `hallucination_check: boolean` in responses.
  - Example pattern: `await this.secureInvoke(sessionId, prompt, schema, { trackPrediction: true })` then `await this.memorySystem.storeSemanticMemory(..., this.organizationId)`.

- Workflows & messaging:
  - DAG definitions: `src/data/lifecycleWorkflows.ts`. Execution: `WorkflowOrchestrator.executeWorkflow()`.
  - Inter-agent communication must use `MessageBus` (CloudEvents) and propagate `trace_id`.

- Project-specific conventions:
  - Path aliases: `@lib/*`, `@services/*`, `@components/*` (see `tsconfig.json`).
  - SDUI components: register in `config/ui-registry.json` AND `src/sdui/registry.tsx`.
  - Prompts via Handlebars templates (no string concatenation).
  - Tools are statically registered in `ToolRegistry.ts`.

- Safety & policies:
  - See `.windsurf/rules/` for policy-as-code covering network allowlists, dangerous-command blocking, PII rules, recursion/cost limits, and multi-tenant enforcement.

- Quick file pointers:
  - `src/lib/agent-fabric/agents/BaseAgent.ts` (secureInvoke pattern)
  - `src/lib/agent-fabric/MemorySystem.ts` (tenant-scoped memory)
  - `src/services/WorkflowOrchestrator.ts` and `src/services/MessageBus.ts`
  - `.windsurf/rules/` for safety and AI guidance

If anything here is unclear or you want more examples (a test scaffold, new agent template, or CI steps), tell me which area to expand.
// ✅ CORRECT - Always fetch user context
