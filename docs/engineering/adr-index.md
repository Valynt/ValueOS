# ADR Index

**Last Updated**: 2026-03-16

This index is the canonical log for **why** architectural decisions were made across ValueOS.
It centralizes ADR discovery so engineers can quickly locate context, alternatives, and consequences
before changing system boundaries.

## ADR Registry

| ADR ID   | Title                                             | Status   | Date       | Area                                                                                  | File                                                                                                                    |
| -------- | ------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ADR-0001 | Architecture Decision Governance                  | Accepted | 2025-02-06 | Architecture governance, documentation lifecycle, and operational runbook alignment   | [`docs/engineering/adr/0001-architecture-governance.md`](./adr/0001-architecture-governance.md)                       |
| ADR-0005 | Theme Precedence and Token Governance             | Proposed | 2026-01-15 | Design system tokens, theme layering, and product UI styling                          | [`docs/engineering/adr/0005-theme-precedence.md`](./adr/0005-theme-precedence.md)                                     |
| ADR-0006 | Multi-Tenant Data Isolation and Sharding Strategy | Accepted | 2026-03-06 | Production tenancy model, isolation guarantees, and scale-out strategy                | [`docs/engineering/adr/0006-multi-tenant-isolation-and-sharding.md`](./adr/0006-multi-tenant-isolation-and-sharding.md) |
| ADR-0010 | Canonical LifecycleStage Vocabulary               | Accepted | 2026-06-10 | Domain lifecycle stage vocabulary and agent-routing-to-domain stage mapping           | [`docs/engineering/adr/0010-canonical-lifecycle-stage.md`](./adr/0010-canonical-lifecycle-stage.md)                   |
| ADR-0011 | DI Container Removal; Module-Level Singletons as Replacement | Accepted | 2026-06-10 | Backend dependency management pattern and runtime service instantiation               | [`docs/engineering/adr/0011-di-container-removal.md`](./adr/0011-di-container-removal.md)                             |
| ADR-0012 | Canonical Circuit Breaker                         | Accepted | 2026-06-10 | Resilience pattern standardization and circuit breaker implementation governance       | [`docs/engineering/adr/0012-canonical-circuit-breaker.md`](./adr/0012-canonical-circuit-breaker.md)                   |
| ADR-0013 | Two-Layer Memory Architecture                     | Accepted | 2026-06-10 | Agent memory architecture (L1 in-process cache + persistent Supabase semantic store)  | [`docs/engineering/adr/0013-two-layer-memory-architecture.md`](./adr/0013-two-layer-memory-architecture.md)           |
| ADR-0014 | Direct Agent Invocation Rule                      | Accepted | 2026-06-10 | Agent orchestration execution path and server-side intra-process invocation policy     | [`docs/engineering/adr/0014-direct-agent-invocation.md`](./adr/0014-direct-agent-invocation.md)                       |
| ADR-0015 | Agent Fabric Design                               | Accepted | 2026-07-15 | Multi-agent architecture, runtime orchestration services, and inter-agent contracts    | [`docs/engineering/adr/0015-agent-fabric-design.md`](./adr/0015-agent-fabric-design.md)                               |
| ADR-0016 | CI Security Gate Model                            | Accepted | 2026-07-15 | CI security gate enforcement for RLS, agent security tests, and release waivers        | [`docs/engineering/adr/0016-ci-security-gate-model.md`](./adr/0016-ci-security-gate-model.md)                         |
| ADR-0017 | Service De-duplication Strategy                   | Accepted | 2026-07-15 | Service consolidation policy, canonical file ownership, and extraction strategy         | [`docs/engineering/adr/0017-service-deduplication-strategy.md`](./adr/0017-service-deduplication-strategy.md)         |

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
