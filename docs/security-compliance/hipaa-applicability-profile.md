# HIPAA Applicability Profile

## Scope statement

ValueOS may process regulated healthcare data for covered-entity and business-associate customers when customer workflows include PHI. HIPAA controls apply for tenants under BAA-backed contracts.

## PHI system inventory (in-scope)

- Backend API runtime: `packages/backend/src/server.ts` and `/api/*` processing paths.
- Tenant data stores: Supabase Postgres tables with tenant isolation (RLS) and audit logs.
- Security evidence + audit chain: `packages/backend/src/services/security/ComplianceEvidenceService.ts`, `AuditLogService.ts`.
- Messaging/queue surfaces where PHI-adjacent payloads can transit: agent/runtime orchestration and worker queues.

## Administrative safeguards

- Security management process: continuous control checks through `ComplianceControlCheckService` scheduled sweeps.
- Workforce security / access management: RBAC (`requirePermission`) and admin-only compliance status endpoint.
- Information access management: tenant-scoped enforcement (`tenant_id` / `organization_id`) and RLS validation gates.
- Security incident procedures: SIEM-forwarded security events and immutable `audit_logs` entries.
- Contingency planning: backup/recovery and DR runbooks under `docs/operations/`.

## Technical safeguards alignment

- Unique user identification + authentication middleware and MFA coverage controls.
- Audit controls via immutable hash-chained audit logs.
- Integrity controls via evidence hash chain verification and integrity control status checks.
- Transmission and storage safeguards from infrastructure encryption standards and secret/key rotation controls.

## BAA prerequisites

Before enabling HIPAA mode for a tenant:

1. Executed BAA with covered entity or downstream business associate.
2. Tenant-specific HIPAA mode enabled in compliance configuration.
3. Security contact and breach notification routing documented.
4. Log retention window meets 6-year HIPAA evidence expectation.
5. Subprocessor list reviewed and HIPAA-compatible subprocessors confirmed.

## Evidence expectations

- Control status snapshots (`compliance_control_status`).
- Scheduled control-check snapshots + alerts (`compliance_control_audit`).
- Immutable operational and security audit records (`audit_logs`).
