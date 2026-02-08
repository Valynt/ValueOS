# Adr Index

**Last Updated**: 2026-02-08

**Consolidated from 2 source documents**

---

## Table of Contents

1. [ADR 0005: Theme Precedence and Token Governance](#adr-0005:-theme-precedence-and-token-governance)
2. [Architecture Decision Records (ADR) Index](#architecture-decision-records-(adr)-index)

---

## ADR 0005: Theme Precedence and Token Governance

*Source: `engineering/adr/0005-theme-precedence.md`*

- **Status**: Proposed
- **Date**: 2026-01-15
- **Scope**: Design system tokens, theme layering, and product UI styling
- **Supersedes**: N/A

## Context

ValueOS currently exposes multiple token sources (ValueOS semantic tokens and the AI Indigo theme),
which risks inconsistent brand application and unclear precedence across product surfaces.
Teams need a deterministic rule set for which tokens to use and how to scope experimental themes
without impacting core UI or accessibility baselines.

## Decision

1. **Semantic Tokens First**: All component styles map to semantic tokens in `valueos-theme.css`.
2. **Canonical Palette Source**: Raw color values live only in `valueos-palette.css`.
3. **Scoped Themes**: Experimental themes (e.g., AI Indigo) are gated behind
   `data-theme="ai-indigo"` at the root or container level.
4. **Documentation as Enforcement**: Design system docs must include:
   - Typography role map
   - Component state matrix
   - Normalized shadow + motion token references

## Alternatives Considered

1. **Global theme override**: Rejected because it creates unintended changes across all app surfaces.
2. **Separate app-level token sets**: Rejected due to drift risk and higher maintenance costs.

## Consequences

- **Positive**: Clear precedence reduces inconsistencies and lowers rollout risk for new themes.
- **Negative**: Requires a small upfront audit to align any existing AI Indigo usage with scoped containers.
- **Operational**: Teams must set `data-theme` explicitly when using experimental themes.

---

## Architecture Decision Records (ADR) Index

*Source: `engineering/adr/README.md`*

This index is the canonical log for **why** architectural decisions were made across ValueOS.
It centralizes ADR discovery so engineers can quickly locate context, alternatives, and consequences
before changing system boundaries.

## How to use this index

- Read the latest ADRs before starting architecture-heavy work.
- Link relevant ADR IDs in pull requests that affect architecture, data flows, reliability, or security posture.
- When creating a new ADR, add it to the table below in the same commit.

## ADR Registry

| ADR ID | Title | Status | Date | Area | File |
| --- | --- | --- | --- | --- | --- |
| ADR-0001 | Architecture Decision Governance | Accepted | 2026-02-05 | VOSAcademy architecture governance | [`apps/VOSAcademy/docs/adr/0001-architecture-governance.md`](../../../apps/VOSAcademy/docs/adr/0001-architecture-governance.md) |
| ADR-0005 | Theme Precedence and Token Governance | Proposed | 2026-01-15 | Design system token and theme layering | [`docs/engineering/adr/0005-theme-precedence.md`](./0005-theme-precedence.md) |

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

---