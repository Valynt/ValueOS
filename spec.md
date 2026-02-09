# Spec: Agent Middleware Pipeline — Checkpoint, Handover, and Adversarial I/O

## Problem Statement

The `UnifiedAgentOrchestrator` defines an `AgentMiddleware` interface and maintains a `middleware[]` array, but:

1. The pipeline is **not wired** into the execution flow (`processQuery`, `executeStage`).
2. Only one middleware exists (`IntegrityVetoMiddleware`), and it runs inline rather than through the pipeline.
3. Three middleware capabilities are missing:
   - **Checkpoint (HITL)**: No mechanism to pause agent execution for human approval of high-risk actions.
   - **Handover**: No middleware-level mechanism for agents to delegate sub-tasks to other agents mid-execution.
   - **Adversarial I/O**: Safety checks (`SafetyGuard`, `inputValidation`) exist but are scattered across the codebase, not consolidated into the middleware pipeline.

## Scope

This work delivers four things:

1. **Pipeline wiring** — Connect the `middleware[]` array into `processQuery()` and `executeStage()`.
2. **CheckpointMiddleware** — HITL approval gate for high-risk actions.
3. **HandoverMiddleware** — Inter-agent sub-task delegation within the pipeline.
4. **AdversarialIOMiddleware** — Consolidated input/output safety screening.

All middleware implements the existing `AgentMiddleware` interface:

```typescript
export interface AgentMiddleware {
  name: string;
  execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>
  ): Promise<AgentResponse>;
}
```

## Requirements

### 1. Pipeline Wiring

**Location**: `packages/backend/src/services/UnifiedAgentOrchestrator.ts`

- Add a private method `executeWithMiddleware(context: AgentMiddlewareContext, handler: () => Promise<AgentResponse>): Promise<AgentResponse>` that chains `this.middleware` in order, calling `next()` to proceed.
- Call `executeWithMiddleware` in `processQuery()` (synchronous path, wrapping the agent invocation + integrity checks at ~line 1350) and in `executeStage()` (wrapping the `messageBroker.sendToAgent` call at ~line 2370).
- The existing `IntegrityVetoMiddleware` continues to work as-is through the pipeline.
- Middleware execution order: `AdversarialIOMiddleware` → `CheckpointMiddleware` → `HandoverMiddleware` → `IntegrityVetoMiddleware` → agent call.

### 2. CheckpointMiddleware (HITL)

**File**: `packages/backend/src/services/middleware/CheckpointMiddleware.ts`

**Behavior**:
- Before calling `next()`, inspect the `AgentMiddlewareContext` to determine if the action is high-risk.
- High-risk determination is based on a configurable `RiskClassifier`:
  - Action type matches a configurable list (e.g., `crm_write`, `financial_calculation`, `data_export`, `destructive_action`).
  - The classifier checks `context.agentType`, `context.envelope.intent`, and `context.payload`.
- If high-risk:
  1. Generate a unique `checkpointId` (UUID).
  2. Serialize the current `AgentMiddlewareContext` to `WorkspaceStateService` under key `checkpoint:{checkpointId}`.
  3. Push a `human_intervention_required` notification via `RealtimeUpdateService.pushUpdate()` containing the `checkpointId`, action description, risk level, and requesting user.
  4. Create a record in the `approval_requests` table (via the existing Supabase RPC or direct insert) with status `pending`.
  5. Await resolution via a `Promise` stored in an in-memory `Map<string, { resolve, reject, timeout }>`.
  6. **Timeout**: Configurable, default 30 minutes. On timeout, reject with a `CheckpointTimeoutError` and return a message-type `AgentResponse` indicating the action was aborted.
- If not high-risk, call `next()` directly.

**Resume mechanism**:
- New REST endpoint: `POST /api/checkpoints/:checkpointId/approve` and `POST /api/checkpoints/:checkpointId/reject`.
- **File**: `packages/backend/src/api/checkpoints.ts`
- The endpoint validates the checkpoint exists and is pending, then resolves/rejects the stored Promise.
- On approval: the middleware calls `next()` and returns the result.
- On rejection: returns a message-type `AgentResponse` with rejection reason.
- The endpoint requires authentication (existing auth middleware).

**Types**:

```typescript
interface CheckpointRecord {
  checkpointId: string;
  agentType: AgentType;
  intent: string;
  riskLevel: 'medium' | 'high' | 'critical';
  riskReason: string;
  serializedContext: string; // JSON of AgentMiddlewareContext
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  timeoutMs: number;
}

interface RiskClassification {
  isHighRisk: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  requiresApproval: boolean;
}
```

**Configuration**:

```typescript
interface CheckpointConfig {
  enabled: boolean;
  defaultTimeoutMs: number; // default: 1_800_000 (30 min)
  highRiskIntents: string[]; // e.g., ['crm_write', 'financial_calculation', 'data_export']
  highRiskAgentTypes: AgentType[]; // e.g., ['financial-modeling']
  bypassRoles?: string[]; // roles that skip checkpoint (e.g., 'admin')
}
```

