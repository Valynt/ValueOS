---
title: Runbooks
owner: team-platform
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
system: valueos-platform
ops_labels: runbooks,index,legacy
status: deprecated
---

# Runbooks

> [!WARNING]
> This index is maintained for backward compatibility and contains legacy/deprecated runbooks. Use [`docs/operations/runbooks/`](../operations/runbooks/) for authoritative operator workflows.

**Last Updated**: 2026-02-16

---

## Runbook Metadata Requirements

All runbooks must include operational ownership metadata near the top of the document, either as YAML frontmatter or markdown metadata lines:

- `owner: <team-or-person>` or `Owner: <team-or-person>`
- `system: <backstage-system>`
- `ops_labels: <comma-separated-labels>` or `Ops-Labels: <comma-separated-labels>`

This metadata is enforced in CI for changed files under `docs/runbooks/**`, and catalog/doc ownership metadata is validated in the main CI lane.

---

## Documents in this Category

- [Agent Runbook](./agent-runbook.md)
- [Database Runbook](./database-runbook.md)
- [Deployment Runbook](./deployment-runbook.md)
- [Deployment (DB Gate Wrapper)](./deployment.md)
- [Rollback Runbook](./rollback.md)
- [Staging Deployment Runbook](./STAGING_DEPLOYMENT_RUNBOOK.md)
- [Emergency Procedures](./emergency-procedures.md)
- [Infrastructure Runbook](./infrastructure-runbook.md)
- [Performance Runbook](./performance-runbook.md)
- [Security Runbook](./security-runbook.md)

---

**Total Documents**: 10
