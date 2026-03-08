---
name: agent-onboarding
description: |
  Scaffold, validate, and onboard new agents into the ValueOS agent-fabric.
  Use when asked to create a new agent, add an agent to the fabric, review an
  existing agent for compliance, or check agent code against BaseAgent conventions.
  Triggers: "new agent", "add agent", "create agent", "agent scaffold",
  "agent onboarding", "agent compliance", "agent review", "fabric agent".
---

# Agent Onboarding

Standard for creating and registering agents in `packages/backend/src/lib/agent-fabric/agents/`.

## Workflow

### Step 1: Gather requirements

Determine:
1. **Agent name** (e.g., `Pricing`) → file will be `PricingAgent.ts`
2. **Lifecycle stage** — one of: `opportunity`, `target`, `modeling`, `integrity`, `realization`, `expansion`
3. **Risk tier** — determines confidence thresholds (financial / commitment / discovery)
4. **Upstream agents** this agent reads from (for memory retrieval)
5. **What it writes to memory** for downstream agents

### Step 2: Create the agent file

Location: `packages/backend/src/lib/agent-fabric/agents/XAgent.ts`

Copy [references/agent-template.ts](references/agent-template.ts) and replace all `X`/`XAgent` placeholders.

Key rules (non-negotiable):
- Extend `BaseAgent`
- Declare `public readonly lifecycleStage`, `version`, `name`
- Use `this.secureInvoke(sessionId, prompt, ZodSchema, options)` — never `llmGateway.complete()` directly
- Zod schema must include `hallucination_check: z.boolean().optional()`
- Every `memorySystem.retrieve(...)` must include `organization_id: context.organization_id`
- Every `memorySystem.storeSemanticMemory(...)` must pass `this.organizationId` as the last argument
- Named export only — no `export default`
- No `any` — use `unknown` + type guards or Zod `.parse()`

Confidence thresholds by risk tier:

| Tier | `low` | `high` |
|---|---|---|
| Financial | 0.7 | 0.9 |
| Commitment | 0.6 | 0.85 |
| Discovery | 0.5 | 0.8 |

### Step 3: Register in AgentFactory

File: `packages/backend/src/lib/agent-fabric/AgentFactory.ts`

Add in three places:

```typescript
// 1. Import
import { XAgent } from "./agents/XAgent.js";

// 2. AGENT_LIFECYCLE_MAP
const AGENT_LIFECYCLE_MAP: Record<string, LifecycleStage> = {
  // ...existing entries...
  "x": "x-stage",
};

// 3. FABRIC_AGENT_CLASSES
const FABRIC_AGENT_CLASSES = {
  // ...existing entries...
  "x": XAgent,
};
```

If the agent owns a lifecycle stage, also add to `STAGE_AGENT_TYPE_MAP`.

### Step 4: Write the test

Location: `packages/backend/src/lib/agent-fabric/agents/__tests__/XAgent.test.ts`

Follow the pattern in `ExpansionAgent.test.ts` (same directory):
- Hoist mocks with `vi.hoisted`
- Mock `LLMGateway`, `MemorySystem`, `CircuitBreaker` via `vi.mock`
- `vi.clearAllMocks()` in `beforeEach`
- Test: happy path returns `status === "success"`
- Test: LLM failure returns `status === "failure"`
- Test: `mockRetrieve` / `mockStoreSemanticMemory` called with `organization_id: "org-456"`
- Test: missing `organization_id` throws

### Step 5: Verify compliance and run tests

Use [references/compliance-checklist.md](references/compliance-checklist.md) to self-audit before finishing.

Before writing any code, read [references/footguns.md](references/footguns.md) — it lists repo-specific traps that are not obvious from reading the source once (e.g. `this.organizationId` vs `context.organization_id`, `buildOutput` vs `prepareOutput`, `vi.hoisted` in tests).

```bash
pnpm test -- packages/backend/src/lib/agent-fabric/agents/__tests__/XAgent.test.ts
pnpm run lint
```

## Completion report

After finishing, produce a summary with these fields (omit any that don't apply):

```
Agent created:      packages/backend/src/lib/agent-fabric/agents/XAgent.ts
Factory updated:    packages/backend/src/lib/agent-fabric/AgentFactory.ts
Test created:       packages/backend/src/lib/agent-fabric/agents/__tests__/XAgent.test.ts
Commands run:       pnpm test -- ...XAgent.test.ts  →  X passed
                    pnpm run lint  →  no errors
Unresolved:         [any open questions or deferred items]
```

If lint or tests failed, state what failed and why before marking the task done.

## Do not proceed if

Stop and surface the issue to the user before continuing if any of the following are true:

- `BaseAgent` no longer has `buildOutput` — the template's return calls will be wrong
- The agent type string you chose already exists in `FABRIC_AGENT_CLASSES` — you would silently overwrite an existing agent
- `organization_id` is absent from `context` at the point of memory retrieval or storage — tenant isolation is broken
- `this.secureInvoke` is not available on `BaseAgent` in the current branch — the LLM call path is unsafe
- The agent's Zod schema does not compile — `secureInvoke` will throw at runtime, not build time

## Anti-patterns

| Pattern | Fix |
|---|---|
| `llmGateway.complete()` called directly | Use `this.secureInvoke(...)` |
| `memorySystem.retrieve(...)` without `organization_id` | Add `organization_id: context.organization_id` |
| `storeSemanticMemory(...)` without `this.organizationId` as last arg | Pass `this.organizationId` |
| `as any` in method signatures | Use Zod schema + inferred type |
| `export default class XAgent` | Use `export class XAgent` |
| Raw user input concatenated into prompt | Validate inputs first; use template interpolation |
