# Core Workflow End-to-End: User Screens, Actions, and System Logic

This guide maps the **end-to-end core workflow** to:

1. the screen a user is on,
2. the action they take,
3. what the backend does,
4. what state/evidence is produced.

It is based on the current runtime architecture (`ExecutionRuntime` + `DecisionRouter` + `PolicyEngine`) and the canonical complete lifecycle DAG.

## Canonical end-to-end DAG

The end-to-end lifecycle currently runs as `complete-value-lifecycle-v1` with five stages:

1. `opportunity_discovery`
2. `target_value_commit`
3. `realization_tracking`
4. `expansion_modeling`
5. `integrity_controls`

Defined in `COMPLETE_LIFECYCLE_WORKFLOW`.

---

## Side-by-side flow (screens × user actions × system behavior)

| Lifecycle stage | Likely user screen / surface | User action | Runtime behavior (system logic) | Output / state transition |
|---|---|---|---|---|
| **Start execution** | App workflow launcher or automation trigger (calls `/api/workflows/execute`) | User clicks **Run Workflow** (or equivalent) for a selected workflow definition | API validates payload and constructs execution envelope with actor + `organizationId`, then calls `ExecutionRuntime.executeWorkflow(...)` | Returns `202` with `executionId`, status `initiated`, and current stage |
| **Opportunity discovery** (`opportunity_discovery`) | Discovery experience (for example `DiscoveryPage` / `OpportunityDiscovery`) | User enters discovery context (pain points, hypotheses, signal data) and starts first stage | Runtime resolves route for stage via `DecisionRouter.routeStage(...)`; executes stage with retry + circuit breaker + timeout; pulls relevant memory scoped to tenant/workspace | Stage result persisted, workflow events recorded, context enriched for next stage |
| **Target value commit** (`target_value_commit`) | KPI / target planning surface | User sets or confirms KPI targets and value commitments | Same stage pipeline: dependency check → route → execute → policy checks (autonomy + integrity veto paths) → persist updates | KPI/commit outputs added to workflow execution record |
| **Realization tracking** (`realization_tracking`) | Realization dashboard/reporting surface | User reviews in-flight KPI actuals vs target and requests tracking run | Runtime executes stage; records stage lifecycle, writes workflow events, and updates execution status after transition | Realization output merged into execution context and stored |
| **Expansion modeling** (`expansion_modeling`) | Expansion planning/modeling surface | User requests next-best expansion opportunities based on realized value | Stage execution invokes selected agent path and records memory episodes (success or failure), with retry semantics on transient failures | Expansion scenarios/modeling payload persisted |
| **Integrity controls** (`integrity_controls`) | Integrity/compliance/audit surface | User requests final validation / controls pass | Structural truth + integrity veto checks applied to stage output; if vetoed, workflow is failed; if passed, execution can complete | Final control evidence and completion state written |
| **Explainability drill-down** | Step explain panel (`/api/workflow/:executionId/step/:stepId/explain`) | User clicks **Why did this step produce this output?** | API fetches latest stage log row (scoped by `tenant_id`), extracts reasoning/evidence/confidence and returns explain payload | User sees reasoning, evidence list, confidence score |

---

## What users experience as progression

At a high level, users experience the workflow as:

1. **Initiate**: request starts an async run and immediately returns an execution reference.
2. **Progressive stage completion**: each completed stage updates status and carries forward context.
3. **Governed automation**: policy guards can pause/fail unsafe or integrity-violating runs.
4. **Transparent outcomes**: users can inspect step reasoning/evidence via explain endpoint.

---

## Reliability and degradation model

The current test strategy includes chaos scenarios showing that **non-critical integration failures** can be isolated from core workflow progression, while **hard dependencies** can block execution. This reflects a degraded-vs-failed distinction in operational behavior.

See: `tests/chaos/crm-billing-failure.test.ts` and `docs/engineering/test-strategy.md`.
