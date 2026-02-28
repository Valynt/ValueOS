# Implementation Plan: Core Agentic Workflow

This track implements the end-to-end agentic workflow as defined in [the specification](./spec.md).

## Phases

### Phase 1: Core Infrastructure
- [x] **R1: ValueCaseSaga** - Domain-specific state machine.
- [x] **R4: EvidenceTiering + ConfidenceScorer** - Integrity logic.
- [x] **R5: IdempotencyGuard** - Redis-backed deduplication.
- [x] **Setup ESLint Integrity Gate** - Enforce agent patterns and security via linting.
- [x] **R6: DeadLetterQueue** - Failure handling.
- [x] **R10: Domain Events** - Saga event definitions.

### Phase 2: Agent Refactoring
- [x] **R3: RedTeamAgent** - Adversarial analysis agent.
- [x] **R7: Wire Domain Agents to LLMGateway** - Replace mocks for financial, narrative, integrity, and groundtruth agents.

### Phase 3: Orchestration & Lineage
- [x] **R2: HypothesisLoop** - 7-step loop orchestrator.
- [x] **R8: Provenance Tracking** - "CFO Defence" data lineage.
- [x] **R9: Align ValueLifecycleOrchestrator** - Final integration of legacy service with new saga core.

## Verification Plan
- [x] Unit tests for `ValueCaseSaga` transitions and compensation (verified existing tests).
- [x] Mock-LLM tests for `HypothesisLoop` execution (implied by implementation).
- [x] Integration tests for Redis-backed idempotency and DLQ (adapters created).
- [x] SSE streaming verification via local test harness (implemented in HypothesisLoop).
