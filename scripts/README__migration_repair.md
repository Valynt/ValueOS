Migration repair instructions

Usage notes:
- Use these only if you understand the consequences; `supabase migration repair` marks migrations in the remote history as `applied` or `reverted` without executing them.
- This script requires SUPABASE_ACCESS_TOKEN environment variable or running `supabase login`.

Steps:
1) Pull remote migrations to sync local files:

  SUPABASE_ACCESS_TOKEN=... npm exec -- supabase db pull --debug

2) If the CLI outputs that the remote migration history doesn't match local files, the CLI prints a suggested `supabase migration repair --status ...` command. Review that list carefully.

3) Run the repair command that the CLI suggested, e.g. (example only):

  SUPABASE_ACCESS_TOKEN=... npm exec -- supabase migration repair --status reverted 20241122 20241123110000 20241123120000 20241123130000 20241123140000 20241123150000 20241123160000 20241127100000 20241127110000 20241127120000 20241128 20241129000000 20241129000001 20241129000002 20241129000003 20241129000004 20241129000005 20241129000006 20241129000007 20241129000008 20241129000009 20241129100000 20241129110000 20241129120000 20251117123718 20251117131452

4) After repair, re-run pull to sync local migration files:

  SUPABASE_ACCESS_TOKEN=... npm exec -- supabase db pull

5) You may now push local migrations:

  SUPABASE_ACCESS_TOKEN=... pnpm run db:push

6) Run validation tests:

  SUPABASE_ACCESS_TOKEN=... ./scripts/validate-tenant-rls.sh

Notes:
- If the `migration repair` list is large, work with the DBA or engineer who controls remote migrations to avoid accidentally marking migrations incorrectly.
- If you're unsure about the changes and the remote DB is 'canonical', pull the remote migrations first and integrate them locally before pushing.

