---
owner: team-platform
generated_at: 2026-04-05
source_commit: fe8b2fb54a61
status: active
---

# Sprint Plan — Sprints 11–14: Complete the Value Loop

**Author:** Lead DevOps / Lead Developer
**Date:** 2026-03-20
**Baseline:** Post-Sprint 10 (UAO deleted, six runtime services wired: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine; ValueLoopAnalytics live)

---

## Strategic Framing

### Product Principle: Persistent Value Memory

ValueOS should remember what was assumed, what evidence supported it, what was defensible, what actually happened, and what should happen next. This memory must be durable, inspectable, provenance-backed, lifecycle-aware, retrieval-ready, and explicit about degraded states.

Most AI systems have memory that is ephemeral, hidden, or loosely governed. ValueOS should be different — accumulating institutional knowledge across the value lifecycle and making it usable for stronger future business cases, better integrity review, better realization tracking, and better executive defensibility.

**No silent memory failure in a system that claims auditability.**

### Current State

**Strong:** Hypothesis and modeling stages are real and persist data. Six runtime services are in place. Six-agent fabric is real. SDUI infrastructure is strong. Multi-tenancy and RLS are directionally solid.

**Incomplete:** Integrity, Narrative, and Realization canvas stages rely on hardcoded/demo UI. Narrative is not a first-class agent-fabric citizen. IntegrityAgent, RealizationAgent, and ExpansionAgent rely on memory persistence that is not guaranteed in a fresh DB (`semantic_memory` exists only in archived migrations). `changePlan()` is a stub. Audit, alerting, and observability contain important placeholders.

---

## Sprint 11 — Complete the Value Loop (Weeks 1–2)

**Theme:** Turn the back half of the product from demo-grade to real.

**Goal:** Integrity, Narrative, and Realization are fully real, persistent, and visible in the product. No hardcoded data remains anywhere in the primary canvas path.

**Success statement:** A user can run all six stages end-to-end. Every stage reads from the database. Refreshing the page shows the same data. No "Acme Corp."

### Deliverables

- All six stages backed by real persistence
- Integrity is a stored artifact, not transient runtime output
- Narrative drafts can be created, retrieved, and regenerated
- Realization reports stored and rendered from DB-backed data

### Stories

**S11-1 — DB: integrity_results, narrative_drafts, realization_reports**
- `infra/supabase/supabase/migrations/20260321000000_back_half_tables.sql`
- `integrity_results`: `id`, `organization_id`, `value_case_id`, `session_id`, `claims jsonb`, `veto_decision text`, `overall_score numeric`, `source_agent text`, `created_at`, `updated_at`
- `narrative_drafts`: `id`, `organization_id`, `value_case_id`, `session_id`, `content text`, `format text`, `defense_readiness_score numeric`, `source_agent text`, `created_at`, `updated_at`
- `realization_reports`: `id`, `organization_id`, `value_case_id`, `session_id`, `kpis jsonb`, `milestones jsonb`, `risks jsonb`, `variance_analysis jsonb`, `source_agent text`, `created_at`, `updated_at`
- RLS on all three using `security.user_has_tenant_access()`
- Indexes on `(value_case_id, organization_id)` for all three
- Rollback file

**S11-2 — Backend: Repositories for back-half tables**
- `IntegrityResultRepository.ts` — `createResult(caseId, orgId, payload)`, `getLatestForCase(caseId, orgId)`
- `NarrativeDraftRepository.ts` — `createDraft(caseId, orgId, payload)`, `getLatestForCase(caseId, orgId)`
- `RealizationReportRepository.ts` — `createReport(caseId, orgId, payload)`, `getLatestForCase(caseId, orgId)`
- Co-located unit tests for each

**S11-3 — Backend: NarrativeAgent (first-class BaseAgent)**
- `packages/backend/src/lib/agent-fabric/agents/NarrativeAgent.ts`
- Extends `BaseAgent`, `lifecycleStage = "narrative"`, `version = "1.0.0"`
- Uses `secureInvoke` with Zod schema including `hallucination_check: z.boolean().optional()`
- Confidence threshold: 0.6–0.85 (commitment tier)
- Persists to `narrative_drafts` via `NarrativeDraftRepository`
- Stores memory with `this.organizationId`
- Register in `AgentFactory.ts`
- Unit test (mock LLMGateway + MemorySystem)

**S11-4 — Backend: Wire IntegrityAgent and RealizationAgent to persist**
- `IntegrityAgent.ts` — after `secureInvoke`, write to `integrity_results` via `IntegrityResultRepository`
- `RealizationAgent.ts` — after `secureInvoke`, write to `realization_reports` via `RealizationReportRepository`

