---
owner: team-platform
generated_at: 2026-04-05
source_commit: fe8b2fb54a61
status: active
---

# Sprint Plan — Sprints 20–23: Product Completeness and Platform Hardening

**Author:** Ona (AI Engineering Agent)
**Date:** 2026-06-17 (revised)
**Baseline:** Post-Sprint 19 + significant pre-work completed outside sprint cadence

---

## Baseline

### Current sprint: 20 (first sprint in this horizon)

### What is complete (✅ full traceability)

- Stage 1 Hypothesis — full stack slice live
- Stage 2 Model — full stack slice live
- Stage 3 Integrity — full stack slice live (resolved Sprint 11)
- Stage 4 Narrative — **fully implemented outside sprint cadence**:
  - `NarrativeAgent.ts` ✅ exists in agent-fabric
  - `narrative_drafts` table ✅ (migration `20260321000000_back_half_tables.sql`)
  - `NarrativeDraftRepository.ts` ✅
  - `GET /api/v1/cases/:id/narrative` + `POST /api/v1/cases/:id/narrative/run` ✅ (`backHalf.ts`)
  - `useNarrative.ts` hook ✅; `NarrativeStage.tsx` wired to real data ✅
  - DEBT-005 / issue #1346 resolved
- Stage 5 Realization — **fully implemented outside sprint cadence**:
  - `RealizationAgent.ts` ✅
  - `realization_reports` table ✅ (migration `20260321000000_back_half_tables.sql`)
  - `RealizationReportRepository.ts` ✅
  - `GET /api/v1/cases/:id/realization` + `POST /api/v1/cases/:id/realization/run` ✅
  - `useRealization.ts` hook ✅; `RealizationStage.tsx` wired to real data ✅
  - DEBT-004 / issue #1345 resolved
- Stage 6 Expansion — **fully implemented outside sprint cadence**:
  - `ExpansionAgent.ts` ✅
  - `expansion_opportunities` table ✅ (migration `20260322000000_persistent_memory_tables.sql`)
  - `ExpansionOpportunityRepository.ts` ✅
  - `GET /api/v1/cases/:id/expansion` + `POST /api/v1/cases/:id/expansion/run` ✅
  - `useExpansion.ts` hook ✅; `ExpansionStage.tsx` wired to real data ✅; registered in `LifecycleStageNav` ✅
  - DEBT-009 resolved
- `ValueCaseCanvas.tsx` title — uses `useCase(caseId)` hook; DEBT-006 / issue #1347 resolved
- Six runtime services wired: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine
- `RecommendationEngine` subscribes to `realization.milestone_reached` and emits expansion recommendations
- Billing backend + frontend complete (Phases 0–2)
- RLS on all tenant tables; `pnpm run test:rls` suite wired
- RBAC invalidation degraded-mode test exists (`rbacInvalidation.test.ts`)
- High-volume table partitioning live (`usage_ledger`, `rated_ledger`, `saga_transitions`, `value_loop_events`)

### What is broken / P0

None. No P0 items remain open.

### What is incomplete / P1 (sequenced across sprints)

- **DEBT-007 / #1348** — `ValueCommitmentTrackingService` has 15 TODO stubs; all DB operations return mock data. Milestones, metrics, risks, stakeholders, audit entries are inert.
- **TypeScript `any` debt** — `packages/backend` ~759 usages; `apps/ValyntApp` ~257 usages. Highest-density files: `InputValidator.ts` (21), `AgentCollaborationService.ts` (17), `IntegratedMCPServer.ts` (19), `unified-api-client.ts` (11).
- **Partition scheduler** — `create_next_monthly_partitions()` function exists in DB but no cron job calls it. Without it, new rows fall into `_p_default` and are never pruned.
- **RBAC runbook** — `rbac_redis_unavailable_total` counter and test exist; `docs/runbooks/rbac-redis-unavailable.md` does not.

### What is deferred (post-Sprint 23)

- PPTX export
- Kafka rollout
- Grafana alerting rules wired to incident runbooks
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- US-007 tenant onboarding UI and ingestion pipeline
- US-008 Salesforce adapter (HubSpot complete; Salesforce stubs)
- `expansion.opportunities_identified` CloudEvent subscription in RecommendationEngine (currently uses `realization.milestone_reached` as the expansion trigger — adequate for MVP)

