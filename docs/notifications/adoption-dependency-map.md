# Notifications Adoption Dependency Map

## Scope and intent
This document maps the four integration domains—**Security**, **Billing**, **Workflow**, and **Data imports**—to shared platform capabilities, phase blockers, and minimum viable integration contracts. It also defines a phased rollout sequence based on business impact and implementation risk.

## Platform capabilities by integration domain

| Integration domain | Core outcomes | Required platform capabilities |
| --- | --- | --- |
| Security | Detect and respond to auth, policy, and access anomalies quickly with verifiable evidence. | Event bus/topic partitioning, RLS verification gates, audit log completeness checks, identity context propagation (actor/tenant/session), severity classification, policy-based routing, secure delivery channels (signed webhooks/least-privilege queues). |
| Billing | Ensure monetization and entitlement events are accurate, timely, and reconcilable. | Idempotent event emission, strong ordering per account/subscription, metadata integrity validation (plan, invoice, currency, entitlement IDs), retry + dead-letter handling, delivery observability (ack latency, drop rate), reconciliation feeds. |
| Workflow | Trigger downstream automations from user and system milestones with predictable behavior. | Event schema versioning, workflow trigger registry, deduplication keys, delivery guarantees by channel (at-least-once baseline), subscription filtering, replay controls, operational dashboards. |
| Data imports | Notify ingestion states to improve reliability and operator response. | Long-running job status events, batch correlation IDs, provenance metadata (source, connector, checksum), partial-failure signaling, retry visibility, tenant-safe logs (RLS validation), throughput/lag observability. |

## Phase blockers and readiness gates

### Phase 1 blockers (foundational readiness)
- **RLS verification:** No cross-tenant leakage in notification payloads or subscriber reads; automated policy tests must pass before external integrations.
- **Audit log completeness:** All emitted notification events must include immutable audit entries with actor, action, resource, tenant, and timestamp.
- **Delivery observability:** Baseline telemetry must expose enqueue, delivery attempt, retry count, terminal status, and end-to-end latency percentiles.

### Phase 2 blockers (scale and trust hardening)
- **RLS verification:** Add continuous policy drift detection and canary tests for newly onboarded domains.
- **Audit log completeness:** Enforce full causality links (source event ID, parent workflow/import run) to support investigations.
- **Delivery observability:** Domain-level SLOs (success rate, latency, freshness) with alerting on sustained breaches.

### Phase 3 blockers (enterprise-grade operations)
- **RLS verification:** Formal attestations and periodic third-party validation for multi-tenant controls.
- **Audit log completeness:** Retention/legal hold automation with provable chain of custody.
- **Delivery observability:** Predictive failure detection and capacity anomaly alerts by tenant and channel.

## Minimal viable integration contract by domain

| Domain | Events emitted (minimum) | Required metadata | Expected delivery channel behavior |
| --- | --- | --- | --- |
| Security | `auth.failed`, `access.policy_denied`, `privilege.escalation_detected`, `mfa.challenge_outcome` | `event_id`, `occurred_at`, `tenant_id`, `actor_id` (or `system_actor`), `resource_id`, `policy_id` (if applicable), `severity`, `correlation_id`, `trace_id` | At-least-once delivery; strict signature verification for webhooks; retries with exponential backoff; dead-letter after max attempts; preserve ordering per tenant where feasible. |
| Billing | `invoice.generated`, `payment.succeeded`, `payment.failed`, `subscription.updated`, `entitlement.changed` | `event_id`, `occurred_at`, `tenant_id`, `account_id`, `subscription_id`, `invoice_id`, `amount`, `currency`, `plan_id`, `correlation_id`, `idempotency_key` | At-least-once with idempotency required at consumer; ordering per `subscription_id`; deterministic retry schedule; terminal failure surfaced to ops channel. |
| Workflow | `workflow.started`, `workflow.step_completed`, `workflow.failed`, `workflow.completed` | `event_id`, `occurred_at`, `tenant_id`, `workflow_id`, `run_id`, `step_id` (if step event), `status`, `initiator`, `correlation_id` | At-least-once baseline; optional replay endpoint; dedupe via `event_id`; channel fan-out must not block core workflow execution path. |
| Data imports | `import.started`, `import.row_failed`, `import.partially_completed`, `import.completed` | `event_id`, `occurred_at`, `tenant_id`, `import_job_id`, `source_system`, `file_reference`, `row_counts` (processed/failed), `error_code` (if any), `correlation_id` | Buffered delivery allowed for high-volume streams; near-real-time (<5 min) freshness target for summary events; retries + DLQ with operator remediation hooks. |

## Capability phase matrix (Required / Optional / Deferred)

| Capability | Phase 1 | Phase 2 | Phase 3 |
| --- | --- | --- | --- |
| RLS verification test suite for notification payloads | **Required** | Required | Required |
| Audit log completeness (actor/resource/action/tenant/timestamp) | **Required** | Required | Required |
| Baseline delivery observability (attempts, retries, latency, terminal status) | **Required** | Required | Required |
| Idempotency keys and duplicate suppression | **Required** | Required | Required |
| Per-tenant/event-type filtering and subscription management | Optional | **Required** | Required |
| Schema versioning + backward compatibility policy | Optional | **Required** | Required |
| Channel-specific SLO alerting | Deferred | **Required** | Required |
| Replay API/self-service redelivery | Deferred | Optional | **Required** |
| Predictive failure analytics | Deferred | Deferred | **Required** |
| Compliance-grade retention/legal hold workflows | Deferred | Optional | **Required** |

## Rollout priority (impact vs implementation risk)

| Priority | Domain | Impact | Implementation risk | Rationale |
| --- | --- | --- | --- | --- |
| 1 | Security | Very high | Medium | Security notifications reduce incident MTTD/MTTR quickly and enforce trust; medium risk due to strict RLS/audit requirements but manageable event volume. |
| 2 | Billing | Very high | High | Direct revenue and customer trust impact; higher risk from ordering/idempotency/reconciliation complexity, so start after security foundations prove stable. |
| 3 | Workflow | High | Medium | Broad product value via automation triggers; depends on schema governance and subscription controls that mature in Phases 1–2. |
| 4 | Data imports | Medium | Medium-high | Important for operational reliability but generally less immediate business-critical than security/billing; higher volume and partial-failure semantics benefit from Phase 2 observability maturity. |

## Phase execution summary
- **Phase 1 (Foundation):** Deliver Security first with shared controls for RLS verification, audit completeness, and baseline delivery telemetry.
- **Phase 2 (Expansion):** Onboard Billing and Workflow with stronger schema governance, filtering, and SLO-backed alerting.
- **Phase 3 (Optimization):** Complete Data imports at scale and add enterprise controls (replay, predictive analytics, compliance retention).