### 3. HandoverMiddleware

**File**: `packages/backend/src/services/middleware/HandoverMiddleware.ts`

**Behavior**:
- After calling `next()`, inspect the `AgentResponse` for a `CapabilityRequest` signal in the payload.
- A `CapabilityRequest` is a structured object embedded in the response payload indicating the current agent needs a sub-task performed by another agent or tool.
- When detected:
  1. Use `AgentRegistry` to find an agent with the requested capability (via `IAgent.getCapabilities()` / `AgentCapability` matching).
  2. If no agent found, check `ToolRegistry` for an MCP tool matching the capability.
  3. Use `AgentMessageBroker.sendToAgent()` to dispatch the sub-task to the target agent, passing the `CapabilityRequest.inputData` as payload.
  4. Map the response data back using the `CapabilityRequest.outputMapping` (field name remapping).
  5. Merge the sub-task result into the original `AgentResponse.payload` under the key specified by `CapabilityRequest.mergeKey`.
  6. Return the enriched response.
- If no `CapabilityRequest` in the response, return the response as-is.
- If the target agent/tool is not found, log a warning and return the original response with a `warnings` field appended.

**Types**:

```typescript
interface CapabilityRequest {
  capability: string; // e.g., 'financial_projection'
  inputData: Record<string, unknown>;
  outputMapping?: Record<string, string>; // { sourceField: targetField }
  mergeKey: string; // where to place result in parent response
  priority?: 'low' | 'normal' | 'high';
  timeoutMs?: number; // default: 15_000
}

interface HandoverResult {
  success: boolean;
  targetAgent?: string;
  targetTool?: string;
  data?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}
```

**Integration points**:
- `AgentRegistry` — agent lookup by capability.
- `AgentMessageBroker` — dispatch sub-task.
- `ToolRegistry` — fallback tool lookup.
- `AgentCollaborationService` — log the handover as a collaboration event for observability.

### 4. AdversarialIOMiddleware

**File**: `packages/backend/src/services/middleware/AdversarialIOMiddleware.ts`

**Behavior**:
- **Input screening** (before `next()`):
  1. Run the query (`context.query`) through consolidated pattern checks:
     - Jailbreak patterns from `SafetyGuard.blockedKeywords` (prompt injection).
     - Injection patterns from `SafetyGuard.injectionPatterns` (XSS/script).
     - Prompt injection patterns from `inputValidation.ts` PATTERNS.promptInjection.
  2. If a violation is detected:
     - Log a security event via `AuditLogService.logAudit()` with action `security:input_violation`, including the violation type and sanitized input excerpt.
     - Return a safe fallback `AgentResponse` of type `message` with a generic safe message (no details about what was detected).
     - Do NOT call `next()`.

- **Output screening** (after `next()`):
  1. Run the `AgentResponse.payload` (stringified) through `SafetyGuard.validateOutput()`.
  2. Check for hallucination indicators against the Ground Truth database using `GroundtruthAPI.evaluate()` — but only if the GroundtruthAPI is configured (`isConfigured()` returns true). If not configured, skip this check.
  3. If output violation detected:
     - Log a security event via `AuditLogService.logAudit()` with action `security:output_violation`.
     - Replace the response with a safe fallback message.
  4. If hallucination detected (ground truth check fails):
     - Log via `AuditLogService.logAudit()` with action `security:hallucination_detected`.
     - Replace the response with a safe fallback message indicating the response could not be verified.

- **No LLM calls** — all checks are regex/pattern-based for input, and GroundtruthAPI (external service, not LLM) for output.

**Configuration**:

```typescript
interface AdversarialIOConfig {
  enabled: boolean;
  inputScreening: {
    enabled: boolean;
    blockedKeywords: string[];
    injectionPatterns: RegExp[];
    promptInjectionPatterns: RegExp[];
    maxInputLength: number; // default: 2000
  };
  outputScreening: {
    enabled: boolean;
    blockedKeywords: string[];
    enableGroundTruthCheck: boolean;
  };
  fallbackMessage: string; // default: "I'm unable to process this request. Please rephrase your query."
  outputFallbackMessage: string; // default: "The response could not be verified for accuracy. Please try again."
}
```

## File Structure

```
packages/backend/src/services/middleware/
├── CheckpointMiddleware.ts
├── HandoverMiddleware.ts
├── AdversarialIOMiddleware.ts
├── types.ts                          # Shared types (CapabilityRequest, CheckpointRecord, etc.)
├── RiskClassifier.ts                 # Risk classification logic for CheckpointMiddleware
└── __tests__/
    ├── CheckpointMiddleware.test.ts
    ├── HandoverMiddleware.test.ts
    ├── AdversarialIOMiddleware.test.ts
    └── RiskClassifier.test.ts

packages/backend/src/api/
└── checkpoints.ts                    # REST endpoints for checkpoint approve/reject
```

