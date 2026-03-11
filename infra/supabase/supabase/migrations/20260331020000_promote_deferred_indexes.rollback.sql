-- Rollback: 20260331020000_promote_deferred_indexes.sql
-- Indexes are recreated by 20260331010000_deferred_tables.sql, so dropping
-- here only removes the duplicates added by this migration.
-- The tables themselves are not dropped.

-- no-op: all indexes in this migration are IF NOT EXISTS duplicates of
-- indexes already created in 20260331010000_deferred_tables.sql.
-- Dropping them here would remove the table-level indexes too, which is
-- handled by 20260331010000_deferred_tables.rollback.sql.
