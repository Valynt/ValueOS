# Sprint Plan — Sprints 15–18: Data Observability

**Author:** Ona (AI Engineering Agent)
**Date:** 2026-06-10
**Baseline:** Post-Sprint 14 (beta hardening complete: PDF export, billing math, performance indexes, type safety pass)

---

## Strategic Framing

ValueOS accumulates institutional knowledge across the value lifecycle. That knowledge is only trustworthy if the data pipelines, agent outputs, and memory stores that produce it are observable. Without observability, a stale hypothesis, a failed realization report, or a silently-dropped embedding is invisible until a customer notices.

This planning horizon applies the data observability checklist to ValueOS's specific architecture: Supabase (Postgres + RLS), BullMQ queues, agent-fabric pipelines, `semantic_memory` (pgvector), Prometheus metrics, and the six runtime services. The goal is a platform where data failures are detected before users report them.

**Checklist coverage by sprint:**
- Sprint 15: Foundation — inventory, ownership, freshness, volume, pipeline status
- Sprint 16: Schema drift, lineage, quality rules, incident process
- Sprint 17: Distribution anomaly detection, streaming/queue observability, AI/vector pipeline coverage
- Sprint 18: Cost visibility, compliance observability, governance standards, SLO attainment

---

## Baseline

### What is complete (✅ traceability)
- Stages 1–3 (Hypothesis, Model, Integrity) — full stack slices live
- Six runtime services wired: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine
- `valueLoopMetrics.ts` — Prometheus counters for stage transitions, agent invocations, hypothesis confidence
- `AuditLogger` — append-only `agent_audit_log`
- RLS policies on all tenant tables; `pnpm run test:rls` suite exists

### What is broken / P1 debt (must appear in Sprint 15)
- `valueCasesRouter` not mounted in `server.ts` → all `/api/v1/value-cases/...` return 404 (Stage 1 gap, traceability.md)
- DEBT-004 / #1345 — `RealizationStage` hardcoded; no `realization_outputs` table
- DEBT-005 / #1346 — `NarrativeAgent.ts` does not exist
- DEBT-006 / #1347 — `ValueCaseCanvas` hardcodes case title
- DEBT-007 / #1348 — `ValueCommitmentTrackingService` all stubs

### What is incomplete / P2 debt (sequenced across sprints)
- DEBT-009 — `expansion_outputs` table and repository missing
- DEBT-010 — SecurityMonitor alert channels are stubs
- No data asset inventory or criticality tiers
- No freshness monitoring on agent output tables
- No volume anomaly detection
- No schema drift detection
- No pipeline execution observability beyond Prometheus counters
- No lineage map from source → agent → DB table → dashboard
- No SLA/SLO definitions for data products
- No incident runbooks for data failures
- No cost attribution by data domain
- No compliance observability for sensitive data access

### What is deferred (post-Sprint 18)
- PPTX export
- Kafka rollout
- Grafana alerting rules (dashboard in Sprint 13; alert rules post-beta)
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- DEBT-008 — ServiceNow, Slack, SharePoint integrations (product decision pending)
- DEBT-011 — SandboxedExecutor E2B SDK (product decision pending)
- DEBT-012 — VOSAcademy content loader (content strategy pending)

---

## Sprint 15 — Foundation and Visibility (Weeks 1–2)

**Objective:** Every critical data asset has a named owner, a criticality tier, and active freshness + pipeline-status monitoring.

**Architectural rationale:** Observability cannot be layered onto unknown assets. The minimum production-safe baseline from the checklist — inventory, ownership, freshness, volume, pipeline failure monitoring — must exist before anomaly detection or quality rules are meaningful. This sprint also resolves the `valueCasesRouter` P0 mount gap, which blocks all Stage 1–3 data reads in production.

**Depends on:** Sprint 14 (performance indexes, type safety pass)

### KR 15-1 — Fix `valueCasesRouter` mount (P0 blocker, traceability Stage 1)

**Debt ref:** Stage 1 traceability gap  
**Acceptance criteria:**
- `server.ts` imports `valueCasesRouter` and mounts it at `/api/v1/value-cases` with `requireAuth` and `tenantContextMiddleware()` → all Stage 1–3 GET endpoints return 200 with real data
- `GET /api/v1/value-cases/:caseId/hypothesis` returns persisted hypothesis output for a known case
- `pnpm test` green

