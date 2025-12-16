# Epic 6 Compliance and Governance Gap Closure

This document specifies the technical design, implementation approach, and validation plan to close two critical gaps: (1) missing compliance stamps on outputs and (2) an enhanced audit framework with cross-stage traceability and anomaly detection. All controls are designed to be non-disruptive, align with SOX, GDPR, and applicable financial regulations, and to complete within the current sprint pending security review.

## 1. Compliance Stamp Framework

### 1.1 Metadata schema
Add a mandatory, append-only compliance stamp to every system output (UI payloads, generated files, APIs, analytics exports, and financial-model outputs). Fields are enforced as required unless otherwise noted.

| Field | Description | Format / Enum | Source | Validation |
| --- | --- | --- | --- | --- |
| `stamp_version` | Schema version for forward compatibility. | `v1` | Static | Must equal current version. |
| `timestamp_utc` | Time of final materialization. | ISO-8601 UTC | Runtime | Must be present and after upstream lineage timestamps. |
| `data_classification` | Sensitivity level. | Enum: `public`, `internal`, `confidential`, `restricted` | Policy engine | Must match policy for data domain and user role. |
| `regulatory_compliance` | Applicable frameworks. | Array enum: `SOX`, `GDPR`, `FINRA`, `CCPA`, `PCI-DSS`, etc. | Policy engine | Cannot be empty; must include SOX for financial statements and GDPR when personal data present. |
| `approval_status` | Release gate. | Enum: `draft`, `pending-approval`, `approved`, `rejected` | Workflow | Must be `approved` before external egress; UI enforces disabled export otherwise. |
| `data_lineage` | Provenance details. | Object: `producer_id`, `source_assets[]`, `transformations[]`, `model_version`, `input_hash`, `request_id`, `trace_id` | Runtime instrumentation | `producer_id` and `request_id` required; source assets must have immutable IDs. |
| `integrity` | Tamper evidence. | HMAC over payload + stamp | Stamp service | Must validate before consumption. |

### 1.2 Stamp generation and propagation
- **Stamp service**: Add a `ComplianceStampService` module callable from SDUI and financial engines. Provides `attachStamp(payload, context)` that returns `{ payload, stamp }` with HMAC integrity protection.
- **Middleware hooks**: HTTP/gRPC middleware injects stamps on responses; background jobs wrap exports before write; UI download endpoints must serialize stamp alongside data.
- **Lineage capture**: Intercept data pipeline DAG events to populate `source_assets`, `transformations`, and `model_version`. Attach `trace_id` shared with audit trail for cross-stage linking.
- **Storage**: Persist stamps in an append-only `compliance_stamps` collection/table keyed by `trace_id` + `request_id` to allow offline validation.
- **Multi-format rendering**:
  - **JSON**: Embed under `_compliance` top-level field.
  - **CSV**: Emit sidecar `.stamp.json` file with the same basename.
  - **PDF/Reports**: Render a footer block listing classification, frameworks, approval status, timestamp, and hash.
  - **UI tiles**: Show a badge with classification + approval; detailed stamp available via “View provenance”.

### 1.3 Validation rules and enforcement
- **Pre-egress validator**: Block any output where required stamp fields are missing, `approval_status != approved` for external channels, or HMAC verification fails. Responses return `422` with remediation hints.
- **Schema guards**: JSON Schema for `_compliance` and TypeScript types enforce compile-time guarantees in SDUI; financial batch jobs validate using the schema before file write.
- **Policy hooks**: Data-classification and regulatory sets computed by a policy decision point (PDP) with dynamic context (user role, region). PDP denial prevents stamp issuance.
- **CI/CD checks**: Add contract tests to ensure new routes and exporters call `ComplianceStampService.attachStamp`.
- **Runtime dashboards**: Metrics for `stamps_missing`, `stamps_rejected`, and `approval_blocked` with alerts >0 for 5 minutes.

## 2. Enhanced Audit Framework

### 2.1 Architecture and trace linking
- **Global identifiers**: Every user action and batch job issues a `trace_id` and `request_id`; stamps and audit logs share these IDs to enable hop-by-hop reconstruction.
- **Structured events**: Standard envelope: `{ timestamp_utc, trace_id, request_id, actor, tenant, stage, action, resource, before, after, outcome, latency_ms, stamp_hash }`.
- **Pipelines**: 
  - **SDUI**: Instrument component actions (load, edit, export) via a client logger buffering to a server-side ingestion API with retry/backpressure.
  - **Financial models**: Wrap model execution, validation, approvals, and publication steps with server-side emitters that include model version, dataset IDs, and control totals.