**S11-5 — Backend: API endpoints for back-half stages**
- `GET /api/v1/value-cases/:id/integrity` — latest integrity result for case
- `POST /api/v1/value-cases/:id/integrity/run` — trigger IntegrityAgent
- `GET /api/v1/value-cases/:id/narrative` — latest narrative draft
- `POST /api/v1/value-cases/:id/narrative/run` — trigger NarrativeAgent
- `GET /api/v1/value-cases/:id/realization` — latest realization report
- `POST /api/v1/value-cases/:id/realization/run` — trigger RealizationAgent
- All endpoints: `requireAuth`, `tenantContextMiddleware`, `organization_id` scoped

**S11-6 — Frontend: Wire IntegrityStage, NarrativeStage, RealizationStage**
- `IntegrityStage.tsx` — remove hardcoded `claims` array; `useQuery` → GET endpoint; empty state with "Run Integrity Agent" CTA; wire Run button to POST
- `NarrativeStage.tsx` — remove "Acme Corp" literal and hardcoded narrative; `useQuery` → GET endpoint; wire Edit/Regenerate to POST
- `RealizationStage.tsx` — remove hardcoded KPIs/milestones/risks; `useQuery` → GET endpoint; wire Run button

### Acceptance Criteria

- [ ] No inline hardcoded data arrays in any of the three stage files
- [ ] No "Acme Corp" string literal anywhere in the canvas
- [ ] All three stages show truthful empty state when no agent has run
- [ ] All three stages show real data after agent run + page reload
- [ ] `pnpm run test:rls` passes for all three new tables
- [ ] NarrativeAgent extends BaseAgent, uses `secureInvoke`, stores memory with `this.organizationId`

---

## Sprint 12 — Persistent Value Memory (Weeks 3–4)

**Theme:** Turn memory from a fragile implementation detail into a platform guarantee.

**Goal:** Durable, lifecycle-aware agent memory is real in active environments. Expansion is end-to-end. Billing `changePlan` calls Stripe.

**Success statement:** Agent memory persists across sessions. Expansion opportunities are real. A customer can change their subscription plan without hitting a stub. `pnpm test` passes with 0 failed suites.

### Deliverables

- `semantic_memory` in the active migration path
- Memory adapters are real and used by production flows
- Lifecycle agents persist durable memory in fresh environments
- Memory readiness and degraded mode are observable
- Expansion is a real persisted workflow linked to prior lifecycle state
- Stripe plan change works

### Stories

**S12-1 — DB: Promote memory migrations + expansion_opportunities**
- `infra/supabase/supabase/migrations/20260328000000_memory_and_expansion.sql`
- Promote and adapt `archive/deferred-superseded/20260115_memory_first_architecture.sql`:
  - `semantic_memory`: `id`, `organization_id`, `agent_type`, `memory_type`, `content text`, `embedding vector(1536)`, `metadata jsonb`, `status text`, `created_at`, `updated_at`
  - `memory_hybrid_search_chunks` RPC (70% vector + 30% BM25)
  - `memory_match_chunks` RPC (pure vector)
  - `pgvector` extension enablement
- `expansion_opportunities`: `id`, `organization_id`, `value_case_id`, `session_id`, `opportunities jsonb`, `gap_analysis jsonb`, `expansion_seeds jsonb`, `source_agent text`, `created_at`
- RLS on all new objects using `security.user_has_tenant_access()`
- Rollback file

**S12-2 — Backend: Concrete memory store adapters**
- `packages/memory/src/adapters/SupabaseSemanticStore.ts` — implements `SemanticStore`; all reads/writes tenant-scoped on `organization_id`
- `packages/memory/src/adapters/SupabaseVectorStore.ts` — implements `VectorStore` using `memory_hybrid_search_chunks` RPC; tenant filter required
- Wire adapters into `AgentFactory.ts`
- Unit tests for both adapters (mock Supabase client)

**S12-3 — Backend: Memory health checks + degraded mode**
- `packages/backend/src/runtime/context-store/memoryHealth.ts` — `checkMemoryReadiness(): Promise<{ ready: boolean; reason?: string }>`
- Wire into `/health/dependencies` under `"memory"` key
- Emit `value_loop_memory_write_failures_total` Prometheus counter on write error
- Log `WARN` on degraded, `ERROR` on write failure — never silent

**S12-4 — Backend: Wire lifecycle agents to durable memory**
- `IntegrityAgent.ts`, `RealizationAgent.ts`, `ExpansionAgent.ts` — replace in-memory writes with `SupabaseSemanticStore` adapter calls; include `organization_id`, `value_case_id`, `lifecycle_stage` in metadata