---

## Sprint 20 — Commitment Tracking: Replace Stubs with Real DB (Weeks 1–2)

**Objective:** `ValueCommitmentTrackingService` operates against real Supabase data. No TODO stubs remain.

**Success statement:** A VE can create milestones linked to a closed value case, record actual metric values, and see realization % calculated against committed targets. All commitment data survives page refresh. Audit entries include real actor IDs.

**Depends on:** Sprint 19 complete. `realization_reports` table live (confirmed).

**Architectural rationale:** All six lifecycle stages are now real. The only remaining P1 gap is `ValueCommitmentTrackingService` (DEBT-007), which is the post-deal commitment tracking layer. It shares the `realization_reports` table with `RealizationStage` — the two must be consistent. This sprint resolves the last user-visible stub before the platform can be considered production-safe for post-deal workflows.

**Competitor context:** Gainsight tracks health scores and CS workflows post-deal. ValueOS's commitment tracking — tied to the original value hypothesis and financial model — is a differentiated post-sale capability. It is only differentiated once it is real.

### KR 20-1 — Commitment and milestone write paths

**Debt ref:** DEBT-007 / issue #1348

**Acceptance criteria:**
- `createCommitment()` inserts into `realization_reports` scoped to `organization_id`; returns the created row
- `createMilestone()` appends to the `milestones` jsonb array on the relevant `realization_reports` row
- `updateMilestoneStatus()` updates the milestone entry in-place within the jsonb array
- All writes include `organization_id` filter — no cross-tenant writes possible
- Audit entries use real `actor_id` from request context; no hardcoded `"Unknown"`
- Unit test: each write method inserts/updates and reads back correctly; cross-tenant write returns error

### KR 20-2 — Commitment and metric read paths

**Debt ref:** DEBT-007 / issue #1348

**Acceptance criteria:**
- `getCommitmentsForCase(caseId, orgId)` queries `realization_reports` with both `case_id` and `organization_id` filters
- `getMetricsForCommitment(commitmentId, orgId)` returns the `metrics` jsonb array for the matching row
- `getStakeholdersForCommitment(commitmentId, orgId)` returns the `stakeholders` jsonb array
- All reads return empty arrays (not mock data) when no rows exist
- Cross-tenant read returns empty — not another tenant's data
- Unit test: write then read back; cross-tenant read returns empty

### KR 20-3 — Realization % calculation

**Debt ref:** DEBT-007 / issue #1348

**Acceptance criteria:**
- `calculateRealizationPct(commitmentId, orgId)` computes `realized_value / committed_value` from the `metrics` jsonb array
- Result written to `realization_pct` column on the `realization_reports` row
- Called automatically after `updateMetricActual()` — no manual trigger required
- Returns `null` when no metrics exist (not `0`)
- Unit test: known metric values → expected pct; no metrics → null

### KR 20-4 — Risk and at-risk commitment queries

**Debt ref:** DEBT-007 / issue #1348

**Acceptance criteria:**
- `createRisk()` appends to the `risks` jsonb array on the relevant row
- `updateRisk()` updates the risk entry in-place
- `getAtRiskCommitments(orgId)` queries `realization_reports` where `realization_pct < 0.8` and `organization_id = orgId`
- `validateAgainstBenchmarks(commitmentId, orgId)` reads the commitment row and compares `realization_pct` against a configurable threshold (default 0.8); returns `{ onTrack: boolean, variance: number }`
- Unit test: at-risk query returns only rows below threshold for the correct tenant

### KR 20-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run typecheck` passes
- No TODO comments remain in `ValueCommitmentTrackingService.ts`
- US-006 acceptance criteria met: milestones creatable, actual values recordable, realization % calculated

**Risk flags:**
- `realization_reports` uses jsonb arrays for milestones/metrics/risks/stakeholders. Concurrent writes could cause lost updates. Contingency: use `jsonb_set` with optimistic locking (check `updated_at` before write); return 409 on conflict and let the client retry. Flag for Sprint 21 if contention is observed in staging.
- `ValueCommitmentTrackingService` is in `apps/ValyntApp/src/services/` — a frontend service making direct Supabase calls. This is the existing pattern; do not move it to the backend in this sprint. Flag as architectural debt for a future sprint.

