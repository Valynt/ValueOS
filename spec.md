# Agentic Middleware Spec

**Date**: 2026-02-09
**Status**: Draft — awaiting confirmation

---

## Problem Statement

The `UnifiedAgentOrchestrator` currently routes queries using keyword matching (`selectAgent`), has no pre-execution intent validation, no real-time reasoning transparency, and no post-execution quality gate before results reach users. Three middleware layers are needed:

1. **Semantic Intent Middleware** — Replace keyword routing with embedding-based intent classification; handle ambiguous intents via clarification before heavy execution.
2. **Reasoning Logger Middleware** — Capture agent reasoning steps and stream them to the frontend `AgentReasoningViewer` via WebSocket, with PII scrubbing.
3. **Adaptive Refinement Middleware** — Score agent output against user constraints before delivery; auto-retry with a different model if quality is below threshold.

---

## Codebase Context (discovered during exploration)

| Component | Location | State |
|---|---|---|
| `UnifiedAgentOrchestrator` | `packages/backend/src/services/UnifiedAgentOrchestrator.ts` | Has `AgentMiddleware` interface + `middleware[]` array, but the chain is **never executed** in `processQuery`. `IntegrityVetoMiddleware` is registered but called directly instead. |
| `selectAgent()` | Same file, line ~2641 | Keyword-based (`lowerQuery.includes(...)`) routing. This is what Prompt 1 replaces. |
| `VectorSearchService` | `packages/backend/src/services/VectorSearchService.ts` | Queries pgvector via Supabase RPC. Does **not** generate embeddings — only accepts pre-computed vectors. |
| `SemanticMemoryService` | `packages/backend/src/services/SemanticMemory.ts` | Generates embeddings via Together AI (`m2-bert-80M-8k-retrieval`, 768 dims). |
| `ReflectionEngine` | `packages/backend/src/services/ReflectionEngine.ts` | 18-point rubric scoring (0-10). Thresholds: 7.0 overall, 6.5 per category. Has `evaluate()` and `refine()`. |
| `LLMCostTracker` | `packages/backend/src/services/LLMCostTracker.ts` | Tracks per-call cost to `llm_usage` table. `trackUsage()` accepts model, tokens, provider. |
| `CostAwareRouter` | `packages/backend/src/services/CostAwareRouter.ts` | Model hierarchy with budget-aware selection. `selectModel()` picks cheaper models as budget tightens. |
| `LLMGateway` | `packages/backend/src/lib/agent-fabric/LLMGateway.ts` | Multi-provider LLM calls. Uses `CostAwareRouter` + `LLMCostTracker`. |
| WebSocket server | `packages/backend/src/server.ts` line 122 | `WebSocketServer` on `/ws/sdui`. Authenticated, tenant-isolated. Handles `sdui_update` and `ping`. |
| `AgentReasoningViewer` | `apps/ValyntApp/src/views/AgentReasoningViewer.tsx` | Frontend component. Listens for `agent.reasoning.update` events via WebSocket. Expects `ReasoningChain` with `ThoughtNode[]`. |
| `types/intent.ts` | `packages/backend/src/types/intent.ts` | Defines `Intent`, `IntentCategory`, `IntentRecognitionResult`, `ExtractedEntity`, `IntentRoutingDecision`. |
| `IntentRegistry` | `packages/backend/src/services/IntentRegistry.ts` | Maps UI intents to React components (not agent routing). |
| `performReRefine()` | Orchestrator, line ~736 | Existing re-refinement loop: retries with same agent + modified prompt. Max 2 attempts. |
| Express middleware | `packages/backend/src/middleware/` | Standard Express middleware (auth, RBAC, rate limiting, etc.). Separate from agent middleware. |

---

## Design Decisions (defaults chosen — all overridable)

