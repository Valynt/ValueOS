# Architecture Decision Records

The ADR repository lives in `docs/adr/` and follows a sequential numbering pattern (`0001`, `0002`, ...).

## Numbering and naming
- Filenames follow the pattern `NNNN-short-title.md` where `NNNN` is a zero-padded integer.
- Reserve the next sequential number when opening a new ADR to avoid collisions.
- Keep titles concise (under 60 characters) and scoped to one architectural decision.

## Status conventions
- **Proposed**: Drafted and under review.
- **Accepted**: Approved and the decision is in effect.
- **Deprecated**: Decision is superseded but still referenced by implementations.
- **Superseded**: Replaced by a newer ADR (link to the successor).

## Template
Use `template.md` for all new ADRs. Copy the file, update the number, title, and date, and fill in the context, decision, alternatives, and consequences sections.

## Review cadence
- Perform a quarterly review of all ADRs to confirm they still reflect the system.
- Align C4 diagrams and schema/service changes with ADR updates so diagrams never drift from accepted decisions.
