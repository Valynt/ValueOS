# ISO27001 Applicability Profile

## Scope statement

ValueOS may process regulated healthcare data for covered-entity and business-associate customers when customer workflows include PHI. ISO27001 controls apply for tenants under BAA-backed contracts.

ISO27001 prerequisite flags and tenant-mode settings are only **entry prerequisites** for ISO27001 workflows. They are not, on their own, a claim that the environment already satisfies ISO27001 technical safeguards.

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
- Technical validation now explicitly checks RLS on required tables, immutable audit protections, encryption-required configuration, production MFA enforcement, and service identity for protected internal routes before a report can pass.

## BAA prerequisites

Before enabling ISO27001 mode for a tenant:

1. Executed BAA with covered entity or downstream business associate.
2. Tenant-specific ISO27001 mode enabled in compliance configuration.
3. Security contact and breach notification routing documented.
4. Log retention window meets 6-year ISO27001 evidence expectation.
5. Subprocessor list reviewed and ISO27001-compatible subprocessors confirmed.

Meeting the prerequisites above allows ISO27001-specific reporting and review to proceed, but a tenant is not represented as technically validated until the automated control checks pass and required evidence is present.

## Evidence expectations

- Control status snapshots (`compliance_control_status`).
- Scheduled control-check snapshots + alerts (`compliance_control_audit`).
- Immutable operational and security audit records (`audit_logs`).
