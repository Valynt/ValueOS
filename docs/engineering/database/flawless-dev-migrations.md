# Flawless Dev Database Migrations

This guide defines what "flawless" database migrations look like in local development for ValueOS. The goal is a workflow where schema changes are **versioned**, **automated**, and **reproducible**, so every developer runs the same migrations that will run in production.

## Pillars of Excellence

### 1) One-Command Setup

A developer should be able to clone the repo and run a single command to reach a ready-to-work database state.

**Requirements**
- **Idempotent**: Running the setup multiple times must not break or drift the schema.
- **Automated**: Local dev should auto-apply migrations on start or via a standard script.
- **Fast**: Fresh setup should complete in minutes, not hours.

**Recommended Flow**
- `supabase db reset` to rebuild schema + seed data locally.
- `supabase db push` to apply pending migrations without resets.

### 2) Versioned Truth

The repository is the single source of truth, not a shared database.

**Rules**
- Every schema change is a migration committed to git.
- No manual edits to schemas via UI tools.
- Migration files are ordered and timestamped for deterministic application.

### 3) Smart Seed Data

Local databases should be usable immediately with representative data.

**Requirements**
- **Synthetic or anonymized seed data** (not production dumps).
- **Edge-case coverage** (e.g., users with zero orders, heavy usage records, missing optional fields).
- **Separation of concerns**: schema migrations are distinct from seed data.

## What Excellence Feels Like (Vibe Check)

- Onboarding takes minutes.
- Branch switching updates schema automatically and safely.
- Local migrations match production behavior exactly.
- The database is an implementation detail, not a blocker.

## Recommended Workflow

### Create a Migration
1. Generate a migration from schema changes:
   ```bash
   supabase db diff --file <name>
   ```
2. Review the SQL for safety (avoid destructive operations unless explicitly planned).
3. Add a rollback when possible.

### Apply Migrations Locally
- **Fresh setup**:
  ```bash
  supabase db reset
  ```
- **Incremental**:
  ```bash
  supabase db push
  ```

### Validate Before Merge
Run the standard migration safety checks:
```bash
pnpm run migration:validate
pnpm run migration:safety
```

## Collaboration & Drift Prevention

| Risk Area | Mediocre | Excellent |
| --- | --- | --- |
| **Schema drift** | Local DB diverges from prod | CI enforces migration application on a clean DB |
| **Rollbacks** | "Fix it in the next PR" | Every migration has a rollback or forward-fix plan |
| **Validation** | Failures discovered late | Linting and safety checks catch risky SQL in PRs |
| **Concurrency** | Colliding migration names | Timestamped migrations avoid conflicts |

## Checklist for PRs with Migrations

- [ ] Migration file exists and is timestamped
- [ ] Schema changes are only in migrations (no manual edits)
- [ ] Rollback or forward-fix plan documented
- [ ] `pnpm run migration:validate` passes
- [ ] `pnpm run migration:safety` passes
- [ ] Seed data remains deterministic and idempotent

## Notes for ValueOS

- See **Zero-Downtime Migrations** for expand/contract guidance.
- Follow the **Schema Governance Plan** for safety and auditing expectations.
- Use local setup scripts in the Quick Start to bootstrap Supabase and apply migrations.
