# ADR Index

**Last Updated**: 2026-04-05

This index is the canonical log for **why** architectural decisions were made across ValueOS.
It centralizes ADR discovery so engineers can quickly locate context, alternatives, and consequences
before changing system boundaries.

## ADR Registry

| ADR ID   | Title                                                        | Status   | Date       | Area                                                                                    | File                                                                                                                    |
| -------- | ------------------------------------------------------------ | -------- | ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ADR-0001 | Architecture Decision Governance                             | Accepted | 2025-02-06 | Architecture governance, documentation lifecycle, and operational runbook alignment     | [`docs/engineering/adr/0001-architecture-governance.md`](./adr/0001-architecture-governance.md)                         |
| ADR-0005 | Theme Precedence and Token Governance                        | Proposed | 2026-01-15 | Design system tokens, theme layering, and product UI styling                            | [`docs/engineering/adr/0005-theme-precedence.md`](./adr/0005-theme-precedence.md)                                       |
| ADR-0006 | Multi-Tenant Data Isolation and Sharding Strategy            | Accepted | 2026-03-06 | Production tenancy model, isolation guarantees, and scale-out strategy                  | [`docs/engineering/adr/0006-multi-tenant-isolation-and-sharding.md`](./adr/0006-multi-tenant-isolation-and-sharding.md) |
| ADR-0010 | Canonical LifecycleStage Vocabulary                          | Accepted | 2026-06-10 | Domain lifecycle stage vocabulary and agent-routing-to-domain stage mapping             | [`docs/engineering/adr/0010-canonical-lifecycle-stage.md`](./adr/0010-canonical-lifecycle-stage.md)                     |
| ADR-0011 | DI Container Removal; Module-Level Singletons as Replacement | Accepted | 2026-06-10 | Backend dependency management pattern and runtime service instantiation                 | [`docs/engineering/adr/0011-di-container-removal.md`](./adr/0011-di-container-removal.md)                               |
| ADR-0012 | Canonical Circuit Breaker                                    | Accepted | 2026-06-10 | Resilience pattern standardization and circuit breaker implementation governance        | [`docs/engineering/adr/0012-canonical-circuit-breaker.md`](./adr/0012-canonical-circuit-breaker.md)                     |
| ADR-0013 | Two-Layer Memory Architecture                                | Accepted | 2026-06-10 | Agent memory architecture (L1 in-process cache + persistent Supabase semantic store)    | [`docs/engineering/adr/0013-two-layer-memory-architecture.md`](./adr/0013-two-layer-memory-architecture.md)             |
| ADR-0014 | Direct Agent Invocation Rule                                 | Accepted | 2026-06-10 | Agent orchestration execution path and server-side intra-process invocation policy      | [`docs/engineering/adr/0014-direct-agent-invocation.md`](./adr/0014-direct-agent-invocation.md)                         |
| ADR-0015 | Agent Fabric Design                                          | Accepted | 2026-07-15 | Multi-agent architecture, runtime orchestration services, and inter-agent contracts     | [`docs/engineering/adr/0015-agent-fabric-design.md`](./adr/0015-agent-fabric-design.md)                                 |
| ADR-0016 | CI Security Gate Model                                       | Accepted | 2026-07-15 | CI security gate enforcement for RLS, agent security tests, and release waivers         | [`docs/engineering/adr/0016-ci-security-gate-model.md`](./adr/0016-ci-security-gate-model.md)                           |
| ADR-0017 | Service De-duplication Strategy                              | Accepted | 2026-07-15 | Service consolidation policy, canonical file ownership, and extraction strategy         | [`docs/engineering/adr/0017-service-deduplication-strategy.md`](./adr/0017-service-deduplication-strategy.md)           |
| ADR-0018 | Messaging Technology Selection                               | Accepted | 2026-03-17 | Canonical messaging systems: NATS JetStream (agents), BullMQ (jobs), KafkaJS (external) | [`docs/engineering/adr/0018-messaging-technology-selection.md`](./adr/0018-messaging-technology-selection.md)           |
| ADR-0019 | Production Readiness Audit Controls (March 27, 2026)        | Accepted | 2026-03-27 | Audit remediation controls for auth, billing, CI gates, workers, and observability       | [`docs/engineering/adr/0019-production-readiness-audit-2026-03.md`](./adr/0019-production-readiness-audit-2026-03.md)   |
| ADR-0020 | Domain Packs Module-Root Canonicalization                      | Accepted | 2026-04-05 | Backend module-root migration, compatibility shims, and CI import guardrails            | [`docs/engineering/adr/0020-domain-packs-module-root-migration.md`](./adr/0020-domain-packs-module-root-migration.md)   |

## Governance Evidence

- **2026-03-16 — Canonical docs reconciliation completed:** runtime/agent inventories and naming/path references were synchronized across `README.md`, `AGENTS.md`, `docs/architecture/*`, and `infra/k8s/README.md`; a CI docs boundary lint was added at `scripts/ci/docs-boundary-consistency-lint.mjs` to prevent regression.

## Authoring standard

Use this outline for new ADRs:

1. Title (`ADR ####: ...`)
2. Status
3. Date
4. Scope
5. Supersedes (if any)
6. Context
7. Decision
8. Alternatives considered
9. Consequences

Status values:

- Proposed
- Accepted
- Deprecated
- Superseded

## Date Integrity Exceptions

Use this metadata table when an ADR has an approved **planned effective date** that is intentionally in the future relative to CI run date. Do not overload the ADR `Date` field for scheduling semantics without adding this metadata.

| ADR ID   | metadata_key           | metadata_value | justification |
| -------- | ---------------------- | -------------- | ------------- |
| ADR-0010 | planned_effective_date | 2026-06-10     | Refactor phase effective date approved for staged rollout tracking. |
| ADR-0011 | planned_effective_date | 2026-06-10     | Refactor phase effective date approved for staged rollout tracking. |
| ADR-0012 | planned_effective_date | 2026-06-10     | Refactor phase effective date approved for staged rollout tracking. |
| ADR-0013 | planned_effective_date | 2026-06-10     | Refactor phase effective date approved for staged rollout tracking. |
| ADR-0014 | planned_effective_date | 2026-06-10     | Refactor phase effective date approved for staged rollout tracking. |
| ADR-0015 | planned_effective_date | 2026-07-15     | Agent-fabric governance rollout date tracked for compliance readiness bundle. |
| ADR-0016 | planned_effective_date | 2026-07-15     | CI security gate model effective date tracked for compliance readiness bundle. |
| ADR-0017 | planned_effective_date | 2026-07-15     | Service de-duplication policy effective date tracked for compliance readiness bundle. |
