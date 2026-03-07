# Agent Fabric Footguns

Repo-specific traps that are not obvious from reading the code once.

---

## 1. `this.organizationId` vs `context.organization_id`

These are not interchangeable.

- `this.organizationId` — set once in the constructor from the factory call. Use this as the **last argument** to `storeSemanticMemory` (the tenant scope for the write).
- `context.organization_id` — the org from the current request. Use this inside metadata objects and for `retrieve` filters.

Both must be present. Using only one silently breaks either the write scope or the read filter.

```typescript
// ✅
await this.memorySystem.storeSemanticMemory(
  context.workspace_id,
  this.name,
  "episodic",
  content,
  { organization_id: context.organization_id }, // metadata filter
  this.organizationId,                           // write scope — last arg
);

// ❌ Missing last arg — write is not tenant-scoped
await this.memorySystem.storeSemanticMemory(
  context.workspace_id, this.name, "episodic", content,
  { organization_id: context.organization_id },
);
```

---

## 2. `buildOutput` vs `prepareOutput`

`prepareOutput` exists but is a legacy stub — it hardcodes `"medium"` confidence and `0ms` execution time. Always use `buildOutput`.

```typescript
// ✅
return this.buildOutput(result, "success", confidenceLevel, startTime, { reasoning });

// ❌ Loses confidence signal and timing data
return await this.prepareOutput(result, "success");
```

---

## 3. Direct `llmGateway.complete()` calls

Calling `llmGateway.complete()` directly bypasses the circuit breaker, hallucination detection, and Zod validation that `secureInvoke` provides. The linter will not catch this — it is a runtime safety gap.

```typescript
// ✅
const result = await this.secureInvoke(sessionId, prompt, MySchema, options);

// ❌ No circuit breaker, no hallucination check, no Zod validation
const raw = await this.llmGateway.complete(prompt);
```

---

## 4. `AgentFactory` registration order matters

`FABRIC_AGENT_CLASSES`, `AGENT_LIFECYCLE_MAP`, and `STAGE_AGENT_TYPE_MAP` are three separate maps. Missing any one of them causes silent failures:

- Missing from `FABRIC_AGENT_CLASSES` → `factory.create("x")` throws at runtime
- Missing from `AGENT_LIFECYCLE_MAP` → agent gets `lifecycleStage = "opportunity"` (the fallback default)
- Missing from `STAGE_AGENT_TYPE_MAP` → `factory.createForStage(stage, orgId)` silently routes to the wrong agent

---

## 5. `lifecycleStage` is set by the constructor, not your `public readonly`

`BaseAgent`'s constructor does `this.lifecycleStage = config.lifecycle_stage`. Your `public readonly lifecycleStage = "x"` declaration is overwritten at construction time by whatever `AgentFactory` passes in `config.lifecycle_stage`.

The source of truth is `AGENT_LIFECYCLE_MAP` in `AgentFactory.ts`. Keep your class declaration and the map entry in sync — the class declaration serves as documentation, not the runtime value.

---

## 6. Named export only

`export default class XAgent` will compile but breaks the import pattern used everywhere in the fabric. Use `export class XAgent`.

---

## 7. Test file location

Tests must live in `__tests__/` inside the `agents/` directory:

```
packages/backend/src/lib/agent-fabric/agents/__tests__/XAgent.test.ts
```

A test placed anywhere else will not be picked up by `pnpm test` without explicit path targeting.

---

## 8. `vi.hoisted` is required for mock functions used in `vi.mock` factories

If you reference a `vi.fn()` inside a `vi.mock(...)` factory without hoisting it first, Vitest will throw a reference error at runtime because `vi.mock` is hoisted before variable declarations.

```typescript
// ✅
const { mockComplete } = vi.hoisted(() => ({ mockComplete: vi.fn() }));
vi.mock("../../LLMGateway.js", () => ({ LLMGateway: class { complete = mockComplete; } }));

// ❌ ReferenceError at test runtime
const mockComplete = vi.fn();
vi.mock("../../LLMGateway.js", () => ({ LLMGateway: class { complete = mockComplete; } }));
```
