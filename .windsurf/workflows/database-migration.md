---
description: Create and apply database migrations safely
---

# Database Migration Workflow

⚠️ **IMPORTANT**: Always review migration SQL before applying!

## Creating a New Migration

1. Generate a new migration file:

```bash
npx supabase migration new <migration_name>
```

2. Edit the migration file in `supabase/migrations/`

3. Lint the migration for issues:

```bash
npm run lint:migrations
```

## Testing the Migration

4. Reset local database to test migration:

```bash
npx supabase db reset
```

5. Run RLS validation after migration:

```bash
npm run test:rls
```

6. Verify critical fixes:

```bash
tsx scripts/run-sql-file.ts scripts/validate_critical_fixes.sql
```

## Applying to Staging

7. Deploy to staging:

```bash
bash scripts/deploy-migrations-staging.sh
```

## Rollback (if needed)

8. Rollback last migration:

```bash
bash scripts/rollback-migration.sh
```

## Post-Migration Checklist

- [ ] Migration runs without errors locally
- [ ] RLS policies validated
- [ ] Seed data works with new schema
- [ ] No breaking changes to API
- [ ] Staging deployment successful
