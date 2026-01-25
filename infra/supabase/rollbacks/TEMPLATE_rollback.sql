-- TEMPLATE_ROLLBACK.sql
-- Purpose: A template for writing rollback SQL for migrations placed in
-- `supabase/migrations/`. When you add a new migration SQL file, add a
-- corresponding rollback file in `supabase/rollbacks/` with the same
-- timestamp-prefix so the CI guard can verify a rollback exists.
--
-- Example: If your migration is `supabase/migrations/20260101010101_add_table.sql`
-- place the rollback at `supabase/rollbacks/20260101010101_add_table.rollback.sql`

-- Rollback template starts here. Edit to match your migration's changes.
-- Use transactions where appropriate and avoid dropping data without
-- confirmation in higher-level processes that this is safe.

BEGIN;

-- Example: undo table creation
-- DROP TABLE IF EXISTS public.my_table;

-- Example: undo column addition
-- ALTER TABLE public.some_table DROP COLUMN IF EXISTS new_column;

COMMIT;

-- Notes:
-- - Keep rollbacks idempotent where possible (use IF EXISTS / IF NOT EXISTS).
-- - Prefer explicit safe transforms over destructive operations.
-- - Review rollbacks as carefully as forwards during PR review.
