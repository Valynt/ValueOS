# ADR 0015: Agent Fabric Design

- **Status:** Accepted
- **Date:** 2026-07-15
- **Context:**
  - ValueOS requires multi-stage AI reasoning across a business value lifecycle (discovery → hypothesis → financial model → integrity → narrative → realization → expansion).
  - Early prototypes used a single monolithic orchestrator (`UnifiedAgentOrchestrator`) that handled routing, execution, memory, and output composition in one class. This created a 2,000+ line file with no clear extension points and made it impossible to test individual reasoning stages in isolation.
  - Agent calls needed circuit-breaker protection, hallucination detection, and tenant-scoped memory — concerns that were duplicated across ad-hoc agent implementations.

- **Decision:**
  - Replace `UnifiedAgentOrchestrator` with a six-service runtime: `DecisionRouter`, `ExecutionRuntime`, `PolicyEngine`, `ContextStore`, `ArtifactComposer`, `RecommendationEngine`. Each service owns one concern.
  - Define eight domain agents in `packages/backend/src/lib/agent-fabric/agents/`, each extending `BaseAgent`: `OpportunityAgent`, `TargetAgent`, `FinancialModelingAgent`, `IntegrityAgent`, `RealizationAgent`, `ExpansionAgent`, `NarrativeAgent`, `ComplianceAuditorAgent`.
  - All LLM calls go through `BaseAgent.secureInvoke()`, which wraps the call with a circuit breaker, multi-signal hallucination detection, and Zod schema validation. Direct calls to `LLMGateway.complete()` from agent code are forbidden.
  - Agents communicate via `MessageBus` (CloudEvents). Every message carries a `trace_id` propagated across async boundaries.
  - Agent memory is tenant-scoped: all `MemorySystem` queries must include `tenant_id` in metadata. Cross-tenant reads are blocked at the query layer.
  - Confidence thresholds are risk-tiered: financial decisions require 0.7–0.9, commitment decisions 0.6–0.85, discovery 0.5–0.8.

- **Consequences:**
  - Each runtime service and each agent can be tested in isolation by mocking its single dependency boundary.
  - Adding a new lifecycle stage requires: one new agent class, one DAG node in `lifecycleWorkflows.ts`, and registration in `AgentFactory.ts`. No changes to the runtime services.
  - `secureInvoke` is the single enforcement point for hallucination detection and cost limits. Bypassing it (e.g., calling `llmGateway.complete()` directly) is caught by the `no-restricted-syntax` ESLint rule.
  - The six-service split means orchestration logic is spread across more files. The `traceability.md` context file maps each lifecycle stage to its agent, runtime service, DB table, and UI component.
  - `RecommendationEngine` subscribes to domain events and pushes next-best-action recommendations to UI clients via `RealtimeBroadcastService`, decoupling the recommendation loop from agent execution.
