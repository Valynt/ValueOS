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
| 45 CFR §164.312(a)(1) Access control (authN/Z) | `packages/backend/src/middleware/auth.ts`, `packages/backend/src/middleware/authorization.middleware.ts`, `packages/backend/src/services/security/AuthorizationEngine.ts` | `ComplianceControlCheckService.runChecksForTenant()` validates service identity on protected internal routes and production MFA controls | `audit_logs.action` entries for access decisions + `compliance_control_audit` failures when service identity/MFA guardrails drift |
| 45 CFR §164.312(a)(2)(iv), §164.312(e)(1) Encryption and transmission security | `packages/backend/src/utils/encryption.ts`, `packages/backend/src/config/securityConfig.ts`, `packages/backend/src/middleware/securityHeaders.ts` | Scheduled sweep verifies encryption-required configuration and transport security posture checks | `compliance_control_audit.event_type=automated_control_check_alert_raised`; immutable `audit_logs` record for control-check execution |
| 45 CFR §164.312(b) Audit Controls | `AuditLogService.ts`, `ComplianceEvidenceService.ts` | Scheduled check validates `security_audit_log` + archive evidence artifacts, service identity for protected internal routes, and production MFA enforcement | `compliance_control_audit` alert event + signed audit log entry |
| 45 CFR §164.312(c)(1) Integrity | `ComplianceEvidenceService.verifyEvidenceChain()`, `ComplianceControlStatusService.ts` | Scheduled check validates control-state recency, RLS on required tables, immutable audit protections, and encryption-required configuration | Hash-chain evidence (`previous_hash`, `integrity_hash`) in `audit_logs` |
| 45 CFR §164.316(b)(1) Retention/documentation | `packages/backend/src/services/security/AuditRetentionService.ts`, `docs/security-compliance/evidence-retention-policy.md` | Retention controls verified through periodic audit-retention checks and evidence retention review cadence | Retention job outputs, archive records, and evidence retention attestations in `docs/security-compliance/evidence-index.md` |
| 45 CFR §164.308(a)(6) Security incident response | `packages/backend/src/services/security/SecurityIncidentService.ts`, `docs/operations/incident-response.md` | Incident workflow drills + compliance control sweeps ensure incident routing and audit capture requirements remain active | Incident timeline + immutable audit trail + post-incident corrective action evidence |

## Related APIs and Surfaces

- Authenticated admin status endpoint: `GET /api/admin/compliance/control-checks/status` (`system.admin` required).
- Compliance controls status endpoint: `GET /api/admin/compliance/control-status`.
- Immutable event stores: `audit_logs`, `compliance_control_audit`, `compliance_control_evidence`.
