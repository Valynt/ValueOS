---
title: Database-aware Deployment Runbook
owner: team-platform
ops_labels: deployment,database,release
system: valueos-platform
status: active
---

# Deployment Runbook

Canonical operational deployment procedure lives in:

- [`docs/operations/runbooks/deployment-runbook.md`](../operations/runbooks/deployment-runbook.md)

For schema and migration governance requirements during deploy, also use:

- [`docs/db/schema-governance-plan.md`](../db/schema-governance-plan.md)
- [`infra/supabase/sql/ops/security-governance-checks.sql`](../../infra/supabase/sql/ops/security-governance-checks.sql)

## Mandatory DB gates before production deployment

1. `supabase db lint` passes.
2. Migration naming/lint checks pass.
3. Security governance SQL checks report no violations.
4. Backup confirmation recorded.
5. Rollback/forward-fix plan attached for migrations in scope.
