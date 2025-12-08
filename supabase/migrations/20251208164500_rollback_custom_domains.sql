-- ============================================================================
-- Rollback Custom Domains Migration
-- ============================================================================
-- Safely removes custom domains and verification logs tables
-- Run this if you need to rollback the custom domains feature
-- ============================================================================

-- Drop helper function
DROP FUNCTION IF EXISTS log_domain_verification(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB);

-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS domain_verification_logs CASCADE;
DROP TABLE IF EXISTS custom_domains CASCADE;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_custom_domains_updated_at() CASCADE;
