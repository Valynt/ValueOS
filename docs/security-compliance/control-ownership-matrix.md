---
title: Security Control Ownership Matrix
owner: team-platform
system: valueos-platform
status: active
review_cadence: quarterly
---

# Security Control Ownership Matrix

This matrix closes the governance handoff between technical enforcement and the organizational owner accountable for review, evidence capture, and remediation.

| Control area | Primary technical control | Technical owner | Organizational owner | Evidence / review artifact | Canonical runbook / dashboard |
|---|---|---|---|---|---|
| Row-level security (RLS) | Tenant-scoped Supabase policies, fork-safe tenant inventory checks, and live cross-tenant regression tests in `infra/supabase/tests/database/tenant_scope_inventory.sql`, `infra/supabase/tests/database/billing_rls_cross_tenant.test.sql`, `scripts/ci/check-supabase-tenant-controls.mjs`, and `tests/compliance/security/tenant-isolation-verification.test.ts` | Data Platform | Team Platform | `pnpm run test:rls`, `tenant-isolation-static-gate`, `tenant-isolation-gate`, and schema governance checks in `infra/supabase/sql/ops/security-governance-checks.sql` | `docs/runbooks/STAGING_DEPLOYMENT_RUNBOOK.md`, `docs/runbooks/disaster-recovery.md` |
| Secrets management | External Secrets + Vault / AWS Secrets Manager paths in `infra/k8s/base/external-secrets.yaml`, `scripts/ci/validate-secret-key-contract.mjs`, `scripts/ci/check-k8s-secrets-hygiene.mjs`, and `scripts/check-service-role-usage.sh` | Platform Security | Team Platform | Secret contract validation, rotation evidence, and ESO/Vault restore validation during DR exercises | `docs/runbooks/disaster-recovery.md`, `docs/runbooks/emergency-procedures.md` |
| Deployment approvals | Protected-environment and quality/DAST gates in `.github/workflows/deploy.yml`, dual-control approval records in `public.approval_requests` / `public.approvals`, and cleanup automation in `infra/k8s/cronjobs/approval-cleanup.yaml` | Release Engineering | Team Platform | Deployment workflow records, approval artifacts, and approval aging alerts | `docs/operations/runbooks/deployment-runbook.md`, `infra/observability/grafana/dashboards/mission-control.json` |
| DAST | OWASP ZAP baseline scan and threshold enforcement in `.github/workflows/deploy.yml` with evidence archived under `artifacts/dast/` and release policy documented in `docs/testing/release-gates.md` | Security Engineering | Team Platform | `zap-report.json`, `zap-report.html`, `zap-report.md`, and `dast-summary.md` attached to release evidence | `docs/operations/incident-response.md`, `infra/observability/grafana/dashboards/mission-control.json` |

## Ownership notes

- **Technical owner** is the team that maintains the guardrail implementation and remediates control regressions.
- **Organizational owner** is the Backstage-registered team accountable for control attestation, control exceptions, and escalation routing.
- All four controls roll up to the same service system (`valueos-platform`) so operational ownership in Backstage matches the compliance evidence trail.
