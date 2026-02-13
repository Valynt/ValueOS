# Notifications Rollout Playbook

## Purpose
This playbook defines how to safely enable the notifications system in production through controlled phases, measurable gates, and explicit operational ownership.

## 1) Prerequisites Before Enabling Phase 0 in Production

Phase 0 (production shadow/canary readiness) must **not** start until all prerequisites below are complete:

### Technical readiness
- All notification event schemas are versioned and documented (including backward-compatibility rules).
- Idempotency keys are enforced for enqueue and provider dispatch paths.
- Dead-letter queue (DLQ) is configured with retention, replay tooling, and alerting.
- Provider credentials (API keys/webhooks) are stored in secrets manager and validated in production.
- Queue autoscaling thresholds and max-concurrency limits are set and load tested.
- Feature flags are available at:
  - Global level (master enable/disable)
  - Tenant level (canary targeting)
  - Channel level (email/SMS/push)

### Observability readiness
- Dashboards exist for:
  - Send success/error rate by provider and tenant
  - Duplicate send rate
  - Queue lag (p50/p95)
  - Bounce/complaint/unsubscribe rates
  - Webhook reconciliation latency
- Alert policies are configured with paging severity and on-call routing.
- Structured logs include: tenant_id, notification_type, idempotency_key, provider_message_id, correlation_id.

### Operational readiness
- On-call runbook is published and rehearsed (including rollback drills).
- Incident channel, escalation tree, and decision-maker for rollout gates are confirmed.
- Customer support macro is prepared for user-facing communication if partial degradation occurs.

---

## 2) Canary Tenant Selection Criteria and Success Window

### Canary tenant criteria
Select 2–5 tenants that jointly represent production variability:
- **Low-to-medium business criticality** (avoid the highest-risk tenant first).
- **Representative traffic shape** (steady + bursty workloads).
- **Channel coverage** across at least two channels (e.g., email + push).
- **Integration diversity** (different provider routes/templates/locales).
- **Known engaged contacts** so delivery/bounce behavior is measurable quickly.

Exclude tenants with active incidents, billing disputes, or pending contract-sensitive changes.

### Success window
- Minimum canary duration: **72 hours**.
- Includes at least one business peak period in the tenant’s primary timezone.
- Must meet all “Go” gate thresholds continuously for the final **24 hours**.

---

## 3) Shadow-Mode Validation Steps (and Data Compared)

In shadow mode, the new pipeline executes end-to-end without sending customer-visible notifications.

### Steps
1. Mirror production notification events into the new pipeline.
2. Execute template resolution, routing, personalization, and provider request construction.
3. Suppress actual sends (or use provider sandbox endpoint) while recording “would-send” artifacts.
4. Reconcile outputs between legacy and new pipelines at fixed intervals (e.g., every 15 min).
5. Investigate mismatches and classify as expected/accepted vs defect.
6. Repeat until mismatch rate and latency targets are stable within thresholds.

### Data compared
For each event/correlation_id compare:
- Recipient set (count + identities)
- Channel selection and routing decision
- Template/version chosen
- Personalization variables (field completeness + value parity)
- Scheduled send time / TTL
- Provider payload hash (normalized payload comparison)
- Delivery outcome classification (legacy actual vs new predicted where possible)
- Retry policy and retry count plan

Target thresholds in shadow mode:
- Field-level parity: **>= 99.5%**
- Routing parity: **>= 99.9%**
- Unclassified mismatch rate: **<= 0.1%**

---

## 4) Rollback Triggers

Any trigger below causes immediate **Hold**, and sustained breach causes **Rollback**.

- **Error rate**
  - Hold: send error rate > **1.0%** for 10 minutes
  - Rollback: send error rate > **2.0%** for 10 minutes or > **1.0%** for 30 minutes
- **Duplicate rate**
  - Hold: duplicate sends > **0.2%** (rolling 15 min)
  - Rollback: duplicate sends > **0.5%** (rolling 15 min)
- **Queue lag**
  - Hold: p95 lag > **2 minutes** for 10 minutes
  - Rollback: p95 lag > **5 minutes** for 10 minutes
- **Provider bounce threshold (email)**
  - Hold: bounce rate > **4%** (rolling 1 hour)
  - Rollback: bounce rate > **6%** (rolling 1 hour) or provider reputation warning issued

Additional hard rollback conditions:
- Evidence of cross-tenant data leakage
- Regulatory/privacy breach
- Inability to disable sends via kill switch within 5 minutes

---

## 5) Ownership and Escalation Matrix

| Area | Primary Owner | Secondary Owner | Responsibilities |
|---|---|---|---|
| Feature flags (global/tenant/channel) | Release Manager (Engineering) | SRE On-Call | Flip flags, enforce phased exposure limits, execute rollback switch |
| Real-time incident triage | SRE On-Call | Notifications Backend On-Call | Detect alerts, stabilize system, lead incident timeline |
| Root-cause investigation | Notifications Backend Lead | Provider Integrations Engineer | Analyze logs/metrics, identify defect class, propose remediation |
| Provider deliverability issues | Messaging Operations | SRE On-Call | Coordinate with provider, manage suppression lists and domain reputation actions |
| Expansion approval (phase advancement) | Engineering Manager + Product Manager | Incident Commander (if active) | Approve Go/Hold/Rollback decision based on gate evidence |
| Stakeholder communication | Product Manager | Support Lead | Internal updates, customer-facing notices when needed |

Escalation SLA:
- Sev-1 symptoms (data leakage, hard outage): immediate page + Incident Commander within 5 minutes.
- Sev-2 symptoms (threshold breach without outage): owner acknowledgment within 10 minutes.

---

## 6) Phased Timeline and Gate Decisions

| Phase | Duration (minimum) | Scope | Go Gate | Hold Gate | Rollback Gate |
|---|---:|---|---|---|---|
| Phase 0: Shadow in Production | 3 days | 0% customer-visible sends; mirrored execution only | Parity thresholds met; no Sev-1/Sev-2 open > 24h | Parity drift above target or unresolved mismatches | Critical correctness issue or privacy/compliance risk |
| Phase 1: Canary Tenants | 3 days | 2–5 selected tenants, capped volume | Error/dup/lag/bounce all below hold thresholds for final 24h | Any hold threshold breach | Any rollback threshold breach |
| Phase 2: Limited Rollout | 7 days | 10–25% tenant exposure by traffic | Stable metrics across peak window + no unresolved P1 defects | Repeated hold events (>2/day) | Sustained breach of rollback metrics |
| Phase 3: Broad Rollout | 7 days | 50–75% tenant exposure | No critical incidents, trendlines stable, support ticket rate normal | Sudden ticket spike or provider warning | Deliverability/reliability rollback thresholds hit |
| Phase 4: Full Rollout | Ongoing | 100% exposure | Post-rollout review complete; legacy path deprecation approved | New risk identified needing containment | Any hard rollback condition triggered |

### Gate decision protocol
- Decision cadence: daily during rollout phases, and ad hoc on incident trigger.
- Required attendees: SRE, Notifications Backend, Product, Release Manager.
- Decision record: log evidence snapshot, chosen gate (Go/Hold/Rollback), owner, and next review time.
