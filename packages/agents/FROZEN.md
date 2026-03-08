# FROZEN — packages/agents/

**Status:** Frozen as of Sprint 0 of the ValueOS architectural refactor.

**Decision:** This package is the deprecated standalone agent runtime. Per AGENTS.md, production agent implementations live in `packages/backend/src/lib/agent-fabric/agents/` and use `secureInvoke` with real LLM calls, Zod validation, and tenant-scoped memory. This package predates that architecture.

**Active modules still imported by packages/backend:**
- `core/` — ValueCaseSaga, EvidenceTiering, ConfidenceScorer, IdempotencyGuard, DeadLetterQueue
- `orchestration/` — HypothesisLoop, RedTeamAgent, agent interfaces
- `tools/` — Tool interfaces and registry
- `evaluation/` — Agent evaluation harness

These imports will be migrated to `packages/backend` directly before this package is deleted.

**Rules while frozen:**
- No new agent logic may be added here.
- No new exports.
- All new agent development goes to `packages/backend/src/lib/agent-fabric/agents/`.

**Deletion target:** Sprint 2 (after all imports are migrated to canonical locations).

**Reference:** ValueOS Refactor Roadmap, Sprint 0, Task 0.3; Sprint 2, Task 2.4.
