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

- [ ] Schema evolution backward/forward compatible
- [ ] Shared vs schema-per-tenant validated
- [ ] Sharding/scaling strategy reviewed
- [ ] Migration runbooks updated

## Security Guardian

- [ ] Threat model updated
- [ ] Secrets rotation confirmed
- [ ] Zero-trust boundaries tested
- [ ] Tenant-level RBAC + RLS enforced

## Compliance Auditor

- [ ] SOC2/FedRAMP control mapping updated
- [ ] Audit logging validated
- [ ] Data retention/export restrictions reviewed
- [ ] Compliance artifacts refreshed

## CI/CD Enforcer

- [ ] Pipelines run: lint, type-check, SAST, DAST, SBOM
- [ ] Build artifacts signed + reproducible
- [ ] Canary/blue-green config validated
- [ ] Rollback plan documented

## Observability Analyst

- [ ] Metrics/traces/logs tenant-segmented
- [ ] Dashboards + alerts configured
- [ ] Error budgets and SLOs verified
- [ ] Rollback signals codified

## Data Reliability Operator

- [ ] Migrations forward/backward safe
- [ ] Anonymization in non-prod confirmed
- [ ] Backup/restore drills validated
- [ ] Disaster recovery readiness checked

## Customer Impact Commander

- [ ] Feature toggles per tenant/region tested
- [ ] Co-branding and localization verified
- [ ] Entitlements and billing regression run
- [ ] SLA commitments re-confirmed

---

## Evidence Tracker (optional but recommended)

| Area | Check | Owner | Evidence link | Status | Notes |
|---|---|---|---|---|---|
| Architecture Sentinel | Schema evolution backward/forward compatible |  |  | Not Started |  |
| Security Guardian | Threat model updated |  |  | Not Started |  |
| Compliance Auditor | SOC2/FedRAMP control mapping updated |  |  | Not Started |  |
| CI/CD Enforcer | Pipelines run: lint, type-check, SAST, DAST, SBOM |  |  | Not Started |  |
| Observability Analyst | Metrics/traces/logs tenant-segmented |  |  | Not Started |  |
| Data Reliability Operator | Backup/restore drills validated |  |  | Not Started |  |
| Customer Impact Commander | Entitlements and billing regression run |  |  | Not Started |  |

