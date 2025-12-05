# Local Module Rules & Standards

This document defines the strict development standards for specific modules within the ValueCanvas repository. These rules are enforced to ensure architectural integrity, security compliance, and scalability of the Agentic AI fabric.

---

## 1. AI Agent Modules

**Path:** `src/lib/agent-fabric/agents/*` & `src/agents/*`

### 1.1 File Structure & Naming

- **Class Definition:** Each agent must be a single class in its own file named `[AgentName]Agent.ts`.
- **Inheritance:** MUST extend `BaseAgent` (`src/lib/agent-fabric/agents/BaseAgent.ts`). Ad-hoc agent classes are strictly prohibited.
- **Location:**
  - Core infrastructure agents reside in `src/lib/agent-fabric/agents/`
  - Domain-specific workflow agents reside in `src/agents/`

### 1.2 Prompt Engineering

- **Templates:** All prompts must use **handlebars syntax** for variable injection. String concatenation for constructing prompts is **forbidden**.
- **System Prompts:** Must explicitly define the agent's "Job Description" and "Constraints".
- **Structured Output:** All internal reasoning loops (ReAct) must utilize strict JSON schemas defined via **zod**.
  - **Forbidden:** Returning raw text for functional logic.
  - **Required:** `{ thought: string, action: string, parameters: object }`
- **Security Injection:** Do not manually add PII or safety overrides. The `BaseAgent.secureInvoke()` method automatically injects the `LLM_SECURITY_FRAMEWORK` system prompts.

### 1.3 Execution & State

- **Invocation:** All LLM interactions must occur via `this.secureInvoke()`. Direct instantiation of `LLMGateway` inside an agent is **prohibited**.
- **Context Window:**
  - **Token Budget:** Agents must implement `trimContext()` to keep history under 32k/128k tokens (depending on model config).
  - **Summary Strategy:** Use `ConversationHistoryService` to summarize interaction turns older than N=10.
- **Confidence:** Agents must implement `ConfidenceThresholds`. If `confidence_score < 0.7`, the agent must self-correct or flag for human review.

### 1.4 Testing

- **Coverage:** 100% coverage of `execute()` paths.
- **Mocking:** Tests must mock `LLMGateway` and `MemorySystem`. Live API calls in CI are **blocked**.
- **Benchmarks:** Each agent must have a corresponding `[AgentName].benchmark.test.ts` verifying performance against the "18-point Quality Rubric".

---

## 2. Tool Libraries

**Path:** `src/tools/*` & `src/services/tools/*`

### 2.1 Interface Definitions

**Contract:** All tools must implement the `Tool` interface:

```typescript
interface Tool<TInput, TOutput> {
  name: string;
  description: string; // Must be descriptive for LLM selection
  schema: z.ZodType<TInput>;
  execute(input: TInput, context: AgentContext): Promise<TOutput>;
}
```

- **Validation:** Input validation is handled automatically by the `schema` property. `execute()` should assume valid inputs.

### 2.2 Registration & Discovery

- **Registry:** Tools must be registered in `ToolRegistry.ts`. Dynamic/runtime tool creation is **disallowed** for security auditing.
- **Metadata:** Description fields must include usage examples to improve agent selection accuracy.

### 2.3 Execution Safety

- **Idempotency:** Action tools (write operations) must be idempotent where possible.
- **Permissions:** Tools must check `LocalRules` (LR-001) before execution. Throw `PermissionDeniedError` if the invoking agent context lacks specific authority.
- **Rate Limiting:** Tools wrapping external APIs (e.g., HubSpot, Salesforce) must implement `RateLimiter` middleware.

---

## 3. Orchestration Layer

**Path:** `src/services/WorkflowOrchestrator.ts` & `src/lib/orchestration/*`

### 3.1 Architecture Patterns

- **DAG Enforcement:** Workflows must be modeled as Directed Acyclic Graphs using `WorkflowDAGDefinitions.ts`. Cycles are strictly **forbidden**.
- **Pattern Usage:**
  - **Hierarchical:** Default. `OrchestratorAgent` delegates to sub-agents.
  - **Diamond:** Supported only with a mandatory Synthesis node to resolve parallel branches.

### 3.2 Routing & Selection

- **Static Routing:** Preferred for standard workflows defined in `dags.ts`.
- **Dynamic Routing:** Allowed only via `AgentRoutingLayer` which uses `AgentRoutingScorer` to evaluate capability matches.

### 3.3 Resilience