### KR 15-2 — Data asset inventory with criticality tiers

**Checklist refs:** §2 (asset inventory), §13 (ownership)  
**Acceptance criteria:**
- `docs/observability/data-asset-inventory.md` lists every production table, agent output table, BullMQ queue, and `semantic_memory` partition with: owner team, criticality tier (T1/T2/T3), expected freshness SLA, and upstream agent
- T1 assets (business-critical): `hypothesis_outputs`, `value_tree_nodes`, `financial_model_snapshots`, `integrity_outputs`, `narrative_drafts`, `realization_reports`, `expansion_opportunities`, `semantic_memory`, `agent_audit_log`
- Every T1 asset has a named owner (team or individual) in the inventory
- Inventory is linked from `AGENTS.md` Key File Pointers table

### KR 15-3 — Freshness monitoring for T1 agent output tables

**Checklist refs:** §4 (freshness monitoring)  
**Acceptance criteria:**
- `packages/backend/src/observability/dataFreshness.ts` exports `checkTableFreshness(table, thresholdMinutes, orgId)` — queries `MAX(updated_at)` per tenant-scoped table and emits `data_freshness_lag_minutes` Prometheus gauge with labels `{table, tier}`
- Freshness check runs on a 5-minute cron for all T1 tables
- Stale threshold: T1 tables alert when lag exceeds 2× the expected freshness SLA defined in the inventory
- `GET /health/dependencies` includes `data_freshness` key with per-table status
- Unit test: mock Supabase client, verify gauge emitted with correct labels

### KR 15-4 — Volume monitoring for T1 tables

**Checklist refs:** §5 (volume monitoring)  
**Acceptance criteria:**
- `packages/backend/src/observability/dataVolume.ts` exports `checkTableVolume(table, orgId)` — queries row count delta over the last 24h and emits `data_volume_row_delta` Prometheus gauge with labels `{table, tier}`
- Sudden drop >50% from 7-day rolling average emits `data_volume_anomaly_total` counter
- Partial load detection: if an agent run completes but writes 0 rows to its output table, emit `data_partial_load_total` counter with `{agent, table}` labels
- Unit test: verify counter incremented on zero-row write

### KR 15-5 — Pipeline execution observability for BullMQ queues

**Checklist refs:** §9 (pipeline execution observability)  
**Acceptance criteria:**
- `packages/backend/src/observability/queueMetrics.ts` wraps BullMQ event hooks: `completed`, `failed`, `stalled`, `active` — emits `queue_job_total{queue, status}` Prometheus counter
- Job duration tracked via `queue_job_duration_seconds` histogram with `{queue}` label
- Failed jobs log `{ queue, jobId, failedReason, attemptsMade, data.caseId, data.orgId }` at ERROR level — no PII
- `GET /health/dependencies` includes `queues` key listing each queue name and its last-failed-job timestamp
- `pnpm test` green; `pnpm run test:rls` green

**Risk:** BullMQ event hook API may differ across versions.  
**Contingency:** Fall back to polling `queue.getJobCounts()` on a 30-second interval if event hooks are unavailable.

---

## Sprint 16 — Schema Drift, Lineage, Quality, and Incidents (Weeks 3–4)

**Objective:** Breaking schema changes are detected before they reach production. Every T1 data failure has a runbook and an owner who gets paged.

**Architectural rationale:** Freshness and volume monitoring (Sprint 15) tell you *when* data is missing. Schema drift detection tells you *why*. Lineage tells you *what is affected*. Incident runbooks tell you *what to do*. These three capabilities compound — without them, a schema change in `hypothesis_outputs` silently breaks `HypothesisStage` with no path to diagnosis.

**Depends on:** Sprint 15 (inventory, freshness, volume monitoring live)

### KR 16-1 — Schema drift detection for T1 tables

