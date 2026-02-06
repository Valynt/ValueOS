# Architecture Decision Records (ADR) Index

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
