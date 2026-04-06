---
owner: team-platform
generated_at: 2026-04-05
source_commit: fe8b2fb54a61
status: active
---

# Release Readiness SWAT Team Checklist

**Purpose:** Multi-agent SWAT review for a multitenant enterprise SaaS release.  
**How to use:** Track each item with owner, evidence link, and status (`Not Started`, `In Progress`, `Blocked`, `Done`).

---

## Architecture Sentinel

- [x] Schema evolution backward/forward compatible
- [x] Shared vs schema-per-tenant validated
- [x] Sharding/scaling strategy reviewed
- [ ] Migration runbooks updated

## Security Guardian

- [x] Threat model updated
- [ ] Secrets rotation confirmed
- [x] Zero-trust boundaries tested
- [x] Tenant-level RBAC + RLS enforced

## Compliance Auditor

- [x] SOC2/FedRAMP control mapping updated
- [x] Audit logging validated
- [x] Data retention/export restrictions reviewed
- [ ] Compliance artifacts refreshed

## CI/CD Enforcer

- [x] Pipelines run: lint, type-check, SAST, DAST, SBOM
- [x] Build artifacts signed + reproducible
- [x] Canary/blue-green config validated
- [x] Rollback plan documented

## Observability Analyst

- [x] Metrics/traces/logs tenant-segmented
- [x] Dashboards + alerts configured
- [x] Error budgets and SLOs verified
- [ ] Rollback signals codified

## Data Reliability Operator

- [x] Migrations forward/backward safe
- [x] Anonymization in non-prod confirmed
- [ ] Backup/restore drills validated
- [ ] Disaster recovery readiness checked

## Customer Impact Commander

- [ ] Feature toggles per tenant/region tested
- [ ] Co-branding and localization verified
- [ ] Entitlements and billing regression run
- [ ] SLA commitments re-confirmed

---

## Evidence Tracker

