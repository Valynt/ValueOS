---
title: Architecture
owner: team-platform
system: valueos-platform
---

# Architecture

**Last Updated**: 2026-02-16

---

## Canonical Runtime + Agent Inventory

For architecture documentation consistency, the canonical backend orchestration surface is **six runtime services** in `packages/backend/src/runtime/`:

- `DecisionRouter`
- `ExecutionRuntime`
- `PolicyEngine`
- `ContextStore`
- `ArtifactComposer`
- `RecommendationEngine`

The canonical agent fabric inventory is **eight agents** in `packages/backend/src/lib/agent-fabric/agents/`:

- `OpportunityAgent`
- `TargetAgent`
- `FinancialModelingAgent`
- `IntegrityAgent`
- `RealizationAgent`
- `ExpansionAgent`
- `NarrativeAgent`
- `ComplianceAuditorAgent`

---

## Documents in this Category

- [Agent Architecture](./agent-architecture.md)
- [Api Architecture](./api-architecture.md)
- [Architecture Overview](./architecture-overview.md)
- [Data Architecture](./data-architecture.md)
- [Frontend Architecture](./frontend-architecture.md)
- [Infrastructure Architecture](./infrastructure-architecture.md)
- [Memory First Architecture](./memory-first-architecture.md)
- [Module Ownership and Boundaries](./module-ownership-boundaries.md)
- [Security Architecture](./security-architecture.md)
- [Component Interaction Diagrams](./component-interaction-diagram.md) — Visual maps of system flows (Mermaid)

---

**Total Documents**: 10
