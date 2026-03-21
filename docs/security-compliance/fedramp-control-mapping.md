# Canonical FedRAMP Control Mapping

This document is the canonical ValueOS mapping for implemented FedRAMP-aligned controls that have explicit evidence sources in repository documentation, migration lineage, and the `Compliance Evidence Export` workflow bundle.

**Framework basis:** FedRAMP Moderate / NIST SP 800-53 Rev. 5  
**Canonical machine-readable companion:** `docs/security-compliance/fedramp-control-evidence-manifest.json`

## Scope and intent

- This mapping is limited to controls with current, named ValueOS evidence sources.
- Each control entry ties together:
  - the control implementation narrative,
  - the exported workflow artifact path,
  - the migration lineage or static documentation that substantiates the control,
  - and the GitHub Actions run metadata used for auditor traceability.
- The authoritative exported run identifier is `evidence/metadata/run-metadata.json` from `.github/workflows/compliance-evidence-export.yml`.

## Evidence model

For each quarterly or ad hoc export:

1. Run `.github/workflows/compliance-evidence-export.yml`.
2. Capture the workflow `run_id` and `run_attempt` from `evidence/metadata/run-metadata.json`.
3. Review `evidence/metadata/fedramp-control-evidence-manifest.json` for the run-bound mapping of controls to exported artifacts.
4. Use the migration lineage and static evidence references below when assembling auditor packets or release sign-off evidence.

## FedRAMP control mapping

| FedRAMP / NIST control | Control objective | ValueOS implementation evidence | Exported workflow evidence | Migration lineage / static lineage |
|---|---|---|---|---|
| AC-3 Access Enforcement | Enforce authorized tenant-bounded access to data and workflows. | Tenant isolation is implemented through membership-aware RLS foundations and validated by the runtime tenant-isolation suites plus the fork-safe static fallback lane. | `evidence/rls/rls-validation.json`; run binding from `evidence/metadata/run-metadata.json` | `infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql`; `infra/supabase/supabase/migrations/20260331000000_p1_missing_tables.sql`; `docs/security-compliance/evidence-index.md`; `.github/workflows/ci.yml` |
| AC-6 Least Privilege | Restrict access to the minimum necessary tenant-scoped privileges. | Least-privilege enforcement is reflected in tenant-scoped authorization, mismatch rejection, tenant-column immutability checks, and tenant hot-path index verification. | `evidence/rls/rls-validation.json`; run binding from `evidence/metadata/run-metadata.json` | `infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql`; `infra/supabase/supabase/migrations/20260331000000_p1_missing_tables.sql`; `docs/security-compliance/production-contract.md`; `docs/security-compliance/security-overview.md` |
| AU-2 Event Logging | Generate and retain auditable security-relevant records. | Audit logging requirements and immutable audit evidence expectations are documented and tested through the audit immutability suite. | `evidence/metadata/run-metadata.json`; bundle manifest in `evidence/metadata/evidence-manifest.txt` | `tests/compliance/audit/audit-log-immutability.test.ts`; `infra/supabase/supabase/migrations/_deferred_archived/20231103000000_create_security_audit_log.sql`; `infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql`; `docs/security-compliance/audit-logging.md` |
| AU-9 Protection of Audit Information | Protect audit records against unauthorized modification or deletion. | Audit integrity and immutability expectations are captured in audit lineage and governance evidence references. | `evidence/metadata/run-metadata.json`; `evidence/metadata/evidence-manifest.txt`; run-bound FedRAMP manifest | `tests/compliance/audit/audit-log-immutability.test.ts`; `infra/supabase/supabase/migrations/_deferred_archived/20231103000000_create_security_audit_log.sql`; `docs/security-compliance/evidence-index.md`; `docs/security-compliance/audit-logging.md` |
| RA-5 Vulnerability Monitoring and Scanning | Identify vulnerabilities through recurring automated scans. | ValueOS exports dependency and static analysis evidence from the compliance workflow. | `evidence/security-scans/pnpm-audit.json`; `evidence/security-scans/pnpm-audit-status.txt`; `evidence/security-scans/semgrep.sarif` or `evidence/security-scans/semgrep-missing.txt`; run binding from `evidence/metadata/run-metadata.json` | `docs/security-compliance/production-contract.md`; `docs/operations/ci-cd-pipeline.md` |
| CA-7 Continuous Monitoring | Preserve recurring evidence that supports ongoing security control review. | The scheduled compliance export workflow records immutable run metadata and the evidence file manifest for each export. | `evidence/metadata/run-metadata.json`; `evidence/metadata/evidence-manifest.txt`; `evidence/metadata/fedramp-control-evidence-manifest.json` | `.github/workflows/compliance-evidence-export.yml`; `docs/operations/ci-cd-pipeline.md`; `docs/security-compliance/evidence-index.md` |

## Canonical evidence sources by artifact type

### Workflow-generated evidence

- `evidence/metadata/run-metadata.json`
- `evidence/metadata/evidence-manifest.txt`
- `evidence/metadata/fedramp-control-evidence-manifest.json`
- `evidence/security-scans/pnpm-audit.json`
- `evidence/security-scans/pnpm-audit-status.txt`
- `evidence/security-scans/semgrep.sarif`
- `evidence/rls/rls-validation.json`
- `evidence/privacy/dsr-workflow.json`

### Repository lineage evidence

- `docs/security-compliance/evidence-index.md`
- `docs/security-compliance/production-contract.md`
- `docs/security-compliance/audit-logging.md`
- `docs/security-compliance/control-traceability-matrix.md`
- `tests/security/rls-tenant-isolation.test.ts`
- `tests/compliance/security/tenant-isolation-verification.test.ts`
- `tests/compliance/audit/audit-log-immutability.test.ts`
- `infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql`
- `infra/supabase/supabase/migrations/20260302000000_webhook_tenant_isolation.sql`
- `infra/supabase/supabase/migrations/_deferred_archived/20231103000000_create_security_audit_log.sql`

## Auditor handoff notes

- Use the exported machine-readable manifest when an auditor needs the exact workflow artifact path and `run_id` binding for a specific FedRAMP control.
- Use `docs/security-compliance/evidence-index.md` for cross-framework release packets that also include SOC 2, GDPR, and ISO references.
- Release sign-off for GA or regulated releases should cite both the SOC 2 evidence chain and this FedRAMP mapping set.
