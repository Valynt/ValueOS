# Agent Compliance Checklist

Run through this list before marking an agent implementation complete.

## File & Export

- [ ] File is named `XAgent.ts` (PascalCase, `Agent` suffix)
- [ ] Located at `packages/backend/src/lib/agent-fabric/agents/XAgent.ts`
- [ ] Class uses a **named export** — no `export default`
- [ ] `public readonly lifecycleStage`, `version`, and `name` are declared

## TypeScript

- [ ] No `any` types — use `unknown` + type guards or Zod `.parse()`
- [ ] Strict mode passes: `pnpm run lint`

## LLM Calls

- [ ] All LLM calls go through `this.secureInvoke(...)` — no direct `llmGateway.complete()` calls
- [ ] Zod schema passed to `secureInvoke` includes `hallucination_check: z.boolean().optional()`
- [ ] Confidence thresholds match the agent's risk tier:
  - Financial: `{ low: 0.7, high: 0.9 }`
  - Commitment: `{ low: 0.6, high: 0.85 }`
  - Discovery: `{ low: 0.5, high: 0.8 }`

## Prompts

- [ ] Prompt is built via Handlebars-style template or string interpolation of **safe, pre-validated** values — no raw user input concatenated directly

## Tenant Isolation

- [ ] Every `memorySystem.retrieve(...)` call includes `organization_id: context.organization_id`
- [ ] Every `memorySystem.storeSemanticMemory(...)` call passes `this.organizationId` as the last argument
- [ ] Every Supabase query (if any) includes `.eq("organization_id", orgId)`
- [ ] No cross-tenant data transfer

## AgentFactory Registration

- [ ] Import added to `AgentFactory.ts`
- [ ] Entry added to `FABRIC_AGENT_CLASSES` map with the correct string key
- [ ] Entry added to `AGENT_LIFECYCLE_MAP` with the correct `LifecycleStage`
- [ ] Entry added to `STAGE_AGENT_TYPE_MAP` if the agent owns a lifecycle stage

## Output method

- [ ] Agent returns via `this.buildOutput(result, status, confidence, startTime, extra?)` — **not** `this.prepareOutput()`
  - `prepareOutput` is a legacy stub: hardcodes `"medium"` confidence and `0` execution time. It exists only for backward compatibility and must not be used in new agents.
  - `buildOutput` signature: `(result, status, confidence, startTime, { reasoning?, suggested_next_actions?, warnings? }?)`

## Tests

- [ ] Co-located test at `packages/backend/src/lib/agent-fabric/agents/__tests__/XAgent.test.ts`
- [ ] `LLMGateway`, `MemorySystem`, and `CircuitBreaker` are mocked via `vi.mock`
- [ ] `vi.clearAllMocks()` called in `beforeEach`
- [ ] Happy path: `execute()` returns `status === "success"`
- [ ] Failure path: LLM error returns `status === "failure"`
- [ ] Tenant isolation: `mockRetrieve` / `mockStoreSemanticMemory` called with `organization_id`
- [ ] Input validation: missing `organization_id` throws

## Run Verification

```bash
pnpm test -- packages/backend/src/lib/agent-fabric/agents/__tests__/XAgent.test.ts
pnpm run lint
```
