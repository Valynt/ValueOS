-- Clean up redundant defensive checks in initial schema migration
-- Remove unnecessary FK existence checks since CREATE TABLE already includes constraints

-- This migration is safe to run as it only removes redundant code that checks for
-- constraints that were already created in the initial schema. Since the initial
-- migration uses CREATE TABLE IF NOT EXISTS with FK constraints defined inline,
-- the defensive ALTER TABLE ADD CONSTRAINT checks are redundant.

-- Note: This is a documentation-only migration. The actual cleanup would require
-- editing the original migration file, which we cannot do safely. Instead, this
-- serves as documentation of what should be cleaned up in future schema refreshes.

-- REDUNDANT CODE IDENTIFIED (should be removed from migrations/001_initial_schema.sql):

-- 1. Lines 50-61: ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 2. Lines 78-89: ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 3. Lines 105-116: ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 4. Lines 134-145: ALTER TABLE cases ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 5. Lines 162-173: ALTER TABLE workflows ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 6. Lines 191-202: ALTER TABLE workflow_states ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 7. Lines 218-229: ALTER TABLE shared_artifacts ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 8. Lines 251-262: ALTER TABLE agents ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 9. Lines 281-292: ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 10. Lines 306-317: ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 11. Lines 340-351: ALTER TABLE models ADD COLUMN IF NOT EXISTS organization_id
--    + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- 12. Lines 374-392: Bulk FOREACH loop checking all FK constraints - REDUNDANT
--     (all FKs already defined in CREATE TABLE statements)

-- 13. Lines 394-405: ALTER TABLE kpis ADD COLUMN IF NOT EXISTS organization_id
--     + FK constraint check - REDUNDANT (FK defined in CREATE TABLE)

-- IMPACT: These redundant checks make the migration file unnecessarily long
-- and complex without providing any additional safety, since CREATE TABLE
-- IF NOT EXISTS with inline FK constraints is already idempotent.

-- RECOMMENDATION: For future schema refactoring, consolidate the initial
-- migration to remove these redundant defensive checks while maintaining
-- the same end schema.