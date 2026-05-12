# Remediation Validation Report — 2026-05-12

## Package under remediation
- Detected codebase type: **backend TypeScript monorepo** (`pnpm` workspace with root `test:rls` and CI check scripts).
- Validation commands therefore use workspace scripts and targeted repo checks (not Python-service commands).

## Validation command suite

### 1) Tenant isolation
```bash
pnpm run test:rls
```

### 2) FK cascade behavior
```bash
rg -n -e 'foreign key cascade' -e 'ON DELETE CASCADE' infra/supabase docs/db
```

### 3) Field-name policy enforcement
```bash
rg -n -e 'field-name' -e 'field name' -e 'naming policy' -e 'naming convention' packages/backend infra/supabase tests
```

### 4) Model-registry schema assertions
```bash
rg -n -e 'model registry' -e 'model_registry' -e 'registry schema' -e 'schema assertions' packages/backend infra/supabase tests modeling
```

## Reproducible baseline/post-fix counts

Run the exact commands below:

```bash
# Tenant isolation count baseline
rg -n -e 'tenant isolation' -e 'cross-tenant' -e 'test:rls' tests infra/supabase/tests packages/backend/src/workers/__tests__ | wc -l

# FK cascade count baseline
rg -n -e 'foreign key cascade' -e 'fk cascade' -e 'ON DELETE CASCADE' -e 'referential integrity' infra/supabase docs/db | wc -l

# Field-name policy count baseline
rg -n -e 'field-name' -e 'field name' -e 'naming policy' -e 'naming convention' packages/backend infra/supabase tests | wc -l

# Model-registry schema assertion count baseline
rg -n -e 'model registry' -e 'model_registry' -e 'registry schema' -e 'schema assertions' packages/backend infra/supabase tests modeling | wc -l
```

| Check area | Baseline count (2026-05-12) | Post-fix count (2026-05-12) |
|---|---:|---:|
| Tenant isolation coverage refs | 63 | 63 |
| FK cascade coverage refs | 862 | 862 |
| Field-name policy enforcement refs | 30 | 30 |
| Model-registry schema assertion refs | 2 | 2 |

## Notes
- Counts above are reference-count baselines for reproducibility and drift detection.
- Functional enforcement should continue to rely on executable suites (`pnpm run test:rls`) and SQL/runtime integration checks where database connectivity is available.