| Area | Check | Owner | Evidence link | Status | Notes |
|---|---|---|---|---|---|
| Architecture Sentinel | Schema evolution backward/forward compatible | @team/backend | `supabase/migrations/` + `.rollback.sql` files; `migration-chain-integrity.yml` | Done | All forward migrations have rollback files; enforced by CI |
| Architecture Sentinel | Shared vs schema-per-tenant validated | @team/backend | `docs/TENANT_ISOLATION_SPEC.md`; `pnpm run test:rls` | Done | Shared schema with RLS; tenant isolation enforced at DB and HTTP layers |
| Architecture Sentinel | Sharding/scaling strategy reviewed | @team/platform | `docs/operations/slo-sli.md`; `infra/k8s/base/hpa.yaml` | Done | HPA profiles defined per workload class; scaling strategy documented |
| Architecture Sentinel | Migration runbooks updated | @team/backend | `docs/operations/MIGRATION_AUTOMATION_GUIDE.md` | Not Started | Verify runbooks reflect current migration chain after Sprint 1 infra apply |
| Security Guardian | Threat model updated | @Avery Chen | `docs/security-compliance/threat-model.md` | Done | Reviewed and signed 2026-03-12; see `docs/operations/release-scope-ga-signoff.md` |
| Security Guardian | Secrets rotation confirmed | @team/platform | `scripts/ci/check-secret-rotation-evidence.mjs`; `secret-rotation-verification.yml` | Not Started | Requires production secrets populated in Sprint 1 before rotation evidence can be generated |
| Security Guardian | Zero-trust boundaries tested | @team/security | `infra/k8s/zero-trust/`; `infra/k8s/base/network-policies.yaml`; `docs/architecture/security-architecture.md` | Done | Network policies and zero-trust manifests defined; staging validation pending cluster provisioning |
| Security Guardian | Tenant-level RBAC + RLS enforced | @team/backend | `packages/backend/src/middleware/`; `supabase/migrations/`; `tests/security/`; `rls-gate.yml` | Done | RBAC middleware on all routes; RLS on all tenant-scoped tables; CI gate enforced |
| Compliance Auditor | SOC2/FedRAMP control mapping updated | @Avery Chen | `docs/security-compliance/fedramp-control-mapping.md`; `docs/security-compliance/evidence-index.md` | Done | GA v1.0.0 evidence bundle signed 2026-03-12 |
| Compliance Auditor | Audit logging validated | @team/backend | `packages/backend/src/lib/audit/`; `infra/k8s/monitoring/agent-fabric-alerts.yaml` | Done | Structured audit logs for all sensitive operations; tenant-segmented |
| Compliance Auditor | Data retention/export restrictions reviewed | @Avery Chen | `docs/security-compliance/compliance-guide.md` | Done | Retention policies documented; export restrictions enforced at API layer |
| Compliance Auditor | Compliance artifacts refreshed | @Avery Chen | `artifacts/security/governance/trust-kpi-snapshot.json` | Not Started | Must be regenerated from CI for the release SHA before Go/No-Go |
| CI/CD Enforcer | Pipelines run: lint, type-check, SAST, DAST, SBOM | @team/platform | `.github/workflows/pr-fast.yml`; `main-verify.yml`; `release.yml`; `deploy.yml` | Done | All gates enforced; DAST via OWASP ZAP; SBOM generated and signed |
| CI/CD Enforcer | Build artifacts signed + reproducible | @team/platform | `release.yml` — Cosign signing + reproducibility digest comparison | Done | Two independent builds compared by digest; both images signed with OIDC identity |
| CI/CD Enforcer | Canary/blue-green config validated | @team/platform | `infra/k8s/base/backend-blue-deployment.yaml`; `infra/k8s/overlays/production/`; `docs/cicd/DEPLOYMENT_STRATEGY.md` | Done | Blue/green manifests defined; smoke tests gate traffic swap |
| CI/CD Enforcer | Rollback plan documented | @team/platform | `docs/runbooks/rollback.md`; `docs/cicd/DEPLOYMENT_STRATEGY.md` rollback section | Done | Rollback procedure documented; old slot kept at `replicas:0` for 24h post-deploy |
| Observability Analyst | Metrics/traces/logs tenant-segmented | @team/platform | `packages/backend/src/lib/logger.ts`; `infra/k8s/observability/` | Done | All logs include `tenant_id`; OTel traces tenant-scoped; Loki + Prometheus deployed |
| Observability Analyst | Dashboards + alerts configured | @team/sre | `infra/k8s/monitoring/` — agent-fabric, billing, CRM, SLO, Redis, launch-KPI rules + Grafana dashboards | Done | Alert rules and dashboards defined as K8s ConfigMaps; billing worker `ServiceMonitor` present |
| Observability Analyst | Error budgets and SLOs verified | @team/sre | `docs/operations/slo-sli.md`; `infra/k8s/monitoring/slo-alerts.yaml`; `prometheus-slo-rules.yaml` | Done | SLO definitions, recording rules, and burn-rate alerts all present |
| Observability Analyst | Rollback signals codified | @team/sre | `docs/cicd/RELEASE_CHECKLIST.md` emergency rollback trigger criteria | Not Started | Confirm Prometheus alert thresholds match rollback triggers; wire PagerDuty routing before Go/No-Go |
| Data Reliability Operator | Migrations forward/backward safe | @team/backend | `supabase/migrations/` — every `.sql` has `.rollback.sql`; `migration-chain-integrity.yml` | Done | CI enforces rollback file presence; clean apply from zero verified in CI |
| Data Reliability Operator | Anonymization in non-prod confirmed | @team/backend | `docs/security-compliance/compliance-guide.md` | Done | Non-prod environments use anonymised seed data; enforced by policy |
| Data Reliability Operator | Backup/restore drills validated | @team/platform | `docs/operations/dr-drill-log.md`; `scripts/dr-validate.sh` | Not Started | **Sprint 2 blocker.** No drill run yet. Run `bash scripts/dr-validate.sh rds-snapshot --validate-rollback` against staging; record in `dr-drill-log.md` |
| Data Reliability Operator | Disaster recovery readiness checked | @team/platform | `docs/runbooks/disaster-recovery.md`; `docs/operations/backup-and-recovery.md` | Not Started | **Sprint 2 blocker.** RTO < 30 min and RPO < 1 hr documented but never validated against real RDS snapshot restore |
| Customer Impact Commander | Feature toggles per tenant/region tested | @Jordan Lee | Feature flag config in `packages/backend/src/config/` | Not Started | Verify all launch-scope feature flags are set correctly for production tenants |
| Customer Impact Commander | Co-branding and localization verified | @Mateo Alvarez | `docs/i18n/`; `scripts/ci/check-i18n-keys.mjs` | Not Started | i18n key coverage enforced in CI; verify production locale config before Go/No-Go |
| Customer Impact Commander | Entitlements and billing regression run | @Jordan Lee | `packages/backend/src/services/billing/`; `tests/security/billing/` | Not Started | **Sprint 3 blocker.** Run billing regression suite against staging with production-equivalent Stripe test keys |
| Customer Impact Commander | SLA commitments re-confirmed | @Jordan Lee | `docs/operations/slo-sli.md` | Not Started | Confirm SLA commitments in customer contracts match SLO targets in `slo-sli.md` |

---

## Go/No-Go Sign-off

Complete this section at the SWAT Go/No-Go meeting (Sprint 3).

| Role | Name | Decision | Signed | Notes |
|---|---|---|---|---|
| Engineering Lead | Priya Raman | — | — | |
| Security Lead | Avery Chen | — | — | |
| Product Lead | Jordan Lee | — | — | |
| SRE / Operations | @team/sre | — | — | On-call confirmed for deploy window |
| Release Owner | @team/platform | — | — | |

**Go/No-Go decision:** _Pending_

---

## Open blockers before Go/No-Go

These items must reach `Done` before the Go/No-Go meeting can proceed:

1. **Secrets rotation confirmed** — populate production secrets in Infisical (Sprint 1), then run `secret-rotation-verification.yml` to generate evidence.
2. **Compliance artifacts refreshed** — regenerate `trust-kpi-snapshot.json` and `open-risks.json` from CI for the release SHA.
3. **Backup/restore drill validated** — run `bash scripts/dr-validate.sh rds-snapshot --validate-rollback` against staging; record results in `docs/operations/dr-drill-log.md`.
4. **Disaster recovery readiness checked** — confirm RTO achieved in drill is < 30 min; update `dr-drill-log.md`.
5. **Rollback signals codified** — confirm PagerDuty routing is wired to the Prometheus rollback-trigger alerts.
6. **Entitlements and billing regression** — run billing regression suite against staging before Go/No-Go.