---

## Sprint 21 — TypeScript `any` Reduction: Backend (Weeks 3–4)

**Objective:** `packages/backend` `any` count is reduced by ≥100 usages. The four highest-density files are clean.

**Success statement:** `pnpm run lint` reports fewer than 660 `any` usages in `packages/backend` (down from ~759). No new `any` is introduced in any PR touching the backend.

**Depends on:** Sprint 20 complete (no new backend files being actively written that would introduce `any`).

**Architectural rationale:** With all six stages real and commitment tracking live, Sprint 21 is the first sprint with no new feature work in the backend. The four target files (`InputValidator.ts`, `AgentCollaborationService.ts`, `referrals.ts`, `admin.ts`) account for ~79 usages and are self-contained — changes do not ripple across the system.

### KR 21-1 — `InputValidator.ts` clean

**Debt ref:** Ongoing TypeScript `any` debt; `config/secrets/InputValidator.ts` (21 usages)

**Acceptance criteria:**
- All 21 `any` usages replaced with Zod schemas or typed alternatives
- No `any` remains in the file
- Existing validation behaviour is unchanged (tests pass)
- `pnpm run typecheck` passes

### KR 21-2 — `AgentCollaborationService.ts` clean

**Debt ref:** Ongoing TypeScript `any` debt; `services/collaboration/AgentCollaborationService.ts` (17 usages)

**Acceptance criteria:**
- Agent message payload `any` types replaced with typed union derived from `packages/shared/src/domain/`
- No `any` remains in the file
- `pnpm run typecheck` passes

### KR 21-3 — `referrals.ts` and `admin.ts` clean

**Debt ref:** Ongoing TypeScript `any` debt; `api/referrals.ts` (21 usages), `api/admin.ts` (22 usages)

**Acceptance criteria:**
- Request body types added to both files using Zod schemas
- No `any` remains in either file
- `pnpm run typecheck` passes

### KR 21-4 — `any` reduction: `apps/ValyntApp` highest-density files

**Debt ref:** Ongoing TypeScript `any` debt; `apps/ValyntApp` ~257 usages

**Acceptance criteria:**
- Run `grep -rn ": any" apps/ValyntApp/src --include="*.ts" --include="*.tsx" | sed 's/:.*//' | sort | uniq -c | sort -rn | head -5` to identify the five highest-density files
- Replace `any` in the top 3 files (≥30 usages removed from `apps/ValyntApp`)
- `pnpm run typecheck` passes

### KR 21-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run lint` passes
- `pnpm run typecheck` passes
- Net `any` reduction in `packages/backend`: ≥100 usages removed from baseline (~759)
- No new `any` introduced in any file touched this sprint

**Risk flags:**
- `AgentCollaborationService.ts` message payload types may not have a canonical definition in `packages/shared`. Contingency: define an `AgentMessage` union type in `packages/backend/src/types/` scoped to the service; do not block on a shared package change.
- Replacing `any` in `InputValidator.ts` may surface latent type errors in callers. Contingency: fix caller type errors in the same PR; do not use `as unknown as X` casts to paper over them.

---

## Sprint 22 — Partition Scheduler and RBAC Runbook (Weeks 5–6)

**Objective:** The monthly partition creation cron job is wired and tested. The RBAC degraded-security runbook exists and is linked from the alert.

**Success statement:** `create_next_monthly_partitions()` is called on a monthly schedule before the first month boundary after deployment. The `rbac_redis_unavailable_total` alert has a linked runbook with diagnosis and remediation steps.

**Depends on:** Sprint 21 complete. No new feature work in this sprint.

**Architectural rationale:** The partition scheduler gap (documented in `decisions.md`) is a data integrity risk: without it, new rows fall into `_p_default` and are never pruned. The RBAC runbook gap means the `rbac_redis_unavailable_total` alert fires with no documented response path. Both are pre-production safety items with no feature dependency.

