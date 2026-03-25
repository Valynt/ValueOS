# Value Ontology Decision (2026-03-24)

## Scope

This decision resolves which of the three value ontology artifacts under `modeling/` is canonical for customer-facing and implementation work.

Artifacts considered:

- `modeling/Master Business & Engagement Ontology (1).md`
- `modeling/current_state_value_model.md`
- `modeling/merged_value_model.md`

## Decision

`modeling/merged_value_model.md` is the canonical value ontology and implementation reference.

## Rationale

- It explicitly merges and right-sizes prior ontology work into a production-oriented, 7-entity core.
- It includes direct implementation hooks aligned to ValueOS architecture and agent/runtime flow.
- It emphasizes evidence gates and integrity-first requirements needed for customer-facing outputs.

## Usage Rules

- For new product/backend/frontend implementation decisions, use `modeling/merged_value_model.md` first.
- Treat `modeling/current_state_value_model.md` as a diagnostic assessment of existing state.
- Treat `modeling/Master Business & Engagement Ontology (1).md` as historical source material, not the operational source of truth.

## Related Near-Term Decision

`modeling/causal_truth_export/` is currently marked as archived research and is not an active production dependency for `apps/ValyntApp`.