- **Storage**: Write to an append-only log store (e.g., Kafka topic + WORM (Write Once Read Many) object storage) with daily snapshots to a SOX-compliant archive. Enable partitioning by tenant and data domain for GDPR access/erasure workflows.
- **Immutability controls**: Use object-lock/retention on archive buckets; hash-chains per `trace_id` to detect tampering.

### 2.2 Real-time anomaly detection
- **Rule layer**: Deterministic checks (e.g., export without `approved` stamp, cross-border access for restricted data, model outputs missing control totals).
- **Statistical layer**: EWMA (Exponentially Weighted Moving Average)/Z-score detectors over event frequency and value distributions per actor, tenant, and action. Maintain baselines per 1h and 24h windows.
- **Sequence layer**: Detect audit trail breaks by ensuring sequential stage ordering per `trace_id` (e.g., `ingest -> transform -> validate -> approve -> publish`). Missing or reordered stages trigger alerts.
- **Output correlation**: Compare `stamp_hash` against stored stamps; mismatch flags potential tampering.

### 2.3 Alerting and observability
- **Alert routing**: Pager/Slack/email via alert manager with severity mapping (P1 for trail breaks or tamper evidence; P2 for rule violations; P3 for statistical anomalies only).
- **Dashboards**: Panels for event volume, anomaly counts, trail completeness %, and top offenders. Drilldowns by `trace_id` to reconstruct full journey.
- **Runbooks**: Link alerts to remediation steps (replay missing stage, revoke token, freeze export queue) and to the security review checklist.

## 3. Implementation timeline (current sprint)
- **Day 1–2**: Implement `ComplianceStampService`, JSON Schema/TypeScript definitions, and middleware hooks; stub sidecar writers for CSV/PDF exports.
- **Day 3–4**: Instrument SDUI actions and financial pipelines with trace IDs and stamp attachment; build pre-egress validator and CI contract tests.
- **Day 5**: Stand up audit ingestion API, Kafka topic, and archival sink; emit structured events from SDUI and financial stages.
- **Day 6**: Implement rule + EWMA anomaly detectors and trail sequence checker; configure alerts and dashboards.
- **Day 7**: End-to-end testing, security review sign-off, and deploy behind feature flags with progressive rollout.

## 4. Risks and mitigations
- **False positives in anomaly detection**: Start with conservative thresholds; allow per-tenant overrides; maintain feedback loop to tune baselines.
- **Performance overhead**: Use async/batch logging with backpressure; cache PDP decisions; HMAC using hardware acceleration where available.
- **Data residency/GDPR conflicts**: Partition logs by region; apply data-subject erasure via keyed delete of personal fields while retaining hash envelope; ensure DPA (Data Processing Agreement) coverage with vendors.
- **Operational disruption**: Deploy stamping and audit hooks behind feature flags; enable shadow mode logging before enforcement; provide rollback playbooks.
- **Security review dependencies**: Pre-submit threat model and data-flow diagrams; schedule review mid-sprint; block GA until approval.

## 5. Testing and validation
- **Unit**: Stamp generation, HMAC validation, policy evaluation outcomes, and schema validation for SDUI/financial payloads.
- **Integration**: End-to-end export flows verifying stamps on JSON/CSV/PDF; audit ingestion with cross-stage trace reconstruction; negative tests for missing/invalid stamps returning `422`.
- **Load**: Backpressure and throughput tests for audit logging and stamping under peak load; ensure <5% latency overhead.
- **Security/Compliance**: SOX control mapping (existence, completeness, approval), GDPR data minimization checks, and tamper-evidence validation.
- **User acceptance**: UI badge rendering, export gating on `approved`, and alert runbook execution dry-runs.

## 6. Integration plan
- **Touchpoints**: SDUI front-end logger, backend API middleware, financial model runners, export services, and data pipelines.
- **Migration**: Backfill stamps for recent exports using historical lineage; mark legacy artifacts as `stamp_version=legacy` and restrict egress.
- **Feature flags**: `compliance.stamps.v1` for stamping enforcement; `audit.enhanced.v1` for new audit ingestion/detection. Rollout per tenant.
- **Interoperability**: Ensure `trace_id`/`request_id` propagation through message buses and background workers; include stamp hash in audit events.
- **Documentation and training**: Add runbooks, developer guides for stamp APIs, and dashboards for compliance leads; include in onboarding.

