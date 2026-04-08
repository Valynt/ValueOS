# Security & Compliance Evidence Index

This index maps key SOC 2, GDPR, ISO 27001, and FedRAMP-aligned controls to automated evidence produced in CI. It is designed for auditor traceability from control → workflow run ID → artifact report → migration provenance.

## How to use this index

1. Open a successful run of `.github/workflows/pr-fast.yml` (PR lane) or `.github/workflows/main-verify.yml` (main lane), depending on the evidence scope.
2. Record the numeric `GITHUB_RUN_ID` from that run.
3. Download artifact bundle `compliance-evidence-run-<run-id>-attempt-<attempt>`.
4. Verify the `SHA256SUMS` file and `SHA256SUMS.sig` signature in the artifact bundle.

## Control-to-evidence mapping

| Framework | Control | Automated suites | Evidence artifact(s) | Workflow run ID source | Migration lineage |
|---|---|---|---|---|---|
| SOC2 | CC6.1 Logical and physical access controls | `tests/security/rls-tenant-isolation.test.ts` | `reports/compliance/rls/vitest-rls.junit.xml`, `reports/compliance/rls/vitest-rls.json` | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql` (RLS foundations: tenants, user_tenants, security schema, user_has_tenant_access), `infra/supabase/supabase/migrations/20260302000000_webhook_tenant_isolation.sql` |
| SOC2 | CC6.8 Audit log integrity/immutability | `tests/compliance/audit/audit-log-immutability.test.ts` | `reports/compliance/audit/vitest-audit-immutability.junit.xml`, `reports/compliance/audit/vitest-audit-immutability.json` | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/archive/deferred-superseded/20231103000000_create_security_audit_log.sql`, `infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql` (audit_logs, security_audit_log tables) |
| GDPR | Article 15/17 (access + erasure DSR workflow) | `tests/compliance/dsr-workflow.test.ts` | `reports/compliance/dsr/vitest-dsr.junit.xml`, `reports/compliance/dsr/vitest-dsr.json` | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/20260331000000_p1_missing_tables.sql` (sessions, messages, agent_audit_logs — GDPR Art.17 gap resolution), `infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql` |
| ISO 27001 | A.12.4 Event logging and monitoring | `tests/compliance/audit/audit-log-immutability.test.ts` | Same as audit artifacts above | `${GITHUB_RUN_ID}` from CI run summary | `infra/supabase/supabase/migrations/archive/deferred-superseded/20231103000000_create_security_audit_log.sql` |
| SOC2 / ISO 27001 | Secrets rotation confirmed | `scripts/security/verify-secret-rotation.mjs` against AWS Secrets Manager + Vault metadata | `secret-rotation-evidence-<environment>-<GITHUB_RUN_ID>` artifact containing `artifacts/security/secret-rotation/<environment>-run-<run-id>-attempt-<attempt>.json` and `verify-secret-rotation-<environment>-run-<run-id>-attempt-<attempt>.txt` | `${GITHUB_RUN_ID}` from `.github/workflows/secret-rotation-verification.yml` or `.github/workflows/deploy.yml` (`secret-rotation-gate`) | Operational evidence from AWS Secrets Manager / Vault metadata age checks (no database migration lineage) |

## Critical control machine-readable evidence artifacts

All open critical controls (`severity=critical`, `status=planned`) must map to a machine-readable CI artifact path. The governance gate `scripts/ci/check-critical-controls-governance.mjs` enforces this table and writes the per-control assertions listed below.

| Control ID | Required machine-readable artifact path | Burn-down dashboard artifact |
|---|---|---|
| CR-011 | `artifacts/compliance/critical-controls/CR-011/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-012 | `artifacts/compliance/critical-controls/CR-012/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-013 | `artifacts/compliance/critical-controls/CR-013/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-014 | `artifacts/compliance/critical-controls/CR-014/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-015 | `artifacts/compliance/critical-controls/CR-015/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-016 | `artifacts/compliance/critical-controls/CR-016/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-017 | `artifacts/compliance/critical-controls/CR-017/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-020 | `artifacts/compliance/critical-controls/CR-020/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-021 | `artifacts/compliance/critical-controls/CR-021/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-022 | `artifacts/compliance/critical-controls/CR-022/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-023 | `artifacts/compliance/critical-controls/CR-023/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-024 | `artifacts/compliance/critical-controls/CR-024/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-027 | `artifacts/compliance/critical-controls/CR-027/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-028 | `artifacts/compliance/critical-controls/CR-028/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-029 | `artifacts/compliance/critical-controls/CR-029/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-030 | `artifacts/compliance/critical-controls/CR-030/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-031 | `artifacts/compliance/critical-controls/CR-031/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-033 | `artifacts/compliance/critical-controls/CR-033/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-034 | `artifacts/compliance/critical-controls/CR-034/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-035 | `artifacts/compliance/critical-controls/CR-035/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-036 | `artifacts/compliance/critical-controls/CR-036/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-037 | `artifacts/compliance/critical-controls/CR-037/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-045 | `artifacts/compliance/critical-controls/CR-045/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-047 | `artifacts/compliance/critical-controls/CR-047/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-049 | `artifacts/compliance/critical-controls/CR-049/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-050 | `artifacts/compliance/critical-controls/CR-050/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-052 | `artifacts/compliance/critical-controls/CR-052/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-053 | `artifacts/compliance/critical-controls/CR-053/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |
| CR-055 | `artifacts/compliance/critical-controls/CR-055/assertion.json` | `artifacts/compliance/critical-controls-gate/open-critical-controls-dashboard.json` |

## Canonical FedRAMP mapping set

ValueOS maintains the canonical FedRAMP-aligned mapping in:

- `docs/security-compliance/fedramp-control-mapping.md`
- `docs/security-compliance/fedramp-control-evidence-manifest.json`

The `Compliance Evidence Export` workflow bundles both documents and emits a run-bound copy of the machine-readable manifest so release packets and auditor requests can tie FedRAMP controls to:

- exported workflow artifacts,
- migration lineage,
- and the exact GitHub Actions `run_id` / `run_attempt`.

## Standard artifact naming

Compliance artifacts are published by CI with this bundle format:

- `compliance-evidence-run-<GITHUB_RUN_ID>-attempt-<GITHUB_RUN_ATTEMPT>`

Each bundle contains:

- JUnit and JSON reports for DSR, RLS, and audit immutability suites.
- `SHA256SUMS` checksum ledger.
- `SHA256SUMS.sig` + `SHA256SUMS.pem` keyless signature material.
- `reports/compliance/metadata/workflow-run.json` with run metadata.

- `artifacts/security/governance/data-residency-status.json` — tenant-to-region data store/export residency evaluation with a machine-verifiable signature envelope (`signature.payloadDigest` + `signature.signature`) and signing provenance metadata (`signature.keySource`, `signature.signatureMode`).
- `artifacts/security/governance/vdp-kpis.json` — quarterly vulnerability disclosure KPI snapshot (public policy path, intake metadata, SLA performance/remediation windows, and ownership/escalation workflow for missed SLAs).


Secret-rotation evidence is published separately as:

- `secret-rotation-evidence-<environment>-<GITHUB_RUN_ID>`

Each secret-rotation bundle contains:

- `artifacts/security/secret-rotation/<environment>-run-<run-id>-attempt-<attempt>.json` — authoritative machine-readable metadata age evidence for release sign-off.
- `artifacts/security/secret-rotation/verify-secret-rotation-<environment>-run-<run-id>-attempt-<attempt>.txt` — console/log transcript showing pass/fail findings.

For the release checklist item **“Secrets rotation confirmed”**, the secret-rotation artifact above is the authoritative evidence to attach to the sign-off packet.

## Quarterly evidence export

Use:

```bash
node scripts/compliance/generate-quarterly-evidence-pack.mjs
```

Quarterly CI export enforcement also runs:

```bash
node scripts/ci/check-quarterly-evidence-completeness.mjs --evidence-root=evidence
```

The gate parses this index's required artifact lists and fails if any required artifact is missing or empty.

Output path:

- `compliance/evidence-packs/<year>-Q<quarter>/evidence-pack-<timestamp>/`

This export includes a manifest and hash ledger for SOC 2, FedRAMP, and privacy review packets.

## Governance artifacts (manual/operational)

The following non-CI artifacts are required for governance traceability:

- Vendor annual risk review evidence files (one per in-scope vendor per year).
- Vendor remediation tracker with action IDs, owners, due dates, and closure evidence.
- Quarterly risk review summary linked to incident and compliance outputs.
- Weekly required-check enforcement artifact: `weekly-required-check-enforcement-<run_id>` from `.github/workflows/required-checks-weekly-compliance.yml`, containing `artifacts/governance/required-check-enforcement-weekly.md` and `.json`.
- Canonical residency policy map used by CI evidence export: `docs/security-compliance/data-residency-controls.json`.
- Canonical VDP KPI source map used by CI/governance exports: `docs/security-compliance/vdp-metrics-source.json`.

VDP KPI automation runs in both change-driven and scheduled governance lanes via `scripts/ci/extract-governance-risk-control-kpis.mjs`:

- `.github/workflows/pr-fast.yml`
- `.github/workflows/main-verify.yml`
- `.github/workflows/nightly-governance.yml`

Reference workflows:

- [Vendor Risk Review Workflow](./vendor-risk-review-workflow.md)
- [Risk Register Process](../processes/risk-register-process.md)


## Release evidence bundle chain (GA v1.0.0)

For GA release `v1.0.0`, include the following governance records in the release evidence bundle so approver traceability is auditable end-to-end:

- `docs/security-compliance/threat-model.md` (Review and Approver Record row for `v1.0.0`; no accepted exceptions).
- `docs/operations/launch-readiness.md` (Go/No-Go checklist references for release tag `v1.0.0`).
- `docs/operations/release-scope-ga-signoff.md` (Product/Engineering/Design scope approval for `v1.0.0`).
- `docs/security-compliance/fedramp-control-mapping.md` (canonical FedRAMP control-to-evidence packet).
- `docs/security-compliance/fedramp-control-evidence-manifest.json` (machine-readable control-to-artifact and migration-lineage mapping).

Bundle these documents alongside CI compliance artifacts (`compliance-evidence-run-<GITHUB_RUN_ID>-attempt-<GITHUB_RUN_ATTEMPT>`) when preparing audit packets.
