# Sprint Plan — Sprint 20: Commitment Tracking DB and Backend API

**Author:** Ona (AI Engineering Agent)
**Date:** 2026-06-18
**Baseline:** Post-Sprint 19. All six lifecycle stages are real and persistent. Billing frontend wired (Sprints 15–19). No P0 debt items open.

---

## Baseline Audit

### What is complete

- All six lifecycle stages have full ✅ traceability (Hypothesis → Model → Integrity → Narrative → Realization → Expansion)
- `ValueCommitmentBackendService` — create, update, status-transition, add-note, delete, get — all real Supabase writes with tenant isolation and audit trail
- `valueCommitmentsRouter` — mounted at `/api/v1/value-commitments` in `server.ts`; Zod-validated; FSM-enforced status transitions; rate-limited
- Frontend `ValueCommitmentTrackingService` (`apps/ValyntApp`) — write paths (create, update, status, note, delete) route through the backend API via `apiClient`; feature-flagged with `VITE_USE_BACKEND_COMMITMENT_API`
- `ValueCommitmentBackendService` test suite exists at `packages/backend/src/services/value/__tests__/ValueCommitmentBackendService.test.ts`

### What is broken / the actual Sprint 20 gap

The prior sprint plan (sprint-plan-20-23.md) described Sprint 20 as replacing stubs in `ValueCommitmentTrackingService`. That work is **partially done** — the write paths are real. What remains:

1. **No active DB migration for commitment tables.** `value_commitments`, `commitment_milestones`, `commitment_metrics`, `commitment_risks`, `commitment_stakeholders`, `commitment_notes` exist only in `_deferred_archived/20231203000000_value_commitment_tracking.sql`. No active migration creates these tables. The backend service will throw on every call in a fresh environment.

2. **Frontend stub methods not migrated.** `apps/ValyntApp/src/services/ValueCommitmentTrackingService.ts` has 8 methods that log `"not yet migrated to backend API"` and return empty objects: `addStakeholder`, `updateStakeholder`, `createMilestone`, `updateMilestoneProgress`, `createMetric`, `updateMetricValue`, `createRisk`, `updateRiskStatus`.

3. **No backend endpoints for milestones, metrics, risks, stakeholders.** The router only covers the commitment lifecycle (create/update/status/note/delete). Sub-resource endpoints do not exist.

4. **`calculateProgress`, `getAtRiskCommitments`, `validateAgainstGroundTruth`** in the frontend service return hardcoded zeros/empty arrays — no backend read path exists for these.

5. **US-006 acceptance criteria not met.** Milestones are not creatable, actual metric values are not recordable, realization % is not calculated.

### What is deferred (post-Sprint 20)

- DEBT-012 — VOSAcademy content loader
- Partition scheduler cron job (Sprint 22)
- RBAC degraded-security runbook (Sprint 22)
- TypeScript `any` reduction (Sprints 21–23)

---

## Sprint 20 — Commitment Tracking: DB Migration and Sub-Resource API

**Objective:** Commitment tracking is end-to-end real. Milestones, metrics, risks, and stakeholders persist to Supabase. The frontend has no stub methods remaining.

**Success statement:** A VE can create a commitment, add milestones and metrics, record actual values, and see realization % calculated. All data survives page refresh. No method in `ValueCommitmentTrackingService` (frontend or backend) returns mock data or logs "not yet migrated."

**Depends on:** `ValueCommitmentBackendService` and `valueCommitmentsRouter` complete (confirmed). `realization_reports` table live (confirmed).

**Architectural rationale:** The commitment tables exist only in the archived monolith schema — no active migration creates them. Every call to `ValueCommitmentBackendService` will fail with a Supabase "relation does not exist" error in any environment that has not manually applied the archived SQL. The DB migration is the unblocking prerequisite for all other work in this sprint. Sub-resource endpoints (milestones, metrics, risks, stakeholders) follow the same pattern as the existing commitment CRUD — they extend `valueCommitmentsRouter` and delegate to `ValueCommitmentBackendService`.

**Competitor context:** Gainsight tracks health scores and CS workflows post-deal. ValueOS's commitment tracking — tied directly to the original value hypothesis and financial model — is a differentiated post-sale capability. It is only differentiated once it is real.

---

### KR 20-1 — Active DB migration for all commitment tables

**Gap:** No active migration creates `value_commitments`, `commitment_milestones`, `commitment_metrics`, `commitment_risks`, `commitment_stakeholders`, `commitment_notes`.

**Acceptance criteria:**

- Migration `20260718000000_commitment_tracking_tables.sql` creates all six tables with correct columns, indexes on `(commitment_id, organization_id)`, and RLS enabled
- RLS policies use `security.user_has_tenant_access(organization_id)` consistent with all other tenant tables
- `commitment_notes` table includes `organization_id`, `tenant_id`, `commitment_id`, `created_by`, `body`, `visibility`, `created_at`
- Paired rollback file `20260718000000_commitment_tracking_tables.rollback.sql` drops all six tables in reverse dependency order
- Migration applies cleanly against local Supabase (`pnpm run db:migrate`)
- `pnpm run test:rls` passes for all six new tables