**Checklist refs:** §6 (schema observability)  
**Acceptance criteria:**
- `packages/backend/src/observability/schemaDrift.ts` exports `captureSchemaSnapshot(tables[])` — queries `information_schema.columns` for each table and stores a JSON snapshot to `docs/observability/schema-snapshots/`
- `detectSchemaDrift(table, snapshot)` compares current schema against snapshot; returns diff with change type: `added_column | removed_column | type_changed | nullability_changed`
- Breaking changes (removed column, type changed) emit `schema_drift_breaking_total` Prometheus counter with `{table, change_type}` labels
- Schema snapshot CI check: `pnpm run schema:snapshot` runs in CI; fails if a breaking change is detected without a corresponding migration file in `infra/supabase/supabase/migrations/`
- Unit test: verify diff detection for each change type

### KR 16-2 — End-to-end lineage map for T1 lifecycle stages

**Checklist refs:** §3 (lineage and dependency visibility)  
**Acceptance criteria:**
- `docs/observability/lineage.md` documents the full lineage for each T1 stage: source signal → agent → DB table → repository → API endpoint → frontend hook → UI component
- Lineage entries reference the traceability map in `.ona/context/traceability.md` (no duplication — lineage.md adds blast-radius annotations)
- Each lineage entry includes: "if this table is stale/missing, these downstream components are affected"
- Lineage is machine-readable: `docs/observability/lineage.json` mirrors the markdown with a structured schema for programmatic blast-radius queries
- `packages/backend/src/observability/lineageRegistry.ts` exports `getDownstreamImpact(table): string[]` — returns affected API endpoints and UI components

### KR 16-3 — Data quality rules for T1 agent output tables

**Checklist refs:** §7 (data quality monitoring)  
**Acceptance criteria:**
- `packages/backend/src/observability/dataQuality.ts` defines quality rules per T1 table:
  - `hypothesis_outputs`: `hypotheses` array non-empty, `confidence` in `['high','medium','low']`, `organization_id` non-null
  - `value_tree_nodes`: `label` non-null, `node_type` in allowed enum, `case_id` non-null
  - `integrity_outputs`: `overall_score` between 0.0–1.0, `claims` array non-empty
  - `semantic_memory`: `embedding` non-null, `organization_id` non-null, `status` in `['active','archived']`
- `runQualityChecks(table, orgId)` returns `{ passed: number; failed: number; violations: QualityViolation[] }`
- Quality check runs post-agent-write; violations emit `data_quality_violation_total{table, rule}` counter
- Unit test: each rule fires correctly on a crafted violation row

### KR 16-4 — Incident process for data failures

**Checklist refs:** §11 (data incident management)  
**Acceptance criteria:**
- `docs/observability/incident-runbooks/` contains runbooks for: stale T1 table, schema drift breaking change, agent output zero-row write, queue job stalled >10 minutes, `semantic_memory` embedding lag
- Each runbook: severity level, detection signal (which metric/alert fires), diagnosis steps, remediation steps, escalation path
- Incident severity levels defined in `docs/observability/incident-severity.md`: P0 (data unavailable for active users), P1 (data stale >2× SLA), P2 (quality violations >5% of rows), P3 (anomaly detected, no user impact yet)
- `DEBT-010` resolved: `SecurityMonitor` alert channels (`sendEmailAlert`, `sendSlackAlert`, `sendPagerDutyAlert`) implemented — fire-and-forget with error logging, missing env vars log WARN and do not throw
- Unit tests for all three alert channel methods: mock HTTP, verify payload shape

**Risk:** `SLACK_WEBHOOK_URL` and `PAGERDUTY_ROUTING_KEY` may not be set in all environments.  
**Contingency:** All alert methods degrade gracefully — log WARN with full payload when env var absent. Frontend flow is never blocked by missing alert credentials.

### KR 16-5 — Test gate: schema snapshot + quality checks in CI

**Checklist refs:** §22 (testing and validation strategy)  
**Acceptance criteria:**
- `pnpm run schema:snapshot` added to CI pipeline; fails on unacknowledged breaking changes
- `pnpm run data:quality` runs quality checks against local Supabase; fails if violation rate >0% on T1 tables in a clean seed
- `pnpm test` green; `pnpm run test:rls` green

---

## Sprint 17 — Anomaly Detection, Streaming, and AI/Vector Observability (Weeks 5–6)