**S12-5 — Backend: ExpansionAgent persistence + API**
- `ExpansionOpportunityRepository.ts` — `createOpportunities`, `getLatestForCase`
- `ExpansionAgent.ts` — persist to `expansion_opportunities`
- `GET /api/v1/value-cases/:id/expansion`, `POST /api/v1/value-cases/:id/expansion/run`

**S12-6 — Frontend: ExpansionStage**
- Wire `ExpansionStage.tsx` — `useQuery` for GET; empty state; "Run Expansion Agent" CTA; wire Run button

**S12-7 — Billing: Implement `SubscriptionService.changePlan()`**
- `changePlan(tenantId, newPlanId, actorId)`:
  - `stripe.subscriptions.update()` with `proration_behavior: "create_prorations"`
  - Emit `billing.plan.changed` via MessageBus
  - Write audit log with real `actorId`
  - Update `tenant_execution_state` entitlement snapshot
- Remove fake success from plan-change endpoint
- Unit test: mock Stripe SDK, verify proration call and audit log

**S12-8 — Fix context-ledger test**
- Mock `redis` in Vitest config so suite loads without browser-mode resolver error
- Verify `pnpm test` passes with 0 failed suites

### Acceptance Criteria

- [ ] Fresh DB setup supports durable memory without archived migrations
- [ ] Integrity/Realization/Expansion memory writes succeed and are queryable
- [ ] Memory write failure cannot occur silently (logged + metered)
- [ ] `/health/dependencies` reports memory readiness
- [ ] Expansion recommendations survive refresh and are tied to real cases
- [ ] Plan change calls `stripe.subscriptions.update` with correct price ID
- [ ] `pnpm test` passes with 0 failed suites

---

## Sprint 13 — Lifecycle Compounding + Operational Hardening (Weeks 5–6)

**Theme:** Make the value lifecycle compound. Make the platform operationally credible.

**Goal:** Expansion is linked to prior lifecycle state. Security incidents trigger real alerts. Audit logs have real identity. Saga transitions persist. Observability gaps are closed.

**Success statement:** A security incident triggers a real Slack/email alert. Every audit log entry has a real user name and email. The value loop metrics are visible in Grafana. No production TODO stubs remain in the security or audit path.

### Stories

**S13-1 — Audit: Real actor identity in AuditLogService**
- Replace hardcoded `"Unknown"` / `"unknown@valueos.com"` with `actor: { id: string; name: string; email: string }` parameter
- Fall back to `"system"` / `"system@valueos.local"` only for background jobs
- Update all call sites to pass `actor` from `req.user`
- Unit test: verify actor fields written correctly

**S13-2 — Security: Wire SecurityMonitor alerting (VOS-DEBT-1427)**
- Implement five stub methods: `sendEmailAlert`, `sendSlackAlert`, `sendPagerDutyAlert`, `escalateToSecurityTeam`, `escalateToManagement`
- All methods: fire-and-forget with error logging; never throw
- Missing env vars → `WARN` logged, no throw
- Unit tests: mock HTTP calls, verify payload shape per channel
- Remove all five TODO comments

**S13-3 — DB: saga_transitions + SagaAdapters persistence**
- `infra/supabase/supabase/migrations/20260404000000_saga_transitions.sql`
- `saga_transitions`: `id`, `organization_id`, `saga_id`, `saga_type`, `from_state`, `to_state`, `actor_id`, `metadata jsonb`, `created_at`
- RLS using `security.user_has_tenant_access()`
- `SagaAdapters.ts` — replace `// For now, let's log it` with Supabase insert

**S13-4 — Observability: MetricsCollector, OTel dev collector, Grafana dashboard**
- `MetricsCollector.recordUsage(tenantId, metric, value)` — increments `usage_enforcement_checks_total`
- `usageEnforcement.ts` — remove TODO; call real `recordUsage`
- `infra/docker-compose.dev.yml` — add OTel collector service
- `infra/grafana/dashboards/value-loop.json` — dashboard for five `value_loop_*` metrics

**S13-5 — Lifecycle continuity: link Expansion to prior lifecycle state**
- `ExpansionAgent.ts` — query `integrity_results` and `realization_reports` before generating recommendations; include prior defensibility score and realization variance in prompt context
- `GET /api/v1/value-cases/:id/expansion` — include `linked_integrity_score` and `linked_realization_summary` in response

### Acceptance Criteria

