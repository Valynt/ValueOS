# ADR-0010 — Canonical LifecycleStage Vocabulary

**Status:** Accepted  
**Date:** 2026-06-10  
**Deciders:** Engineering

---

## Context

`LifecycleStage` was defined as a TypeScript type in 6 separate locations with divergent member sets:

| Location | Members |
|---|---|
| `types/agent.ts` | opportunity, modeling, target, realization, expansion, integrity, narrative |
| `types/workflow.ts` | opportunity, target, expansion, integrity, realization |
| `types/vos.ts` | opportunity, target, expansion, integrity, realization |
| `services/ValueLifecycleOrchestrator.ts` | opportunity, target, expansion, integrity, realization |
| `services/RealizationFeedbackLoop.ts` | opportunity, target, expansion, integrity, realization |
| `routes/sdui.ts` | opportunity, target, realization, expansion, integrity |

A seventh vocabulary existed in `packages/shared/src/domain/Opportunity.ts` as `OpportunityLifecycleStage`: `discovery | drafting | validating | composing | refining | realized | expansion`. This was the intended canonical domain model but was not used by any agent or routing code.

The divergence meant the type system could not catch stage mismatches that passed silently at runtime. `AgentFactory` bridged the gap with a runtime map (`"financial-modeling" → "modeling"`) that had no type-level enforcement.

---

## Decision

**One `LifecycleStage` type, exported from `packages/shared/src/domain/`.**

The canonical values are the product/domain stages from `OpportunityLifecycleStageSchema`:

```
discovery | drafting | validating | composing | refining | realized | expansion
```

These represent the state of a value engagement from the user's perspective, not internal agent routing labels.

**Internal agent routing labels** (`opportunity`, `modeling`, `target`, `integrity`, `narrative`) are mapped to canonical stages via `packages/backend/src/lib/agent-fabric/lifecycleStageAdapter.ts`. This adapter is the single place where the translation between routing labels and domain stages occurs.

All 6 local `LifecycleStage` definitions are replaced with re-exports from `@valueos/shared`.

---

## Mapping

| Agent routing label | Canonical stage |
|---|---|
| `opportunity` | `discovery` |
| `financial-modeling` / `modeling` | `drafting` |
| `target` | `drafting` |
| `integrity` | `validating` |
| `narrative` | `composing` |
| `realization` | `refining` |
| `expansion` | `expansion` |
| `compliance-auditor` | `validating` |

---

## Consequences

- The compiler catches `LifecycleStage` mismatches that previously passed silently.
- `AgentFactory.createForStage(stage)` now accepts canonical stages and resolves to agent routing labels via the adapter.
- `routes/sdui.ts` `isValidStage()` validates against canonical values.
- Agent class `lifecycleStage` properties (e.g. `"opportunity"` in `OpportunityAgent`) are internal routing labels, not canonical stages. They do not need to change — the adapter handles translation at the factory boundary.
- Gradual migration: files that previously imported from local definitions now import from `@valueos/shared` via re-exports in `types/agent.ts`, `types/workflow.ts`, `types/vos.ts`. These re-exports can be removed once all consumers import directly from `@valueos/shared`.

---

## Alternatives Considered

**Keep the old vocabulary** (`opportunity/target/integrity/…`): Rejected. These are agent routing labels, not domain concepts. They conflate implementation with domain model.

**Rename agent classes** to match canonical stages: Deferred. The agent class names (`OpportunityAgent`, `TargetAgent`) are stable identifiers used in logs, metrics, and tests. Renaming them is a separate concern from type unification.
