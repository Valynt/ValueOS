---
title: Database Rollback Runbook
owner: team-platform
ops_labels: rollback,database,incident-response
system: valueos-platform
status: active
---

# Rollback Runbook

Use this in conjunction with:

- [`docs/runbooks/disaster-recovery.md`](./disaster-recovery.md)
- [`docs/operations/runbooks/deployment-runbook.md`](../operations/runbooks/deployment-runbook.md)

## Rollback policy

1. Prefer application rollback first when schema is backward compatible.
2. Use schema rollback only when explicitly reviewed and pre-authored.
3. For irreversible migrations, execute forward-fix playbook rather than ad-hoc manual DDL.
4. Capture incident timeline, migration IDs, and trace IDs for audit.

## Required evidence

- Backup artifact/time
- Migration versions applied
- Validation command output after rollback/forward-fix
