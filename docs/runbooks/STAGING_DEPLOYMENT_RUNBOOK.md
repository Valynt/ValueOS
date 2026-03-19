---
title: Staging Deployment Runbook
owner: team-platform
ops_labels: staging,deployment,database
system: valueos-platform
status: active
---

# Staging Deployment Runbook

Use staging as the mandatory proving ground for schema changes before production.

## Required staging checks

1. Apply migrations on clean staging baseline.
2. Run `supabase db lint`.
3. Run security governance checks from `infra/supabase/sql/ops/security-governance-checks.sql`.
4. Run tenant isolation tests (`pnpm run test:rls`).
5. Validate critical query plans for RLS-indexed paths.

Only promote to production when all checks pass and evidence is attached to the release record.