These decisions were made based on codebase analysis. Each is flagged for review.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Build a proper middleware chain** that wraps `processQuery`, and migrate the existing `IntegrityVetoMiddleware` into it. | The interface and array already exist but are unused. Wiring them properly is the right fix — avoids more ad-hoc direct calls. |
| D2 | **Clarification returns a `clarification_needed` response type** that the frontend renders as a form. User resubmits with filled parameters. | Simpler than WebSocket dialog; matches the existing request-response flow of `processQuery`. No new protocol needed. |
| D3 | **Create an `EmbeddingService` abstraction** defaulting to Together AI. | Decouples intent middleware from a specific provider. Reuses existing Together AI config. |
| D4 | **Regex + configurable field-name blocklist** for PII scrubbing. | Fast, no external deps, covers the stated requirements (PII + credentials). NLP-based detection can be added later. |
| D5 | **Configurable threshold**, defaulting to `ReflectionEngine`'s 7.0. | Consistency with existing system, but allows per-agent tuning. |
| D6 | **Upgrade to a more capable model** on retry, using `CostAwareRouter`'s hierarchy. | "Different model" in the prompt implies trying something better, not random. Cost increase is logged as required. |

---

## Requirements

### Middleware Chain Infrastructure

**M0: Wire the `AgentMiddleware` chain into `processQuery`**

The orchestrator already defines:
```typescript
interface AgentMiddleware {
  name: string;
  execute(context: AgentMiddlewareContext, next: () => Promise<AgentResponse>): Promise<AgentResponse>;
}
```

Changes needed:
- Add a `executeMiddlewareChain(context, coreFn)` method that runs `this.middleware` in order, each calling `next()`.
- Replace the direct `evaluateIntegrityVeto` calls in `processQuery` with the chain execution.
- Migrate `IntegrityVetoMiddleware` to run through the chain (it already implements the interface).
- New middleware registration order: **SemanticIntent → ReasoningLogger → [core execution] → AdaptiveRefinement → IntegrityVeto**.
  - SemanticIntent runs *before* execution (pre-middleware).
  - ReasoningLogger wraps execution to capture steps.
  - AdaptiveRefinement and IntegrityVeto run *after* execution (post-middleware).

### Prompt 1: Semantic Intent Middleware

**M1.1: Intent Graph types**

New file: `packages/backend/src/services/middleware/types.ts`

```typescript
interface IntentNode {
  id: string;
  intent: string;                    // e.g., "analyze_roi"
  confidence: number;                // 0-1
  category: IntentCategory;          // from existing types/intent.ts
  parameters: IntentParameter[];
  children: IntentNode[];            // sub-intents
}

interface IntentParameter {
  name: string;
  type: 'string' | 'number' | 'enum' | 'entity';
  required: boolean;
  value?: unknown;                   // filled if resolved
  description: string;
  enumValues?: string[];             // for enum type
}

interface IntentGraph {
  root: IntentNode;
  ambiguityScore: number;            // 0-1, higher = more ambiguous
  missingParameters: IntentParameter[];
  resolvedAgent: AgentType | null;
  historicalMatches: HistoricalIntentMatch[];
}

interface HistoricalIntentMatch {
  intentId: string;
  similarity: number;
  previousAgent: string;
  wasSuccessful: boolean;
}
```

**M1.2: EmbeddingService**

New file: `packages/backend/src/services/middleware/EmbeddingService.ts`

- Wraps Together AI embedding generation (reuses config from `SemanticMemoryService`).
- Single method: `generateEmbedding(text: string): Promise<number[]>`.
- Caches recent embeddings (LRU, 100 entries, 5-min TTL).

**M1.3: SemanticIntentMiddleware**

New file: `packages/backend/src/services/middleware/SemanticIntentMiddleware.ts`

Implements `AgentMiddleware`. Runs **before** core execution.

