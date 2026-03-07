-- ============================================================================
-- ROLLBACK: <matching_migration_timestamp>_<description>
-- Undoes every change in the forward migration, in reverse order.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- Drop in reverse order of creation.
-- Policies are dropped automatically when the table is dropped.

-- DROP COLUMN example:
-- ALTER TABLE public.<existing_table>
--   DROP COLUMN IF EXISTS <column_name>;

-- DROP TABLE example (drops policies and indexes automatically):
DROP TABLE IF EXISTS public.<table_name> CASCADE;

-- DROP INDEX example (only needed if the table is not being dropped):
-- DROP INDEX IF EXISTS public.idx_<table_name>_<col>;