**Files:**
- `infra/supabase/supabase/migrations/20260718000000_commitment_tracking_tables.sql`
- `infra/supabase/supabase/migrations/20260718000000_commitment_tracking_tables.rollback.sql`

---

### KR 20-2 — Backend sub-resource endpoints: milestones and metrics

**Gap:** No endpoints exist for milestone or metric CRUD. Frontend stubs `createMilestone`, `updateMilestoneProgress`, `createMetric`, `updateMetricValue` return empty objects.

**Acceptance criteria:**

- `POST /api/v1/value-commitments/:commitmentId/milestones` — creates a milestone row; validates ownership via `fetchOwned`; emits `commitment.milestone_created` audit event
- `PATCH /api/v1/value-commitments/:commitmentId/milestones/:milestoneId` — updates progress/status/actual_date; recomputes `progress_percentage` on the parent commitment row; emits `commitment.milestone_updated` audit event
- `POST /api/v1/value-commitments/:commitmentId/metrics` — creates a metric row; validates ownership
- `PATCH /api/v1/value-commitments/:commitmentId/metrics/:metricId/actual` — records `current_value` and `last_measured_at`; triggers realization % recalculation on the parent commitment; emits `commitment.metric_updated` audit event
- All endpoints: `organization_id` resolved from session only (never from request body); Zod-validated request bodies; rate-limited at `STANDARD` tier
- Unit tests for each endpoint in `packages/backend/src/api/valueCommitments/__tests__/`

**Files:**
- `packages/backend/src/api/valueCommitments/router.ts` (extend)
- `packages/backend/src/api/valueCommitments/schemas.ts` (extend)
- `packages/backend/src/services/value/ValueCommitmentBackendService.ts` (extend)
- `packages/backend/src/api/valueCommitments/__tests__/milestones.test.ts`
- `packages/backend/src/api/valueCommitments/__tests__/metrics.test.ts`

---

### KR 20-3 — Backend sub-resource endpoints: risks and stakeholders

**Gap:** No endpoints exist for risk or stakeholder CRUD. Frontend stubs `createRisk`, `updateRiskStatus`, `addStakeholder`, `updateStakeholder` return empty objects.

**Acceptance criteria:**

- `POST /api/v1/value-commitments/:commitmentId/risks` — creates a risk row; validates ownership; emits `commitment.risk_created` audit event
- `PATCH /api/v1/value-commitments/:commitmentId/risks/:riskId` — updates status/mitigated_at; emits `commitment.risk_updated` audit event
- `POST /api/v1/value-commitments/:commitmentId/stakeholders` — creates a stakeholder row; validates ownership; emits `commitment.stakeholder_added` audit event
- `PATCH /api/v1/value-commitments/:commitmentId/stakeholders/:stakeholderId` — updates role/responsibility/accountability_percentage; emits `commitment.stakeholder_updated` audit event
- `GET /api/v1/value-commitments/:commitmentId/progress` — returns `{ overall_progress, milestone_completion, metric_achievement, risk_level, days_remaining, is_on_track }` computed from live DB rows (no hardcoded values)
- `GET /api/v1/value-commitments?organizationId=...&atRisk=true` — returns commitments where `progress_percentage < 80` for the authenticated tenant
- All endpoints: ownership validated; Zod-validated; rate-limited; audit trail
- Unit tests for each endpoint

**Files:**
- `packages/backend/src/api/valueCommitments/router.ts` (extend)
- `packages/backend/src/api/valueCommitments/schemas.ts` (extend)
- `packages/backend/src/services/value/ValueCommitmentBackendService.ts` (extend)
- `packages/backend/src/api/valueCommitments/__tests__/risks.test.ts`
- `packages/backend/src/api/valueCommitments/__tests__/stakeholders.test.ts`

---

### KR 20-4 — Frontend service: migrate all stub methods

**Gap:** 8 methods in `apps/ValyntApp/src/services/ValueCommitmentTrackingService.ts` log "not yet migrated" and return empty objects. `calculateProgress`, `getAtRiskCommitments`, `validateAgainstGroundTruth` return hardcoded zeros.

**Acceptance criteria:**