**Objective:** Distribution anomalies in agent outputs are detected automatically. BullMQ queue health is visible. Vector memory freshness and embedding drift are observable.

**Architectural rationale:** Sprints 15–16 cover the deterministic layer (freshness, volume, schema, quality rules). Sprint 17 covers the probabilistic layer — distribution drift in LLM outputs, queue consumer lag, and vector index staleness. These are the failure modes most likely to be invisible without explicit instrumentation in an agentic system. ValueOS's competitive differentiation (persistent value memory, compounding lifecycle intelligence) depends on the vector layer being trustworthy.

**Depends on:** Sprint 16 (quality rules and lineage live; incident process defined)

### KR 17-1 — Distribution drift detection for agent confidence scores

**Checklist refs:** §8 (distribution and anomaly detection), §19 (AI/ML and agentic data observability)  
**Acceptance criteria:**
- `packages/backend/src/observability/distributionMonitor.ts` exports `trackConfidenceDistribution(agent, score, orgId)` — called by each agent after `secureInvoke`; records score in a rolling 7-day window per agent per tenant
- `detectConfidenceDrift(agent, orgId)` computes mean and stddev over the window; emits `agent_confidence_drift_total{agent}` counter when current score deviates >2σ from the rolling mean
- Hallucination signal rate tracked: `agent_hallucination_signal_rate{agent}` gauge = (runs with `hallucination_check: true`) / (total runs) over 24h
- Unit test: drift detection fires correctly on a crafted sequence of scores

### KR 17-2 — BullMQ consumer lag and stall observability

**Checklist refs:** §18 (streaming and real-time data observability), §9 (pipeline execution)  
**Acceptance criteria:**
- `packages/backend/src/observability/queueHealth.ts` exports `checkQueueLag(queue)` — returns `{ waiting: number; active: number; delayed: number; failed: number; stalledCount: number }`
- `queue_consumer_lag{queue}` Prometheus gauge = waiting + delayed job count; alert threshold: >50 jobs waiting for >5 minutes
- Stalled job detection: jobs active >10 minutes without a heartbeat emit `queue_stalled_job_total{queue}` counter
- `GET /health/dependencies` `queues` key updated to include lag and stall counts
- Unit test: mock BullMQ `getJobCounts()`, verify gauge values

### KR 17-3 — Vector memory freshness and embedding drift

**Checklist refs:** §19 (AI/ML and agentic data observability)  
**Acceptance criteria:**
- `packages/backend/src/observability/vectorHealth.ts` exports `checkEmbeddingFreshness(orgId)` — queries `semantic_memory` for rows where `updated_at < NOW() - INTERVAL '24 hours'` and `status = 'active'`; emits `vector_embedding_stale_total{org_tier}` counter
- Orphaned embedding detection: `checkOrphanedEmbeddings(orgId)` — finds `semantic_memory` rows whose `value_case_id` no longer exists in `value_cases`; emits `vector_orphaned_embedding_total` counter
- Re-index lag: when a source document (hypothesis, integrity output) is updated, the corresponding `semantic_memory` row must be updated within 5 minutes; lag >5 minutes emits `vector_reindex_lag_minutes` gauge
- `GET /health/dependencies` includes `vector_memory` key with stale count and orphan count
- Unit test: orphan detection fires when case is deleted but embedding remains

### KR 17-4 — Realization and Expansion stage persistence (DEBT-004, DEBT-009)

**Debt refs:** DEBT-004 / #1345, DEBT-009  
**Acceptance criteria:**
- `realization_outputs` migration: `id`, `organization_id`, `case_id`, `session_id`, `milestones jsonb`, `metrics jsonb`, `risks jsonb`, `realization_pct numeric`, `source_agent text`, `created_at`, `updated_at`; RLS via `security.user_has_tenant_access()`
- `expansion_outputs` migration: `id`, `organization_id`, `case_id`, `session_id`, `opportunities jsonb`, `gap_analysis jsonb`, `expansion_seeds jsonb`, `source_agent text`, `created_at`; RLS
- `RealizationOutputRepository.ts` and `ExpansionOutputRepository.ts` — `createOutput`, `getLatestForCase`
- `RealizationAgent.ts` and `ExpansionAgent.ts` wired to persist via repositories
- `GET /api/v1/value-cases/:caseId/realization` and `GET /api/v1/value-cases/:caseId/expansion` return real data
- `RealizationStage.tsx` and `ExpansionStage.tsx` wired to real endpoints — no hardcoded data
- `pnpm run test:rls` green for both new tables

