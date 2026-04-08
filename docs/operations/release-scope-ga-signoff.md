# GA Release Scope Sign-off (Product / Engineering / Security / Design Evidence)

**Release:** ValueOS GA Scope Packet (`v1.0.0`)  
**Date:** 2026-03-12  
**Decision:** Approved with explicit deferred scope

## Included (Must-have)

1. US-001 CRM case-creation prefill path runs production-only behavior (mock fallback removed).
2. US-009 tenant isolation release gate remains blocking via `tenant-isolation-gate` in `.github/workflows/pr-fast.yml`: non-fork PRs run the live Supabase-backed suite (`node scripts/ci/run-tenant-isolation-rls-suite.mjs`), while fork PRs run the static subset only.
3. US-010 audit trail coverage remains mandatory for sensitive operations.

## Deferred (Post-GA)

1. US-007 onboarding UI and `/api/v1/tenant/context` endpoint completion.
2. US-008 Salesforce OAuth + opportunity fetch completion.
3. US-008 ServiceNow/Slack/SharePoint adapter expansion.

## Approval signatures

Security sign-off must confirm the linked threat model plus both SOC 2 and FedRAMP evidence references were reviewed before approval.

- **Product:** Jordan Lee — _Approved_ — `signed: 2026-03-12T17:10:00Z`
- **Engineering:** Priya Raman — _Approved_ — `signed: 2026-03-12T17:12:00Z`
- **Security:** Avery Chen — _Approved_ — `signed: 2026-03-12T17:14:00Z`
- **Design evidence (optional, non-blocking):** Mateo Alvarez — _Reviewed_ — `signed: 2026-03-12T17:15:00Z`

## Trust KPI Snapshot + Exception Risk Acceptance (Required)

Release sign-off must include a current trust KPI snapshot generated from CI artifacts and explicit risk-acceptance records for any exceptions.

### Required attachments

- Trust KPI snapshot artifact: `artifacts/security/governance/trust-kpi-snapshot.json` (from CI run for release SHA).
- Open risk export: `artifacts/security/governance/open-risks.json`.
- Stale control export: `artifacts/security/governance/stale-controls.json`.

### Exception record format (mandatory when any release exception exists)

| Exception ID | Related Control/Risk ID | Business Justification | Compensating Controls | Risk Acceptance Owner | Approval Date | Expiry/Re-review Date |
|---|---|---|---|---|---|---|
| EXC-YYYY-NNN | CR-### / RISK-#### | ... | ... | Security + Executive Owner | YYYY-MM-DD | YYYY-MM-DD |

If no exceptions are accepted for the release, document: `No accepted exceptions for this release.`

## Linked evidence

- Acceptance mapping: `docs/operations/release-acceptance-mapping.md`
- Launch checklist link target: `docs/operations/launch-readiness.md` (Release `v1.0.0`)
- Threat model review record: `docs/security-compliance/threat-model.md` (Release `v1.0.0`, including the Review and Approver Record row)
- SOC 2 / privacy / ISO evidence bundle chain: `docs/security-compliance/evidence-index.md` (GA `v1.0.0` release evidence bundle chain referencing the threat model and sign-off packet)
- FedRAMP control mapping packet: `docs/security-compliance/fedramp-control-mapping.md`
- FedRAMP machine-readable evidence manifest: `docs/security-compliance/fedramp-control-evidence-manifest.json`
