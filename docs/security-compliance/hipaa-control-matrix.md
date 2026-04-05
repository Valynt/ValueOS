# HIPAA Security Rule Control Matrix

## Purpose

This matrix maps HIPAA Security Rule standards to concrete technical and operational controls in ValueOS. It is designed to support implementation traceability and audit-readiness for tenants operating under a BAA.

## Matrix

| HIPAA citation | Safeguard objective | Concrete control | Code / config evidence | Operational runbook / process |
|---|---|---|---|---|
| 45 CFR §164.312(a)(1) Access control | Ensure only authorized users/systems can access ePHI | Tenant-aware authN/authZ middleware, RBAC permission checks, service-identity checks for internal routes | `packages/backend/src/middleware/auth.ts`, `packages/backend/src/middleware/authorization.middleware.ts`, `packages/backend/src/services/security/ComplianceControlCheckService.ts` | `docs/operations/incident-response.md`, `docs/security-compliance/rbac-role-taxonomy.md` |
| 45 CFR §164.312(a)(2)(i) Unique user identification | Uniquely identify each workforce member and subject | Canonical user identity and request-bound auth context (`user`, `tenantId`, `organizationId`) | `packages/backend/src/types/express.d.ts`, `packages/backend/src/services/auth/AuthService.ts` | `docs/security-compliance/authorization-claim-model.md` |
| 45 CFR §164.312(a)(2)(iv) Encryption/decryption | Protect ePHI at rest and in backups | Encryption utility and encryption-required environment validation in control checks | `packages/backend/src/utils/encryption.ts`, `packages/backend/src/config/securityConfig.ts`, `packages/backend/src/services/security/ComplianceControlCheckService.ts` | `docs/security-compliance/secret-rotation-policy.md`, `docs/operations/secret-key-transition-runbook.md` |
| 45 CFR §164.312(b) Audit controls | Record and examine system activity affecting ePHI | Immutable audit logging, audit payload contracts, SIEM forwarding | `packages/backend/src/services/security/AuditLogService.ts`, `packages/backend/src/services/security/auditPayloadContract.ts`, `packages/backend/src/services/security/SiemExportForwarderService.ts` | `docs/security-compliance/audit-logging.md`, `docs/operations/monitoring-observability.md` |
| 45 CFR §164.312(c)(1) Integrity | Protect ePHI from improper alteration/destruction | Hash-chained compliance evidence and integrity checks | `packages/backend/src/services/security/ComplianceEvidenceService.ts`, `packages/backend/src/services/security/ComplianceControlStatusService.ts` | `docs/security-compliance/evidence-schema.md` |
| 45 CFR §164.312(e)(1) Transmission security | Guard ePHI transmitted over networks | Transport security headers and secure middleware defaults | `packages/backend/src/middleware/securityHeaders.ts`, `packages/backend/src/middleware/security/config.ts` | `docs/security-compliance/security-overview.md` |
| 45 CFR §164.308(a)(1)(ii)(D) Information system activity review | Periodically review logs/reports | Scheduled control sweeps and compliance status snapshots | `packages/backend/src/services/security/ComplianceControlCheckService.ts`, `docs/security-compliance/control-status.json` | `docs/security-compliance/compliance-guide.md` |
| 45 CFR §164.308(a)(6) Security incident procedures | Identify/respond to suspected or known incidents | Security incident service + documented incident lifecycle | `packages/backend/src/services/security/SecurityIncidentService.ts` | `docs/operations/incident-response.md`, `docs/runbooks/emergency-procedures.md` |
| 45 CFR §164.316(b)(1) Documentation retention | Retain policies/procedures/evidence for required duration | Evidence retention policy and audit retention service controls | `docs/security-compliance/evidence-retention-policy.md`, `packages/backend/src/services/security/AuditRetentionService.ts` | `docs/operations/runbooks/testing-operations-runbook.md` |

## Technical traceability set

Machine-verifiable traceability artifacts:

- `docs/security-compliance/evidence/hipaa/phi-classification-boundaries.json`
- `docs/security-compliance/evidence/hipaa/hipaa-gdpr-incident-workflows.json`
- `scripts/ci/check-hipaa-traceability.mjs`

These artifacts are intended for CI usage and validate:

1. PHI data classification and boundary declarations.
2. Required evidence file paths and runbook links.
3. HIPAA/GDPR overlap workflow definitions (breach + DSR).

