# Data Asset Inventory

Canonical inventory of production data assets: tables, queues, and memory partitions.
Used by freshness monitoring, volume monitoring, and incident runbooks.

**Criticality tiers:**
- **T1** — Business-critical. Stale or missing data is immediately visible to users or breaks a lifecycle stage.
- **T2** — Operationally important. Failures degrade platform capability but do not break the primary user path.
- **T3** — Supporting. Failures are recoverable without user impact.

**Freshness SLA** — maximum acceptable lag between the last agent write and the current time before an alert fires.

---

## T1 — Business-Critical Assets

| Asset | Type | Owner | Upstream agent / job | Freshness SLA | Migration |
|---|---|---|---|---|---|
| `hypothesis_outputs` | Supabase table | Platform | `OpportunityAgent` | 10 min after agent run | `20260310000000_core_workflow_tables.sql` |
| `value_tree_nodes` | Supabase table | Platform | `TargetAgent` | 10 min after agent run | `20260317000000_value_tree_and_model_snapshots_v2.sql` |
| `financial_model_snapshots` | Supabase table | Platform | `FinancialModelingAgent` | 10 min after agent run | `20260317000000_value_tree_and_model_snapshots_v2.sql` |
| `integrity_outputs` | Supabase table | Platform | `IntegrityAgent` | 10 min after agent run | `20260325000000_integrity_outputs.sql` |
| `narrative_drafts` | Supabase table | Platform | `NarrativeAgent` | 10 min after agent run | `20260321000000_back_half_tables.sql` |
| `realization_reports` | Supabase table | Platform | `RealizationAgent` | 10 min after agent run | `20260321000000_back_half_tables.sql` |
| `expansion_opportunities` | Supabase table | Platform | `ExpansionAgent` | 30 min after agent run | `20260322000000_persistent_memory_tables.sql` |
| `semantic_memory` | Supabase table (pgvector) | Platform | All agents (memory writes) | 30 min after agent run | `20260322000000_persistent_memory_tables.sql` |
| `agent_audit_log` | Supabase table | Platform | All agents (audit writes) | 5 min after any CUD operation | `20260310000000_core_workflow_tables.sql` |

---

## T2 — Operationally Important Assets

| Asset | Type | Owner | Upstream agent / job | Freshness SLA | Notes |
|---|---|---|---|---|---|
| `value_cases` | Supabase table | Platform | User-initiated CRUD | N/A (user-driven) | Core case record; no agent freshness SLA |
| `workflow_checkpoints` | Supabase table | Platform | `HumanCheckpointService` | N/A (event-driven) | |
| `saga_transitions` | Supabase table | Platform | `SagaAdapters` | N/A (event-driven) | Planned Sprint 13 |
| `crm-sync` | BullMQ queue | Platform | `CrmSyncWorker` | Jobs processed within 5 min of enqueue | Queue name: `crm-sync` |
| `crm-webhook` | BullMQ queue | Platform | `CrmWebhookWorker` | Jobs processed within 2 min of enqueue | Queue name: `crm-webhook` |
| `crm-prefetch` | BullMQ queue | Platform | `AgentPrefetchService` | Jobs processed within 10 min of enqueue | Queue name: `crm-prefetch` |
| `onboarding-research` | BullMQ queue | Platform | `ResearchJobWorker` | Jobs processed within 15 min of enqueue | Queue name: `onboarding-research` |

---

## T3 — Supporting Assets

| Asset | Type | Owner | Notes |
|---|---|---|---|
| `user_tenants` | Supabase table | Platform | Auth/membership; low write frequency |
| `memberships` | Supabase table | Platform | Synced from `user_tenants` |
| `compliance_controls` | Supabase table | Platform | Compliance evidence; low write frequency |
| `pending_subscription_changes` | Supabase table | Platform | Billing; event-driven |
| `crm-dead-letter` | BullMQ queue | Platform | Dead-letter queue; alerts on any entry |

---

## Downstream dependency map

For blast-radius assessment. See `docs/observability/lineage.json` (Sprint 16) for the machine-readable version.

| Table | Broken → affects |
|---|---|
| `hypothesis_outputs` | `HypothesisStage`, `useHypothesis`, `useOpportunityBrief`, `GET /api/v1/cases/:id/hypothesis` |
| `value_tree_nodes` | `ModelStage`, `useValueTree`, `GET /api/v1/cases/:id/value-tree` |
| `financial_model_snapshots` | `ModelStage`, `useModelSnapshot`, `GET /api/v1/cases/:id/model-snapshots/latest` |
| `integrity_outputs` | `IntegrityStage`, `useIntegrityOutput`, `useIntegrity`, `GET /api/v1/cases/:id/integrity` |
| `narrative_drafts` | `NarrativeStage`, `useNarrative`, `GET /api/v1/cases/:id/narrative` |
| `realization_reports` | `RealizationStage`, `useRealization`, `GET /api/v1/cases/:id/realization` |
| `expansion_opportunities` | `ExpansionStage`, `useExpansion`, `GET /api/v1/cases/:id/expansion` |
| `semantic_memory` | All agents (memory retrieval), `RecommendationEngine` |
| `agent_audit_log` | Compliance reports, audit trail queries |

---

## Ownership

All T1 and T2 assets are owned by the **Platform** team until domain ownership is formally assigned.
Update this table when ownership is transferred.

| Team | Assets |
|---|---|
| Platform | All T1, all T2, all T3 |

---

*Last updated: Sprint 15. Update when new tables, queues, or memory partitions are added.*
*Linked from: `AGENTS.md` Key File Pointers*

## Observability Metric Label Contract (Tenant Isolation)

On-call, audit, and compliance workflows treat metric labels as part of the tenant-isolation control surface.

- Canonical tenant label key for value-loop metrics: `organization_id` (stable tenant/org identifier only).
- Never attach per-session or user-level identifiers (for example `session_id`, `user_id`, email) to counters or histograms.
- Tenant-scoped queries and alerts MUST include `organization_id` filtering or grouping.

### Value-loop metric dimension contract

| Metric | Required labels | Optional labels | Cardinality notes |
| --- | --- | --- | --- |
| `value_loop_stage_transition_seconds` | `organization_id` | `from_stage`, `to_stage` | Stage values are fixed enum; safe bounded dimensions. |
| `value_loop_agent_invocations_total` | `organization_id` | `agent`, `stage`, `outcome` | Agent/stage/outcome are bounded enums in code paths. |
| `value_loop_hypothesis_confidence` | `organization_id` | `agent` | Do not add prompt/session labels. |
| `value_loop_financial_calculations_total` | `organization_id` | `type`, `validated` | `type` must remain a controlled taxonomy (no free-form user input). |
| `value_loop_e2e_duration_seconds` | `organization_id` | `stages` | `stages` comes from bounded lifecycle stage set. |
| `value_loop_usage_events_total` | `organization_id` | `metric` | `metric` must be a static usage metric identifier. |

