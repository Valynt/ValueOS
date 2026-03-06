# ADR Index

**Last Updated**: 2026-03-06

This index is the canonical log for **why** architectural decisions were made across ValueOS.
It centralizes ADR discovery so engineers can quickly locate context, alternatives, and consequences
before changing system boundaries.

## ADR Registry

| ADR ID   | Title                                             | Status   | Date       | Area                                                    | File                                                                                                                    |
| -------- | ------------------------------------------------- | -------- | ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ADR-0001 | Architecture Decision Governance                  | Accepted | 2025-02-06 | Architecture governance and process                     | [`docs/engineering/adr/0001-architecture-governance.md`](./adr/0001-architecture-governance.md)                         |
| ADR-0005 | Theme Precedence and Token Governance             | Proposed | 2026-01-15 | Design system token and theme layering                  | [`docs/engineering/adr/0005-theme-precedence.md`](./adr/0005-theme-precedence.md)                                       |
| ADR-0006 | Multi-Tenant Data Isolation and Sharding Strategy | Accepted | 2026-03-06 | Tenancy model, isolation guarantees, and scale triggers | [`docs/engineering/adr/0006-multi-tenant-isolation-and-sharding.md`](./adr/0006-multi-tenant-isolation-and-sharding.md) |

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