**Risk:** `ValueCommitmentTrackingService` (DEBT-007) has 12+ TODO stubs; full resolution may exceed sprint capacity.  
**Contingency:** Implement `realization_outputs` persistence path first (unblocks the stage); stub resolution for `ValueCommitmentTrackingService` continues in Sprint 18 if not complete.

### KR 17-5 — Test gate: observability suite

**Checklist refs:** §22 (testing and validation)  
**Acceptance criteria:**
- `pnpm run test:observability` script added — runs all observability unit tests in `packages/backend/src/observability/__tests__/`
- Tests cover: freshness check, volume check, schema drift, quality rules, confidence drift, queue lag, vector orphan detection
- All tests pass with mocked Supabase and Prometheus clients
- `pnpm test` green; `pnpm run test:rls` green

---

## Sprint 18 — Cost Visibility, Compliance, Governance, and SLO Attainment (Weeks 7–8)

**Objective:** Data platform cost is attributed by domain. Sensitive data access is auditable. SLO attainment is measurable. Governance standards are enforced at the PR boundary.

**Architectural rationale:** Sprints 15–17 build the detection layer. Sprint 18 closes the loop: cost attribution prevents silent spend growth, compliance observability satisfies enterprise audit requirements, and SLO measurement turns the monitoring infrastructure into a feedback signal for engineering priorities. This sprint also resolves remaining P1 debt (DEBT-005 NarrativeAgent, DEBT-006 canvas title, DEBT-007 commitment tracking stubs) that was deferred from Sprint 11.

**Depends on:** Sprint 17 (anomaly detection, vector health, realization/expansion persistence live)

### KR 18-1 — NarrativeAgent and full canvas wiring (DEBT-005, DEBT-006)

**Debt refs:** DEBT-005 / #1346, DEBT-006 / #1347  
**Acceptance criteria:**
- `packages/backend/src/lib/agent-fabric/agents/NarrativeAgent.ts` — extends `BaseAgent`, `lifecycleStage = "composing"`, `version = "1.0.0"`, uses `secureInvoke` with Zod schema including `hallucination_check: z.boolean().optional()`, confidence threshold 0.6–0.85, persists to `narrative_drafts` via `NarrativeDraftRepository`, stores memory with `this.organizationId`
- Registered in `AgentFactory.ts`
- `NarrativeStage.tsx` wired to `GET /api/v1/value-cases/:caseId/narrative` — no hardcoded content
- `ValueCaseCanvas.tsx` header replaced with `useCase(caseId)` hook rendering `case.title` and `case.organization_name` — no "Acme Corp" literal
- Unit test for `NarrativeAgent` (mock `LLMGateway` + `MemorySystem`)
- `pnpm test` green

### KR 18-2 — ValueCommitmentTrackingService stub resolution (DEBT-007)

**Debt ref:** DEBT-007 / #1348  
**Acceptance criteria:**
- All 12+ TODO stubs in `ValueCommitmentTrackingService.ts` replaced with real Supabase queries scoped to `organization_id`
- Milestones, metrics, risks, stakeholders, and audit entries write to and read from `realization_outputs` (created in Sprint 17)
- Audit entries include real `actor_id` from request context — no hardcoded `"Unknown"`
- Unit test: each method writes and reads back correctly; cross-tenant read returns empty

### KR 18-3 — Cost attribution by data domain

**Checklist refs:** §16 (cost and efficiency visibility)  
**Acceptance criteria:**
- `packages/backend/src/observability/costAttribution.ts` exports `recordLLMCost(agent, tokens, model, orgId)` — called by `BaseAgent.secureInvoke` after each LLM call; emits `llm_cost_tokens_total{agent, model}` counter
- `recordStorageCost(table, rowsWritten, orgId)` — called by each repository write; emits `storage_writes_total{table}` counter
- `GET /api/v1/admin/cost-summary` (admin-only) — returns per-agent token usage and per-table write counts for the last 30 days, scoped to `organization_id`
- Waste detection: `detectUnusedTables(orgId)` — tables with 0 reads in 30 days emit `data_unused_table_total` counter
- Unit test: cost recording and waste detection

