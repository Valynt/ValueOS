# Control Traceability Matrix (SOC 2 / GDPR / HIPAA)

This matrix links framework controls to implementation paths, scheduled jobs, and alert/audit surfaces.

## SOC 2

| Control | Implementation paths | Scheduled job/check | Alert / immutable audit evidence |
|---|---|---|---|
| CC6 Change Management | `packages/backend/src/services/security/AuditLogService.ts`, `packages/backend/src/api/admin.ts` | `ComplianceControlCheckService.runScheduledSweep()` validates `audit_logs` freshness | `compliance_control_audit.event_type=automated_control_check_alert_raised`; `audit_logs.action=compliance:automated_control_checks_ran` |
| CC7 Monitoring | `packages/backend/src/services/security/SecurityMonitor.ts`, `SecurityAnomalyService.ts`, `SecurityEventStreamingService.ts` | `ComplianceControlCheckService.runChecksForTenant()` validates `security_audit_log` freshness | SIEM forwarder via `SiemExportForwarderService`; immutable `audit_logs` rows |

## GDPR

| Control | Implementation paths | Scheduled job/check | Alert / immutable audit evidence |
|---|---|---|---|
| Art. 30 Records of Processing | `packages/backend/src/services/security/ComplianceReportGeneratorService.ts`, `packages/backend/src/api/compliance.ts` | Automated control checks validate `control_status` + `audit_logs` evidence types | `compliance_control_audit` run snapshots and alert events |
| Art. 32 Security of Processing | `packages/backend/src/services/security/ComplianceControlStatusService.ts`, `AuditTrailService.ts` | Scheduled sweep verifies evidence freshness budget and missing artifacts | Immutable `audit_logs` integrity chain + control-check failure events |
| Art. 7 Consent | `packages/backend/src/services/auth/consentRegistry.ts`, `packages/backend/src/middleware/consentMiddleware.ts`, `packages/backend/src/api/llm.ts`, `packages/backend/src/api/queue.ts` | Privacy evidence bundle must run per-subject consent tests covering same-tenant mismatch, withdrawn consent, and cross-tenant denial | `user_consents` rows keyed by tenant + `auth_subject` + consent type, plus request/trace-linked privacy test artifacts |

## HIPAA

| Control | Implementation paths | Scheduled job/check | Alert / immutable audit evidence |
|---|---|---|---|
| 45 CFR §164.312(b) Audit Controls | `AuditLogService.ts`, `ComplianceEvidenceService.ts` | Scheduled check validates `security_audit_log` + archive evidence artifacts | `compliance_control_audit` alert event + signed audit log entry |
| 45 CFR §164.312(c)(1) Integrity | `ComplianceEvidenceService.verifyEvidenceChain()`, `ComplianceControlStatusService.ts` | Scheduled check validates control-status recency and evidence existence | Hash-chain evidence (`previous_hash`, `integrity_hash`) in `audit_logs` |

## Related APIs and Surfaces

- Authenticated admin status endpoint: `GET /api/admin/compliance/control-checks/status` (`system.admin` required).
- Compliance controls status endpoint: `GET /api/admin/compliance/control-status`.
- Immutable event stores: `audit_logs`, `compliance_control_audit`, `compliance_control_evidence`.