## Changes to Existing Files

| File | Change |
|---|---|
| `packages/backend/src/services/UnifiedAgentOrchestrator.ts` | Add `executeWithMiddleware()` method. Wire into `processQuery()` and `executeStage()`. Register new middlewares in `initializeMiddleware()`. |
| `packages/backend/src/api/index.ts` (or equivalent router mount) | Mount `/api/checkpoints` router. |

## Acceptance Criteria

### Pipeline Wiring
- [ ] `executeWithMiddleware()` chains all registered middlewares in order.
- [ ] `processQuery()` synchronous path invokes agent through the middleware pipeline.
- [ ] `executeStage()` invokes agent through the middleware pipeline.
- [ ] Existing `IntegrityVetoMiddleware` continues to function correctly through the pipeline.

### CheckpointMiddleware
- [ ] High-risk actions (matching configured intents/agent types) pause execution and await approval.
- [ ] Context is serialized to `WorkspaceStateService`.
- [ ] A `human_intervention_required` notification is pushed via `RealtimeUpdateService`.
- [ ] `POST /api/checkpoints/:id/approve` resolves the pending checkpoint and execution continues.
- [ ] `POST /api/checkpoints/:id/reject` aborts the action and returns a rejection response.
- [ ] Unapproved checkpoints timeout after the configured duration (default 30 min) and return an abort response.
- [ ] Non-high-risk actions pass through without pausing.

### HandoverMiddleware
- [ ] Responses containing a `CapabilityRequest` trigger a sub-task dispatch.
- [ ] The middleware locates the target agent via `AgentRegistry` capability matching.
- [ ] Falls back to `ToolRegistry` if no agent matches.
- [ ] Sub-task results are mapped and merged into the original response.
- [ ] Missing capabilities produce a warning, not an error.
- [ ] Responses without `CapabilityRequest` pass through unchanged.

### AdversarialIOMiddleware
- [ ] Input containing jailbreak/injection patterns is blocked before reaching the agent.
- [ ] Blocked inputs produce a safe fallback response (no violation details leaked).
- [ ] All input violations are logged to `AuditLogService` with action `security:input_violation`.
- [ ] Agent output is screened for blocked content.
- [ ] If `GroundtruthAPI` is configured, output is checked for hallucination.
- [ ] Output violations are logged to `AuditLogService` with action `security:output_violation` or `security:hallucination_detected`.
- [ ] Violated outputs are replaced with a safe fallback message.

### Tests
- [ ] Unit tests for `CheckpointMiddleware` with mocked `WorkspaceStateService`, `RealtimeUpdateService`, and approval resolution.
- [ ] Unit tests for `HandoverMiddleware` with mocked `AgentRegistry`, `AgentMessageBroker`, and `ToolRegistry`.
- [ ] Unit tests for `AdversarialIOMiddleware` with mocked `AuditLogService`, `SafetyGuard`, and `GroundtruthAPI`.
- [ ] Unit tests for `RiskClassifier`.
- [ ] All tests use vitest with the project's existing mock patterns.

## Implementation Approach

1. **Create shared types** (`middleware/types.ts`) — `CapabilityRequest`, `CheckpointRecord`, `RiskClassification`, `HandoverResult`, configs.
2. **Create `RiskClassifier`** — standalone class, easy to test.
3. **Create `AdversarialIOMiddleware`** — consolidates `SafetyGuard` patterns + `GroundtruthAPI` output check. Runs first in pipeline.
4. **Create `CheckpointMiddleware`** — depends on `WorkspaceStateService`, `RealtimeUpdateService`. Includes in-memory pending map.
5. **Create checkpoint API** (`api/checkpoints.ts`) — REST endpoints that resolve/reject pending checkpoints.
6. **Create `HandoverMiddleware`** — depends on `AgentRegistry`, `AgentMessageBroker`, `ToolRegistry`.
7. **Wire pipeline** — Add `executeWithMiddleware()` to orchestrator, update `processQuery()` and `executeStage()`, register middlewares in `initializeMiddleware()`.
8. **Write unit tests** for each middleware and the risk classifier.

## Out of Scope

- Database migrations for a `checkpoints` table (use existing `approval_requests` table + `WorkspaceStateService` for state).
- UI components for the approval flow (only the notification push and REST API).
- LLM-based adversarial detection (regex/pattern only for input; GroundtruthAPI for output).
- Changes to individual agent implementations to emit `CapabilityRequest` (the middleware handles it if present).
- Performance benchmarking of the middleware pipeline.

## Completion Criteria

The implementation is done when:

1. All four sections (pipeline wiring + 3 middlewares) are implemented.
2. All acceptance criteria checkboxes above pass.
3. All unit tests pass (`pnpm vitest run` for the new test files).
4. TypeScript compiles without errors in the affected packages.
5. Existing orchestrator tests continue to pass.