### KR 22-1 — Partition scheduler wired

**Debt ref:** `decisions.md` — High-volume table partitioning; scheduler requirement

**Acceptance criteria:**
- Migration `20260718000000_pg_cron_partition_scheduler.sql` registers the cron job:
  ```sql
  SELECT cron.schedule('partition-monthly', '0 0 1 * *',
    $$SELECT public.create_next_monthly_partitions()$$);
  ```
- Paired rollback: `SELECT cron.unschedule('partition-monthly');`
- Migration applies cleanly against local Supabase with `pg_cron` enabled
- `docs/runbooks/partition-maintenance.md` documents: how to verify the job ran, how to manually trigger it, what to do if `_p_default` grows
- `decisions.md` updated: scheduler requirement marked as resolved

### KR 22-2 — RBAC degraded-security runbook

**Debt ref:** `decisions.md` — RBAC invalidation degraded-security mode

**Acceptance criteria:**
- `docs/runbooks/rbac-redis-unavailable.md` created with:
  - Detection: `rbac_redis_unavailable_total` counter; alert fires after 5 minutes of sustained increments
  - Diagnosis: check Redis connectivity, check `rbacInvalidation.ts` logs for `warn`/`error` entries
  - Impact: stale permissions possible for up to `RBAC_CACHE_TTL_SECONDS` (default 300s) in multi-instance deployments
  - Remediation option A: restore Redis connectivity
  - Remediation option B: set `RBAC_CACHE_TTL_SECONDS=0` to force DB check on every request (performance cost documented)
  - Escalation: if neither option resolves within 15 minutes, restart affected instances to flush in-process caches
- `RBAC_CACHE_TTL_SECONDS` env var documented in the runbook and in `.env.example` (or equivalent)
- Alert annotation updated to link to the runbook URL (if `infra/k8s/monitoring/rbac-alerts.yaml` exists; otherwise add link as comment in `rbacInvalidation.ts`)

### KR 22-3 — `any` reduction: `apps/ValyntApp` continued

**Debt ref:** Ongoing TypeScript `any` debt; `apps/ValyntApp` remaining usages

**Acceptance criteria:**
- Continue from Sprint 21 KR 21-4: clean the next 3 highest-density files in `apps/ValyntApp`
- ≥30 additional `any` usages removed from `apps/ValyntApp`
- `pnpm run typecheck` passes

### KR 22-4 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run typecheck` passes
- `pnpm run lint` passes

**Risk flags:**
- `pg_cron` may not be enabled on the Supabase project. Contingency: implement the scheduler as a BullMQ repeatable job in `packages/backend/src/jobs/` that calls `SELECT public.create_next_monthly_partitions()` via the service role client; document this as the fallback in the runbook.
- `infra/k8s/monitoring/rbac-alerts.yaml` may not exist if the Kubernetes monitoring stack is not deployed. Contingency: add the runbook link as a comment in `rbacInvalidation.ts` instead; note the gap in the runbook itself.

---

## Sprint 23 — TypeScript `any` Reduction: Frontend + Final Hardening (Weeks 7–8)

**Objective:** Total `any` count across the codebase is below 900 (down from ~1,016 combined backend + ValyntApp baseline at sprint start). No new `any` is introduced in any PR.

**Success statement:** `pnpm run lint` reports fewer than 900 combined `any` usages. The `any` reduction dashboard in `docs/debt/ts-any-dashboard.md` is updated with the new baseline.

**Depends on:** Sprint 22 complete.

**Architectural rationale:** After Sprint 22, all P1 debt items are resolved and the platform is production-safe. Sprint 23 is a pure quality sprint. Reducing `any` below 900 combined (from ~1,016) is a meaningful milestone — it brings the codebase within reach of the <100 target over the next two quarters without requiring a dedicated refactor sprint.

### KR 23-1 — `apps/ValyntApp` `any` reduction: remaining high-density files

**Debt ref:** Ongoing TypeScript `any` debt; `apps/ValyntApp` ~257 usages at sprint start

