# Control Traceability Matrix (SOC 2 / GDPR / HIPAA)

This matrix links framework controls to implementation paths, scheduled jobs, and alert/audit surfaces.

## SOC 2

| Control | Implementation paths | Scheduled job/check | Alert / immutable audit evidence |
|---|---|---|---|
| CC6 Change Management | `packages/backend/src/services/security/AuditLogService.ts`, `packages/backend/src/api/admin.ts` | `ComplianceControlCheckService.runScheduledSweep()` validates `audit_logs` freshness and production MFA enforcement | `compliance_control_audit.event_type=automated_control_check_alert_raised`; `audit_logs.action=compliance:automated_control_checks_ran` |
| CC7 Monitoring | `packages/backend/src/services/security/SecurityMonitor.ts`, `SecurityAnomalyService.ts`, `SecurityEventStreamingService.ts` | `ComplianceControlCheckService.runChecksForTenant()` validates `security_audit_log` freshness, immutable audit protections, and service-identity configuration for protected internal routes | SIEM forwarder via `SiemExportForwarderService`; immutable `audit_logs` rows |

## GDPR

| Control | Implementation paths | Scheduled job/check | Alert / immutable audit evidence |
|---|---|---|---|
| Art. 30 Records of Processing | `packages/backend/src/services/security/ComplianceReportGeneratorService.ts`, `packages/backend/src/api/compliance.ts` | Automated control checks validate `control_status` + `audit_logs` evidence types and surface missing evidence separately from configured/validated controls | `compliance_control_audit` run snapshots and alert events |
| Art. 32 Security of Processing | `packages/backend/src/services/security/ComplianceControlStatusService.ts`, `AuditTrailService.ts` | Scheduled sweep verifies evidence freshness, RLS on required tables, and encryption-required configuration | Immutable `audit_logs` integrity chain + control-check failure events |

## HIPAA

| Control | Implementation paths | Scheduled job/check | Alert / immutable audit evidence |
|---|---|---|---|
| 45 CFR §164.312(b) Audit Controls | `AuditLogService.ts`, `ComplianceEvidenceService.ts` | Scheduled check validates `security_audit_log` + archive evidence artifacts, service identity for protected internal routes, and production MFA enforcement | `compliance_control_audit` alert event + signed audit log entry |
| 45 CFR §164.312(c)(1) Integrity | `ComplianceEvidenceService.verifyEvidenceChain()`, `ComplianceControlStatusService.ts` | Scheduled check validates control-state recency, RLS on required tables, immutable audit protections, and encryption-required configuration | Hash-chain evidence (`previous_hash`, `integrity_hash`) in `audit_logs` |

## Related APIs and Surfaces

- Authenticated admin status endpoint: `GET /api/admin/compliance/control-checks/status` (`system.admin` required).
- Compliance controls status endpoint: `GET /api/admin/compliance/control-status`.
- Immutable event stores: `audit_logs`, `compliance_control_audit`, `compliance_control_evidence`.