- `createMilestone()` → `POST /api/v1/value-commitments/:id/milestones` via `apiClient`
- `updateMilestoneProgress()` → `PATCH /api/v1/value-commitments/:id/milestones/:milestoneId` via `apiClient`
- `createMetric()` → `POST /api/v1/value-commitments/:id/metrics` via `apiClient`
- `updateMetricValue()` → `PATCH /api/v1/value-commitments/:id/metrics/:metricId/actual` via `apiClient`
- `createRisk()` → `POST /api/v1/value-commitments/:id/risks` via `apiClient`
- `updateRiskStatus()` → `PATCH /api/v1/value-commitments/:id/risks/:riskId` via `apiClient`
- `addStakeholder()` → `POST /api/v1/value-commitments/:id/stakeholders` via `apiClient`
- `updateStakeholder()` → `PATCH /api/v1/value-commitments/:id/stakeholders/:stakeholderId` via `apiClient`
- `calculateProgress()` → `GET /api/v1/value-commitments/:id/progress` via `apiClient`; returns real data
- `getAtRiskCommitments()` → `GET /api/v1/value-commitments?atRisk=true` via `apiClient`; returns real rows
- `validateAgainstGroundTruth()` → delegates to `calculateProgress()` and compares against configurable threshold (default 0.8); no hardcoded return
- No method in the service logs "not yet migrated" after this sprint
- All methods respect the `VITE_USE_BACKEND_COMMITMENT_API` feature flag (stub fallback path preserved for emergency rollback)
- `pnpm run typecheck` passes

**Files:**
- `apps/ValyntApp/src/services/ValueCommitmentTrackingService.ts`

---

### KR 20-5 — Traceability and test gate

**Acceptance criteria:**

- `traceability.md` Stage 5 (Realization) updated: `ValueCommitmentTrackingService` row changed from ⚠️ to ✅; all sub-resource endpoints listed
- `user-stories.md` US-006 status updated from ⚠️ to ✅
- `debt.md` DEBT-007 marked resolved with date and resolution summary
- `pnpm test` green
- `pnpm run test:rls` green (covers all six new commitment tables)
- `pnpm run typecheck` passes
- No TODO comments remain in either `ValueCommitmentTrackingService.ts` file

---

## Implementation Order

```
KR 20-1  DB migration (unblocks all backend work)
KR 20-2  Milestone + metric endpoints
KR 20-3  Risk + stakeholder endpoints + progress/at-risk reads
KR 20-4  Frontend service migration
KR 20-5  Traceability updates + test gate
```

---

## Sprint 20 Acceptance Criteria (end-to-end)

| # | Criterion | Verified by |
|---|---|---|
| S20-1 | `pnpm run db:migrate` applies cleanly; all six commitment tables exist | `\dt public.value_commitments` etc. |
| S20-2 | `POST /api/v1/value-commitments` creates a row scoped to the authenticated tenant | Integration test |
| S20-3 | `POST /api/v1/value-commitments/:id/milestones` creates a milestone; parent `progress_percentage` recomputes | Integration test |
| S20-4 | `PATCH /api/v1/value-commitments/:id/metrics/:metricId/actual` records actual value; realization % updates | Integration test |
| S20-5 | `GET /api/v1/value-commitments/:id/progress` returns computed progress (not hardcoded zeros) | Integration test |
| S20-6 | Cross-tenant read returns 404 (existence not leaked) | `pnpm run test:rls` |
| S20-7 | No method in frontend `ValueCommitmentTrackingService` logs "not yet migrated" | Code review |
| S20-8 | US-006: VE can create milestone, record actual value, see realization % | Manual QA on `RealizationStage` |
| S20-9 | `pnpm test` passes | CI |
| S20-10 | `pnpm run test:rls` passes for all six new tables | CI |

---

## Risk Flags

| Risk | Contingency |
|---|---|
| `commitment_notes` table column shape differs from what `ValueCommitmentBackendService.addNote()` expects | Read the archived migration schema before writing the new migration; align column names exactly |
| `recomputeCommitmentProgress` in the backend service queries `commitment_milestones` without `organization_id` filter | Add `organization_id` filter to the recompute query in the same PR as KR 20-2; flag as a tenant isolation fix |
| `VITE_USE_BACKEND_COMMITMENT_API` flag is not set in staging `.env` | Default is `true` (flag must be explicitly `"false"` to disable); document in `.env.example` |
| Sub-resource endpoints added to `valueCommitmentsRouter` but router is not re-exported | Verify `server.ts` mount at `/api/v1/value-commitments` covers all sub-routes (it does — Express prefix routing handles nested paths) |

---

## Cross-Sprint Invariants

These rules apply to every PR in Sprint 20. Sourced from `AGENTS.md`.

| Rule | Enforcement |
|---|---|
| Every DB query on a tenant table includes `organization_id` | Code review + `pnpm run test:rls` |
| Every vector/memory query filters on `tenant_id` in metadata | Code review |
| All agent LLM calls use `this.secureInvoke()` — no direct `llmGateway.complete()` | Code review |
| `service_role` used only in AuthService, tenant provisioning, cron jobs | Code review |
| No cross-tenant data transfer | Code review + RLS |
| No new `any` introduced | `pnpm run lint` |
| Named exports only — no default exports | `pnpm run lint` |
| Zod schemas for all request bodies | Code review |
| Saga pattern: every state mutation has a compensation function | Code review (see `createCommitment` metric seed compensation as the reference pattern) |