- [ ] `SLACK_WEBHOOK_URL` set → Slack message sent on HIGH/CRITICAL events
- [ ] `PAGERDUTY_ROUTING_KEY` set → PagerDuty incident created on CRITICAL events
- [ ] All five TODO comments removed from SecurityMonitor
- [ ] Audit log entries from API requests contain real `userName` and `userEmail`
- [ ] Saga state transitions write rows to `saga_transitions`
- [ ] `MetricsCollector.recordUsage()` exists; `usageEnforcement.ts` no longer throws at runtime
- [ ] Grafana dashboard JSON is valid and importable
- [ ] Expansion recommendations reference prior integrity and realization data

---

## Sprint 14 — Trust and Beta Hardening (Weeks 7–8)

**Theme:** Make the platform operationally credible and beta-ready.

**Goal:** p95 < 200ms for non-LLM API paths. PDF export works. Billing math is correct. Type safety is clean. The product can be handed to a beta customer.

**Success statement:** The k6 load test passes at 50 VUs. A user can export a business case as PDF. Billing math is correct. No remaining placeholder behavior exists in core lifecycle paths.

### Stories

**S14-1 — DB: Performance indexes migration**
- `infra/supabase/supabase/migrations/20260411000000_performance_indexes.sql`
- `CREATE INDEX CONCURRENTLY` for all major query paths (hypothesis_outputs, value_tree_nodes, financial_model_snapshots, value_loop_events, semantic_memory, integrity_results, realization_reports, narrative_drafts, expansion_opportunities)

**S14-2 — Performance: Worker HPA + SEC EDGAR cache**
- `infra/k8s/worker-hpa.yaml` — HPA: `minReplicas: 1`, `maxReplicas: 5`, CPU 70%
- Module-level `Map` cache for `company_tickers.json` with 24-hour TTL

**S14-3 — Export: PDF generation**
- `packages/backend/src/services/ExportService.ts` — `generatePDF(caseId, orgId)` via Puppeteer + Handlebars template; upload to Supabase Storage; return signed URL (1-hour expiry)
- Replace mock URL in `FinanceExportService`
- `GET /api/v1/value-cases/:id/export?format=pdf`
- Frontend: wire "Export" button in NarrativeStage

**S14-4 — Billing: InvoiceMathEngine credit + tax**
- Credit application: oldest-first against subtotal; write credit consumption record
- Tax: `STRIPE_TAX_RATE_ID` or `TAX_RATE_PERCENT` flat rate fallback
- All arithmetic via `decimal.js` — no `number` type for money values
- Unit tests: credit exhaustion, partial credit, zero credit, tax rounding

**S14-5 — Type safety: eliminate `any[]` + fix AgentPrefetchService**
- `vos.ts` — replace `value_commits: any[]`, `realization_reports: any[]`, `expansion_models: any[]` with Zod-derived types
- `AgentPrefetchService.ts` — replace empty array returns with real Supabase queries; limit 3 results

### Acceptance Criteria

- [ ] All indexes applied with `CONCURRENTLY`
- [ ] Second enrichment request for same company does not re-download `company_tickers.json`
- [ ] Worker HPA definition present in infra
- [ ] PDF generated, stored in tenant-scoped path, downloadable; signed URL expires after 1 hour
- [ ] Invoice with $100 subtotal and $20 credit produces $80 charged amount
- [ ] All arithmetic uses `Decimal`, no `number` type for money values
- [ ] No `any[]` in `vos.ts` for the three domain fields
- [ ] `fetchSimilarDeals()` returns real rows or empty array — never hardcoded empty

---

## Cross-Sprint Milestones

| Milestone | Reached when |
|---|---|
| Real six-stage workflow | Sprint 11 complete |
| Persistent Value Memory | Sprint 12 complete |
| Compounding lifecycle intelligence | Sprint 13 complete |
| Beta-ready trust posture | Sprint 14 complete |

## Cross-Sprint Non-Negotiables (AGENTS.md)

1. Every DB query includes `organization_id` or `tenant_id`
2. All agent LLM calls use `this.secureInvoke()` — no direct `llmGateway.complete()`
3. `service_role` only in AuthService, tenant provisioning, cron jobs
4. TypeScript strict mode — no `any`, use `unknown` + type guards
5. Named exports only
6. New agents: extend `BaseAgent`, Zod schema with `hallucination_check`, Handlebars prompts, confidence thresholds by risk tier

## Deferred (Post-Sprint 14)

- PPTX export
- `DeviceFingerprintService` GeoIP / threat intelligence
- `IntelligentCoordinator` AGENT_RESET MessageBus event
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- Kafka rollout
- Grafana alerting rules (dashboard in Sprint 13; alert rules post-beta)
