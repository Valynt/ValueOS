---
title: Architecture
owner: team-platform
system: valueos-platform
---

# Architecture

**Last Updated**: 2026-03-26

---

## Canonical branding and runtime source of truth

Use this section as the canonical reference when updating repository-level docs, OpenAPI metadata, or backend-generated docs pages.

### Branding and support

- **Product name:** `ValueOS`
- **Marketing site:** `https://valueos.com`
- **Application URL:** `https://app.valueos.com`
- **API base URL:** `https://api.valueos.com`
- **Documentation URL:** `https://docs.valueos.com`
- **Status URL:** `https://status.valueos.com`
- **Support email:** `support@valueos.com`
- **Docs ownership email:** `docs@valueos.com`

### Runtime inventory

The authoritative machine-readable runtime inventory is `docs/architecture/runtime-inventory.json`.

The checked-in application workspaces under `apps/` are:

- `apps/ValyntApp` (`valynt-app`) — **active** customer-facing frontend runtime
- `apps/mcp-dashboard` (`mcp-dashboard`) — **active** internal MCP observability dashboard workspace
- `apps/agentic-ui-pro` (`agentic-ui-pro`) — **experimental** agentic UI prototype workspace

The primary API runtime remains `packages/backend` (`@valueos/backend`). Production package runtime entries (including owner and deploy path metadata) are also tracked in `docs/architecture/runtime-inventory.json`. The current top-level directories under `packages/` are `backend`, `components`, `config-v2`, `infra`, `integrations`, `mcp`, `memory`, `sdui`, `services`, `shared`, and `test-utils`. If a repository summary claims a different `apps/` or `packages/` inventory, treat the filesystem and this section as the source of truth and update the stale document plus the JSON inventory.

### Canonical file locations

- **Repository-level documentation summary:** `README.md`
- **Backend-generated docs output:** `packages/backend/src/api/docsContent.ts`
- **Machine-readable API metadata:** `packages/backend/openapi.yaml`
- **Architecture summary and runtime inventory:** `docs/architecture/README.md`
- **Agent/contributor guidance entry point:** `AGENTS.md`, with cross-repo detail in `docs/AGENTS.md`

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
