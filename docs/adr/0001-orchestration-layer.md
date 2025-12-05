# ADR 0001: Orchestration Layer Design Decisions

- **Status**: Accepted
- **Date**: 2025-11-17
- **Scope**: Workflow orchestrator covering `workflows`, `workflow_executions`, and `task_queue` plus the Reflection Engine and Task Router.

## Context
The platform coordinates multiple autonomous agents (Opportunity → Integrity) with deterministic workflows, backpressure controls, and traceability requirements. We need a pluggable orchestration layer that supports DAG execution, retries, guardrails, and staged rollout.

## Decision
- Adopt a **Postgres-backed DAG orchestrator** with explicit workflow definitions stored in `workflows` and runtime progress in `workflow_executions`.
- Use a **Task Router** that classifies steps by capability (LLM, data fetch, compliance check) and dispatches them to workers with idempotency keys.
- Enable a **Reflection Engine** that scores outputs against the 18-point rubric and triggers up to 3 refinements when below threshold.
- Gate all orchestration features behind **feature flags** (`ORCHESTRATOR_ENABLED`, `REFLECTION_ENGINE_ENABLED`) to allow gradual rollout and quick rollback.
- Expose **observability hooks** (metrics and audit logs) for each transition to support runbook-driven recovery.

## Alternatives Considered
- **External workflow engines (e.g., Temporal)**: Rejected to avoid operational overhead and to keep orchestration logic co-located with Supabase data models.
- **Pure queue-based sequencing**: Rejected because it lacks DAG awareness, making recovery and retries coarse-grained.

## Consequences
- Postgres becomes the system of record for orchestration state; we must maintain migration discipline and snapshot backups.
- Task Router isolation enables targeted throttling per capability, improving reliability under LLM rate limits.
- Feature flags introduce an extra configuration surface but provide safe rollback paths described in the runbook.
- The Reflection Engine adds latency (one extra pass per failure) but improves output quality and reduces manual QA.
