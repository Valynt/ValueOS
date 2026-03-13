# Observability Security Controls and Evidence Workflow

## Scope
This control mapping covers security telemetry and observability-plane access controls for:
- SIEM event streaming from backend audit/security services.
- Audit trail coverage for high-risk actions (`create`, `update`, `delete`, `export`, `approve`, `reject`, `grant`, `revoke`).
- RBAC/ABAC restrictions for dashboards, log search, and tracing access.
- Automated anomaly detection for cross-tenant access and privileged action spikes.

## Control Mapping (SOC 2 / ISO 27001 style)

| Control Objective | SOC 2 CC | ISO 27001 Annex A | Implementation Evidence |
|---|---|---|---|
| Centralized security event logging to SIEM | CC7.2, CC7.3 | A.8.15, A.8.16 | `SecurityEventStreamingService` normalizes events and forwards through SIEM routes. |
| Immutable audit trail and forensic integrity | CC6.6, CC7.4 | A.5.28, A.8.15 | `AuditLogService` hash chain + append-only APIs + integrity verification. |
| Logging of privileged/high-risk actions | CC6.1, CC6.2 | A.5.15, A.5.18 | Audit classification tags for high-risk action taxonomy. |
| Tenant/environment scoped observability access | CC6.3, CC6.6 | A.5.15, A.8.2 | `requireObservabilityAccess` middleware enforces role + tenant + environment checks. |
| Detection of suspicious behavior and anomalies | CC7.2, CC7.3 | A.5.24, A.8.16 | `SecurityAnomalyService` detects cross-tenant access attempts and privileged action spikes. |

## Evidence Collection Workflow

1. **Daily telemetry evidence**
   - Export normalized SIEM events by category (`auth`, `role_change`, `data_export`, `policy`).
   - Validate tenant metadata is present for each event.
2. **Weekly audit integrity evidence**
   - Run integrity verification against `audit_logs` and archive result artifact.
   - Confirm high-risk actions contain `audit_classification=high_risk` and `immutable_log=true` metadata.
3. **Access control evidence**
   - Capture observability access-denied events and include reviewer acknowledgment.
   - Sample successful tenant-scoped observability access records.
4. **Anomaly detection evidence**
   - Capture open/acknowledged alerts for:
     - `cross_tenant_access_attempt`
     - `privileged_action_spike`
   - Include incident references for critical alerts.
5. **Quarterly control attestation**
   - Map evidence artifacts to SOC 2/ISO control IDs.
   - Store immutable evidence bundle in compliance repository.

## Minimum Evidence Artifacts
- SIEM forwarding report (event counts by source/category).
- Audit integrity verification output (`valid`, `checked`, error list if present).
- Access control decisions for observability endpoints (allow/deny samples).
- Security anomaly alert exports with lifecycle (open → acknowledged/suppressed).

## Operational Ownership
- **Security Engineering**: SIEM routing, anomaly rule tuning, incident response.
- **Platform Engineering**: observability RBAC/ABAC enforcement and service telemetry quality.
- **Compliance**: control mapping review, evidence retention, audit support.