### KR 18-4 — Compliance observability for sensitive data access

**Checklist refs:** §17 (security and compliance observability)  
**Acceptance criteria:**
- `packages/backend/src/observability/complianceMonitor.ts` exports `auditSensitiveAccess(table, operation, actorId, orgId)` — called on read/write to `semantic_memory`, `agent_audit_log`, and any table tagged `sensitivity: high` in the asset inventory
- Unexpected permission changes: `detectPermissionDrift()` — compares current RLS policies against a stored baseline snapshot; emits `rls_policy_drift_total` counter on deviation
- Data retention policy: `checkRetentionViolations(orgId)` — finds `semantic_memory` rows older than the tenant's configured retention period; emits `data_retention_violation_total` counter
- All compliance events written to `agent_audit_log` with `action: "sensitive_access"` and `resource_id` set to the table name
- Unit test: permission drift detection fires on a crafted policy change

### KR 18-5 — SLO definitions and attainment measurement

**Checklist refs:** §10 (data reliability SLAs and SLOs)  
**Acceptance criteria:**
- `docs/observability/slo-definitions.md` defines SLOs for T1 data products:
  - Freshness: hypothesis/integrity/narrative/realization outputs updated within 5 minutes of agent run completing
  - Completeness: agent output tables have 0 zero-row writes per 24h window
  - Availability: `/api/v1/value-cases/...` endpoints return 2xx for >99.5% of requests over 7 days
  - Quality: data quality violation rate <1% of rows per T1 table per 24h
- `packages/backend/src/observability/sloTracker.ts` exports `computeSLOAttainment(slo, window)` — reads from Prometheus metrics collected in Sprints 15–17; returns `{ target: number; actual: number; withinBudget: boolean }`
- `GET /api/v1/admin/slo-report` (admin-only) — returns current attainment for all defined SLOs, scoped to `organization_id`
- `pnpm test` green; `pnpm run test:rls` green

**Risk:** SLO attainment computation requires Prometheus query API; may not be available in all dev environments.  
**Contingency:** Fall back to direct Supabase queries for attainment calculation in environments without Prometheus. The `sloTracker` accepts a pluggable `MetricsReader` interface.

---

## Cross-Sprint Invariants (AGENTS.md non-negotiables)

| Rule | Applies to |
|---|---|
| Every DB query includes `organization_id` or `tenant_id` | All observability queries, cost attribution, compliance monitor |
| All agent LLM calls use `this.secureInvoke()` | NarrativeAgent (KR 18-1) |
| `service_role` only in AuthService, tenant provisioning, cron jobs | Freshness/volume cron jobs must use `service_role` only for the cron scheduler, not for query execution |
| TypeScript strict mode — no `any`, use `unknown` + type guards | All new observability modules |
| Named exports only | All new files |
| New agents: extend `BaseAgent`, Zod schema with `hallucination_check`, Handlebars prompts, confidence thresholds by risk tier | NarrativeAgent (KR 18-1) |

---

## Cross-Sprint Milestones

| Milestone | Reached when |
|---|---|
| Minimum production-safe observability baseline | Sprint 15 complete |
| Schema drift and incident process live | Sprint 16 complete |
| AI/vector pipeline observable; Realization/Expansion real | Sprint 17 complete |
| Full governance, compliance, and SLO attainment | Sprint 18 complete |

---

## Deferred (Post-Sprint 18)

- PPTX export
- Kafka rollout
- Grafana alerting rules (dashboard in Sprint 13; alert rules post-beta)
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- DEBT-008 — ServiceNow, Slack, SharePoint integrations (product decision pending)
- DEBT-011 — SandboxedExecutor E2B SDK (product decision pending)
- DEBT-012 — VOSAcademy content loader (content strategy pending)
- Grafana alerting rules wired to incident runbooks (runbooks in Sprint 16; alert rules post-beta)
- Checklist §25 maturity review — quarterly observability gap review process
- Checklist §20 alert fatigue tracking — false-positive rate measurement