- **Saga Pattern:** Every state-mutating step must define a compensation function in `WorkflowCompensation.ts` to rollback changes on failure.
- **Circuit Breaking:** `AgentFabric` applies a circuit breaker (5 failures, 60s reset) to agent nodes.
- **State Persistence:** Orchestrator must persist `WorkflowState` to Supabase after every node transition.

---

## 4. Memory Management

**Path:** `src/lib/agent-fabric/MemorySystem.ts`

### 4.1 Vector Operations

- **Indexing:** All Semantic Memory insertions must generate embeddings via the standard model (`togethercomputer/m2-bert-80M-8k-retrieval`).
- **Isolation:** **CRITICAL**. All vector search queries must include `{ metadata: { tenant_id: string } }` filter.

### 4.2 Context Protocols

- **Shared Context:** Agents do not read each other's Working Memory. Context is shared explicitly via `MessageBus` events or the `SharedArtifacts` table.
- **Episodic Immutability:** The `agent_audit_log` is append-only. Never update or delete history records.

### 4.3 Lifecycle

- **TTL:** Working memory is ephemeral (session-scoped).
- **Cleanup:** `SessionManager` is responsible for archiving Working Memory to Long-term Memory upon session completion.

---

## 5. Agent Communication

**Path:** `src/services/MessageBus.ts` & `src/types/CommunicationEvent.ts`

### 5.1 Protocol

**Format:** CloudEvents-compliant JSON structure.

```json
{
  "id": "string",
  "source": "string",  // Agent ID
  "type": "string",    // e.g., 'value.opportunity.created'
  "data": "unknown",
  "traceid": "string",
  "time": "string"
}
```

- **Asynchronous:** Default communication mode. Agents publish events; they do not call other agents synchronously (except Orchestrator).

### 5.2 Processing

- **Queues:** High-priority tasks (User Interactive) vs Background tasks (Data Processing) must use separate queues in `MessageQueue.ts`.
- **Tracing:** `trace_id` must be propagated across all async boundaries to maintain observability in `AuditTraceViewer`.

---

## 6. Frontend Components

**Path:** `src/sdui/*` & `src/components/Agent/*`

### 6.1 SDUI (Server-Driven UI)

- **Registry:** Components rendered by agents must be in `ui-registry.json` and `src/sdui/registry.tsx`.
- **Schema:** Props must be strictly typed. Agents generate JSON matching these props.
- **Versioning:** SDUI components must maintain backward compatibility or use versioned names (e.g., `MetricCardV2`).

### 6.2 Interaction Patterns

- **Transparency:** AI-generated content must be visually distinct (use `GhostPreview` wrapper or "AI Generated" badges).
- **Streaming:** Use `useRealtimeUpdates` hook for WebSocket subscriptions. The UI must handle partial JSON chunks gracefully using `StreamingRenderer`.
- **Optimistic UI:** For agent actions, show the expected state immediately while the background job processes.

---

## 7. Backend Services

**Path:** `src/services/*`

### 7.1 Service Design

- **Stateless:** Services must not hold state between requests. Use `SessionManager` or `WorkflowStateRepository` for state.
- **Injection:** Dependencies (like `SupabaseClient`) must be injected, not instantiated globally, to support RLS context switching.

### 7.2 Database Interactions

- **RLS:** Always use `supabase.auth.getUser()` context. Bypassing RLS with `service_role` key is restricted to:
  - `AuthService`
  - `TenantProvisioning`
  - `CronJobs`
- **Transactions:** Multi-table writes must be wrapped in SQL transactions (via RPC calls) to ensure atomicity.

### 7.3 Error Handling

- **Typed Errors:** Throw specific errors (`AppError`, `ValidationError`) defined in `src/services/errors.ts`.
- **Sanitization:** Error messages returned to the client must be sanitized of stack traces and internal IDs.

---

## Related Documentation

- [Rules Framework](./RULES_FRAMEWORK.md) - Global and Local rules enforcement
- [Agent Fabric Implementation](./AGENT_FABRIC_IMPLEMENTATION_COMPLETE.md)
- [Security Policies](./security/SECURITY_POLICIES.md)
- [Multi-Tenant Architecture](./multi-tenant-architecture.md)

---

## Enforcement

These standards are enforced through:

1. **Code Review:** All PRs must pass module standards checklist
2. **Linting:** ESLint rules for file naming and structure
3. **Testing:** CI pipeline blocks merges without required tests
4. **Documentation:** Architecture Decision Records (ADRs) track deviations