Flow:
1. Generate embedding for the user query via `EmbeddingService`.
2. Query `VectorSearchService.searchByEmbedding()` for historical intent matches (type filter: `'intent_classification'`).
3. If a high-confidence match exists (similarity ≥ 0.85), use its routing decision directly.
4. Otherwise, classify the query into an `IntentGraph` using an LLM call via `LLMGateway` with a structured prompt that returns JSON.
5. Compute `ambiguityScore` based on: top-2 intent confidence gap, number of missing required parameters.
6. If `ambiguityScore > 0.4` OR any required parameters are missing → return a `clarification_needed` response (short-circuit, don't call `next()`).
7. Otherwise, set `context.agentType` to the resolved agent and call `next()`.
8. After successful execution, store the intent classification as a new vector in semantic memory for future lookups.

**M1.4: Clarification response type**

Extend `AgentResponse.type` union to include `'clarification_needed'`:

```typescript
interface ClarificationPayload {
  message: string;
  missingParameters: IntentParameter[];
  suggestedIntent: string;
  confidence: number;
  originalQuery: string;
}
```

The frontend should render this as a form. When the user fills in parameters and resubmits, the query is re-sent with a `clarification` context field containing the filled parameters, which the middleware uses to skip re-classification.

**M1.5: Intent memory storage**

After successful execution, store:
- The query embedding
- The resolved intent + agent type
- Success/failure outcome
- In the `semantic_memory` table with type `'intent_classification'`

This enables the historical lookup in step 2.

### Prompt 2: Reasoning Logger Middleware

**M2.1: ReasoningLoggerMiddleware**

New file: `packages/backend/src/services/middleware/ReasoningLoggerMiddleware.ts`

Implements `AgentMiddleware`. Wraps core execution.

Flow:
1. Before calling `next()`: create a `ReasoningChain` object with status `'in_progress'`.
2. Broadcast the chain start via WebSocket (`agent.reasoning.update` event type — matches what `AgentReasoningViewer` already listens for).
3. Intercept agent execution by wrapping the `AgentAPI.invokeAgent` call to capture intermediate steps. This is done by:
   - Injecting a `reasoningCallback` into the `AgentContext.metadata` that agents can call to report steps.
   - Wrapping the agent response to extract any `reasoning_steps` or `thought_chain` fields from the response data.
4. For each captured step, create a `ThoughtNode`, run it through the `PrivacyScrubber`, then broadcast via WebSocket.
5. After `next()` completes: broadcast the final chain with status `'completed'` or `'failed'`.

**M2.2: PrivacyScrubber**

New file: `packages/backend/src/services/middleware/PrivacyScrubber.ts`

Regex-based + field-name blocklist:

**Patterns detected and masked:**
- Email addresses → `[EMAIL]`
- Phone numbers (US/international) → `[PHONE]`
- SSN patterns → `[SSN]`
- Credit card numbers (Luhn-valid 13-19 digit sequences) → `[CARD]`
- API keys / tokens (patterns: `sk-`, `pk_`, `Bearer `, `ghp_`, `xoxb-`, etc.) → `[API_KEY]`
- JWT tokens (3 base64 segments separated by dots) → `[JWT]`
- IP addresses → `[IP]`

**Field-name blocklist** (configurable):
Any JSON field whose key matches these patterns has its value replaced with `[REDACTED]`:
`password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `credential`, `ssn`, `credit_card`, `private_key`.

**M2.3: WebSocket broadcast integration**

Use the existing `WebSocketServer` at `/ws/sdui`. Add a new message type handler:

```typescript
// Broadcast to all authenticated clients in the same tenant
function broadcastReasoningUpdate(tenantId: string, chain: ReasoningChain): void
```

The event format matches what `AgentReasoningViewer` expects:
```json
{
  "type": "agent.event",
  "payload": {
    "eventType": "agent.reasoning.update",
    "data": { /* ReasoningChain */ }
  }
}
```

No frontend changes needed — the viewer already handles this event type and merges nodes.

### Prompt 3: Adaptive Refinement Middleware

**M3.1: AdaptiveRefinementMiddleware**

New file: `packages/backend/src/services/middleware/AdaptiveRefinementMiddleware.ts`

Implements `AgentMiddleware`. Runs **after** core execution, **before** IntegrityVeto.

Flow:
1. Call `next()` to get the agent response.
2. If the response is an error or `clarification_needed`, pass through unchanged.
3. Invoke `ReflectionEngine.evaluate()` on the response payload with the original query as context.
4. If `reflectionResult.passesThreshold` is true → return the response as-is.
5. If below threshold:
   a. Log the reflection score and refinement trigger.
   b. Select an upgraded model via `CostAwareRouter` (force `priority: 'high'` to get a more capable model).
   c. Re-invoke the agent with the upgraded model, appending the `ReflectionEngine`'s `refinementPlan` to the prompt.
   d. Track the cost delta via `LLMCostTracker.trackUsage()` with a `caller: 'adaptive_refinement'` tag.
   e. Re-evaluate the refined output. If it passes → return it. If not → return the better-scoring output of the two attempts with a warning annotation.
6. Maximum 1 refinement retry (not a loop — the existing `performReRefine` handles deeper retries).

**M3.2: Cost tracking for refinement**

Each refinement call logs to `LLMCostTracker` with:
- `endpoint: 'adaptive_refinement'`
- `caller: 'AdaptiveRefinementMiddleware'`
- The original model and the upgraded model
- Token counts for both calls

The response metadata includes:
```typescript
interface RefinementMetadata {
  wasRefined: boolean;
  originalScore: number;
  refinedScore?: number;
  originalModel: string;
  refinedModel?: string;
  costIncrease?: number;       // USD delta
  refinementPlan?: string[];
}
```

**M3.3: Integration with existing `performReRefine`**

The `AdaptiveRefinementMiddleware` replaces the inline `performReRefine` logic in `processQuery`. The existing `performReRefine` method remains available for direct use but `processQuery` delegates to the middleware chain instead.

---

## File Plan

All new files go in `packages/backend/src/services/middleware/`:

| File | Purpose |
|---|---|
| `types.ts` | Shared types: `IntentGraph`, `IntentNode`, `IntentParameter`, `ClarificationPayload`, `RefinementMetadata`, `ReasoningStep` |
| `EmbeddingService.ts` | Embedding generation abstraction (Together AI default) |
| `PrivacyScrubber.ts` | PII/credential masking |
| `SemanticIntentMiddleware.ts` | Prompt 1 implementation |
| `ReasoningLoggerMiddleware.ts` | Prompt 2 implementation |
| `AdaptiveRefinementMiddleware.ts` | Prompt 3 implementation |
| `index.ts` | Barrel exports |

Modified files:

| File | Changes |
|---|---|
| `UnifiedAgentOrchestrator.ts` | Add `executeMiddlewareChain()`, wire chain into `processQuery`, register new middleware, extend `AgentResponse.type` |
| `server.ts` | Add `agent.reasoning.update` broadcast helper to WebSocket handler |
| `types/intent.ts` | Add `IntentGraph`-related types if shared beyond middleware |

---

## Acceptance Criteria

Each criterion is independently verifiable.

### Infrastructure (M0)
- [ ] **AC-0.1**: `executeMiddlewareChain()` exists on `UnifiedAgentOrchestrator` and is called by `processQuery` (both sync and async paths).
- [ ] **AC-0.2**: `IntegrityVetoMiddleware` runs through the chain, not via direct `evaluateIntegrityVeto` calls in `processQuery`.
- [ ] **AC-0.3**: Middleware execution order is: SemanticIntent → ReasoningLogger → [core] → AdaptiveRefinement → IntegrityVeto.

### Semantic Intent Middleware (M1)
- [ ] **AC-1.1**: `SemanticIntentMiddleware` implements `AgentMiddleware` and is registered in the chain.
- [ ] **AC-1.2**: Given a query, the middleware generates an embedding and queries `VectorSearchService` for historical matches.
- [ ] **AC-1.3**: If a high-confidence historical match exists (≥ 0.85), the middleware routes to that agent without an LLM call.
- [ ] **AC-1.4**: If no match, the middleware classifies the query into an `IntentGraph` via LLM.
- [ ] **AC-1.5**: If `ambiguityScore > 0.4` or required parameters are missing, a `clarification_needed` response is returned (execution short-circuited).
- [ ] **AC-1.6**: After successful execution, the intent + embedding is stored in `semantic_memory` with type `'intent_classification'`.
- [ ] **AC-1.7**: `EmbeddingService` generates embeddings via Together AI and caches results.

### Reasoning Logger Middleware (M2)
- [ ] **AC-2.1**: `ReasoningLoggerMiddleware` implements `AgentMiddleware` and is registered in the chain.
- [ ] **AC-2.2**: A `ReasoningChain` is broadcast via WebSocket at start (`in_progress`) and end (`completed`/`failed`) of execution.
- [ ] **AC-2.3**: The broadcast event format matches `{ type: 'agent.event', payload: { eventType: 'agent.reasoning.update', data: ReasoningChain } }`.
- [ ] **AC-2.4**: `PrivacyScrubber` masks emails, phone numbers, SSNs, credit cards, API keys, JWTs, and IP addresses in reasoning content.
- [ ] **AC-2.5**: `PrivacyScrubber` redacts values of JSON fields matching the blocklist (`password`, `secret`, `token`, etc.).
- [ ] **AC-2.6**: No PII or credentials appear in WebSocket broadcasts (verified by unit tests with known PII patterns).

### Adaptive Refinement Middleware (M3)
- [ ] **AC-3.1**: `AdaptiveRefinementMiddleware` implements `AgentMiddleware` and is registered in the chain.
- [ ] **AC-3.2**: After core execution, the middleware evaluates the response via `ReflectionEngine.evaluate()`.
- [ ] **AC-3.3**: If the score passes threshold (default 7.0), the response is returned unchanged.
- [ ] **AC-3.4**: If below threshold, the middleware re-invokes the agent with an upgraded model and the refinement plan.
- [ ] **AC-3.5**: The cost of the refinement call is logged via `LLMCostTracker.trackUsage()` with `caller: 'AdaptiveRefinementMiddleware'`.
- [ ] **AC-3.6**: The response includes `RefinementMetadata` indicating whether refinement occurred, scores, models used, and cost delta.
- [ ] **AC-3.7**: Maximum 1 refinement retry per request (no infinite loops).

### General
- [ ] **AC-G.1**: All new files have unit tests (in `__tests__/` co-located or in the middleware directory).
- [ ] **AC-G.2**: TypeScript compiles without errors (`pnpm typecheck` passes for the backend package).
- [ ] **AC-G.3**: No new runtime dependencies added (uses existing `ws`, `zod`, `@supabase/supabase-js`).
- [ ] **AC-G.4**: Existing `processQuery` behavior is preserved when all middleware is disabled (feature flag or empty chain).

---

## Completion Criteria (Ralph Loop)

The implementation is **done** when:

1. All files in the File Plan exist with complete implementations (not stubs).
2. All acceptance criteria (AC-0.x through AC-G.x) pass.
3. `pnpm typecheck` passes for the backend package (or the specific files compile without errors if full typecheck has pre-existing failures).
4. Unit tests exist and pass for: `PrivacyScrubber`, `EmbeddingService`, `SemanticIntentMiddleware`, `ReasoningLoggerMiddleware`, `AdaptiveRefinementMiddleware`, and `executeMiddlewareChain`.
5. The middleware chain is wired into `processQuery` and the existing `IntegrityVetoMiddleware` runs through it.

---

## Out of Scope

- Frontend changes to `AgentReasoningViewer` (it already handles the event format).
- Frontend clarification form UI (the response type is defined; frontend rendering is separate work).
- Database migrations for new `semantic_memory` types (the existing table and `search_semantic_memory` RPC support arbitrary types).
- NLP-based PII detection (regex + blocklist is the initial scope).
- Changes to individual agent implementations to emit reasoning steps (the middleware captures what's available from responses).