**Acceptance criteria:**
- Clean the remaining highest-density files not addressed in Sprints 21–22
- Target: ≥60 additional `any` usages removed from `apps/ValyntApp`
- Priority order: `IntegratedMCPServer.ts` (19), `unified-api-client.ts` (11), `performance.ts` (10), `logger.ts` (10)
- `pnpm run typecheck` passes

### KR 23-2 — `packages/sdui` and `packages/mcp` `any` reduction

**Debt ref:** Ongoing TypeScript `any` debt; `packages/sdui` ~133 usages, `packages/mcp` ~96 usages

**Acceptance criteria:**
- Identify the 3 highest-density files in each package
- Remove ≥20 `any` usages from `packages/sdui`
- Remove ≥15 `any` usages from `packages/mcp`
- `pnpm run typecheck` passes for both packages

### KR 23-3 — `any` dashboard updated

**Debt ref:** Ongoing TypeScript `any` debt

**Acceptance criteria:**
- `docs/debt/ts-any-dashboard.md` updated with per-module counts measured at end of Sprint 23
- Monthly targets revised based on actual reduction velocity from Sprints 21–23
- Combined total confirmed below 900

### KR 23-4 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run typecheck` passes
- `pnpm run lint` passes
- No new `any` introduced in any file touched across Sprints 21–23

**Risk flags:**
- `IntegratedMCPServer.ts` is in `apps/ValyntApp/src/mcp-ground-truth/` — a non-standard location. Contingency: if the file is generated or auto-synced, do not edit it directly; add a lint rule to block `any` in that path and fix the generator.
- Removing `any` from `packages/sdui` may require updating SDUI component prop interfaces. Contingency: update `config/ui-registry.json` and `packages/sdui/src/registry.tsx` in the same PR if prop interfaces change (per AGENTS.md SDUI registration rule).

---

## Cross-Sprint Invariants

These rules apply to every PR across all four sprints. Sourced from `AGENTS.md`.

| Rule | Enforcement |
|---|---|
| Every DB query on a tenant table includes `organization_id` or `tenant_id` | Code review + `pnpm run test:rls` |
| Every vector/memory query filters on `tenant_id` in metadata | Code review |
| All agent LLM calls use `this.secureInvoke()` — no direct `llmGateway.complete()` | Code review |
| `service_role` used only in AuthService, tenant provisioning, cron jobs | Code review |
| No cross-tenant data transfer | Code review + RLS |
| No new `any` introduced | `pnpm run lint` |
| Named exports only — no default exports | `pnpm run lint` |
| Zod schemas for all LLM responses; include `hallucination_check: boolean` | Code review |
| Saga pattern: every state mutation has a compensation function | Code review |
| `WorkflowState` persisted to Supabase after every node transition | Code review |

---

## Deferred Items

| Item | Reason |
|---|---|
| DEBT-011 — SandboxedExecutor E2B SDK | Product decision pending |
| DEBT-012 — VOSAcademy content loader | Content strategy pending |
| PPTX export | No traceability row; product decision pending |
| Kafka rollout | Infrastructure decision pending |
| Grafana alerting rules → incident runbooks | Requires Grafana deployment |
| `DeviceFingerprintService` GeoIP / threat intelligence | Post-GA |
| `EnhancedParallelExecutor` WebSocket progress | Post-GA |
| US-007 tenant onboarding UI + ingestion pipeline | Post-GA |
| US-008 Salesforce adapter | Post-GA |
| `expansion.opportunities_identified` CloudEvent subscription | Deferred; `realization.milestone_reached` is adequate for MVP |
| SOC 2 evidence collection | Requires complete product |
| Performance SLOs and load testing | Requires complete product |
| Quarterly observability gap review (§25) | Scheduled post-Sprint 23 |

---

## Sprint Dependency Chain

```
Sprint 20: ValueCommitmentTrackingService stubs → real DB (last P1 debt item)
    ↓ (no new backend files being written; safe to clean existing ones)
Sprint 21: packages/backend any reduction (4 highest-density files)
    ↓ (backend clean; no new feature work)
Sprint 22: partition scheduler + RBAC runbook + ValyntApp any continued
    ↓ (all P1 debt resolved; all safety items addressed)
Sprint 23: ValyntApp + sdui + mcp any reduction; dashboard updated
```
