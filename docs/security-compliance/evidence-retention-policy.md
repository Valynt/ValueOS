---
title: Evidence Retention Policy
owner: compliance-lead
system: valueos-platform
status: active
review_cadence: annually
related_controls: CC6.8, CC9.1, P1.1
---

# Evidence Retention Policy

Defines retention periods for all compliance evidence classes stored in `compliance_control_evidence` and related audit stores. Retention periods are set to satisfy SOC 2, ISO 27001:2022, GDPR, and HIPAA requirements.

## Retention Schedule

| Evidence Class | Retention Period | Legal Hold Override | Basis |
|---|---|---|---|
| SOC 2 audit evidence | 7 years | Yes — indefinite until released | SOC 2 Type II audit cycle + 5-year lookback requirement |
| ISO 27001 control evidence | 3 years | Yes | ISO 27001:2022 §9.1 monitoring and measurement records |
| Incident forensic bundles | 5 years | Yes — indefinite until released | Litigation hold and regulatory investigation window |
| GDPR data subject request records | 5 years | Yes | GDPR Art. 5(2) accountability; statute of limitations |
| HIPAA audit controls evidence | 6 years | Yes | 45 CFR §164.530(j) — 6-year retention from creation or last effective date |
| Key rotation records | 7 years | Yes | Cryptographic audit trail for SOC 2 CC6.7 |
| Routine telemetry (automated control checks) | 90 days | No | Operational monitoring; no regulatory requirement beyond 90 days |
| Deployment approval records | 3 years | No | Change management audit trail (CC8.1) |
| Penetration test reports | 7 years | Yes | SOC 2 CC3.4 vulnerability management evidence |
| Quarterly evidence bundles | 7 years | Yes | SOC 2 Type II audit evidence |

## Legal Hold

A legal hold suspends automated retention cleanup for affected records. Records with `legal_hold: true` in `compliance_control_evidence` are excluded from all cleanup jobs regardless of `retention_expires_at`.

**Applying a legal hold:**
1. Set `legal_hold = true` on the affected records via the compliance admin API.
2. Document the hold in the incident or legal matter record with: date applied, scope, approver, and expected duration.
3. Notify the Compliance Lead and Legal counsel.

**Releasing a legal hold:**
1. Obtain written approval from Legal counsel and the Compliance Lead.
2. Set `legal_hold = false` and update `retention_expires_at` to the applicable retention period from the original `collected_at` date.
3. Document the release with the same fields as the application.

Legal hold release requires two-person authorization (Compliance Lead + Legal counsel).

## Retention Cleanup

Automated retention cleanup runs as a scheduled job. It:
- Selects records where `retention_expires_at < NOW()` AND `legal_hold = false`.
- Deletes records in batches with an audit log entry per batch.
- Never deletes records with `legal_hold = true`.
- Emits an evidence record of type `retention:cleanup-completed` after each run.

Cleanup job: `infra/k8s/cronjobs/evidence-retention-cleanup.yaml` (Phase 2).

## Immutability During Retention Period

Records within their retention period are immutable. The `compliance_control_evidence` table enforces this via RLS — `UPDATE` and `DELETE` are denied for all roles during the retention window. Only the retention cleanup job (running as `service_role` with explicit justification) may delete records after `retention_expires_at`.

## Cross-Border Data Considerations

Evidence records containing personal data (e.g., GDPR DSR records) are subject to data residency requirements. Ensure the Supabase project region matches the tenant's contractual data residency commitment before writing such records.

## Audit of Retention Compliance

The Compliance Lead reviews retention compliance quarterly:
- Verify no records past `retention_expires_at` remain (excluding legal holds).
- Verify all legal holds have documented approvals and expected durations.
- Verify cleanup job ran successfully in the past 30 days.

Evidence of this review is written as a `control:check-passed` evidence record with `control_id: "CC6.8"`.

## Related Files

| File | Purpose |
|---|---|
| `docs/security-compliance/evidence-schema.md` | Evidence record schema and hash chain |
| `scripts/compliance/verify-evidence-chain.mjs` | Hash chain validation |
| `packages/backend/src/services/security/ComplianceEvidenceService.ts` | Evidence write service |
| `docs/runbooks/emergency-procedures.md` | Legal hold emergency procedures |
