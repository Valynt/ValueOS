# Security & Compliance Evidence Index

This index maps key SOC2/GDPR controls to automated evidence produced in CI. It is designed for auditor traceability from control → workflow run ID → artifact report → migration provenance.

## How to use this index

1. Open a successful run of `.github/workflows/ci.yml`.
2. Record the numeric `GITHUB_RUN_ID` from that run.
3. Download artifact bundle `compliance-evidence-run-<run-id>-attempt-<attempt>`.
4. Verify the `SHA256SUMS` file and `SHA256SUMS.sig` signature in the artifact bundle.

## Control-to-evidence mapping

| Framework | Control | Automated suites | Evidence artifact(s) | Workflow run ID source | Migration lineage |
|---|---|---|---|---|---|
| SOC2 | CC6.1 Logical and physical access controls | `tests/security/rls-tenant-isolation.test.ts` | `reports/compliance/rls/vitest-rls.junit.xml`, `reports/compliance/rls/vitest-rls.json` | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/20260213000002_baseline_schema.sql` (RLS foundations), `infra/supabase/supabase/migrations/20260302000003_evidence_tier_guardrails.sql` |
| SOC2 | CC6.8 Audit log integrity/immutability | `tests/compliance/audit/audit-log-immutability.test.ts` | `reports/compliance/audit/vitest-audit-immutability.junit.xml`, `reports/compliance/audit/vitest-audit-immutability.json` | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/_deferred_archived/20231103000000_create_security_audit_log.sql`, `infra/supabase/supabase/migrations/20260302000003_evidence_tier_guardrails.sql` |
| GDPR | Article 15/17 (access + erasure DSR workflow) | `tests/compliance/dsr-workflow.test.ts` | `reports/compliance/dsr/vitest-dsr.junit.xml`, `reports/compliance/dsr/vitest-dsr.json` | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/20260214000001_user_profile_directory.sql`, `infra/supabase/supabase/migrations/20260302000003_evidence_tier_guardrails.sql` |
| ISO 27001 | A.12.4 Event logging and monitoring | `tests/compliance/audit/audit-log-immutability.test.ts` | Same as audit artifacts above | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/_deferred_archived/20231103000000_create_security_audit_log.sql` |

## Standard artifact naming

Compliance artifacts are published by CI with this bundle format:

- `compliance-evidence-run-<GITHUB_RUN_ID>-attempt-<GITHUB_RUN_ATTEMPT>`

Each bundle contains:

- JUnit and JSON reports for DSR, RLS, and audit immutability suites.
- `SHA256SUMS` checksum ledger.
- `SHA256SUMS.sig` + `SHA256SUMS.pem` keyless signature material.
- `reports/compliance/metadata/workflow-run.json` with run metadata.

## Quarterly evidence export

Use:

```bash
node scripts/compliance/generate-quarterly-evidence-pack.mjs
```

Output path:

- `compliance/evidence-packs/<year>-Q<quarter>/evidence-pack-<timestamp>/`

This export includes a manifest and hash ledger for SOC2/GDPR review packets.

## Governance artifacts (manual/operational)

The following non-CI artifacts are required for governance traceability:

- Vendor annual risk review evidence files (one per in-scope vendor per year).
- Vendor remediation tracker with action IDs, owners, due dates, and closure evidence.
- Quarterly risk review summary linked to incident and compliance outputs.

Reference workflows:

- [Vendor Risk Review Workflow](./vendor-risk-review-workflow.md)
- [Risk Register Process](../processes/risk-register-process.md)
