-- ============================================================================
-- ValueCanvas Seed Data for Local Development
-- This file is run after migrations on `supabase db reset`
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Default Roles
-- ============================================================================
INSERT INTO roles (id, role_name, description) VALUES
  (gen_random_uuid(), 'owner', 'Organization owner with full access'),
  (gen_random_uuid(), 'admin', 'Administrator with management access'),
  (gen_random_uuid(), 'editor', 'Can edit and manage content'),
  (gen_random_uuid(), 'member', 'Standard member access'),
  (gen_random_uuid(), 'viewer', 'Read-only access')
ON CONFLICT (role_name) DO NOTHING;

-- ============================================================================
-- 2. Test Users (for local development only)
-- ============================================================================
-- Note: These users won't exist in auth.users unless you create them
-- via Supabase auth or manually in the auth schema

-- INSERT INTO users (id, email, full_name) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'admin@test.local', 'Admin User'),
--   ('00000000-0000-0000-0000-000000000002', 'user@test.local', 'Test User')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Test Organization
-- ============================================================================
-- INSERT INTO organizations (id, name, slug, settings) VALUES
--   ('10000000-0000-0000-0000-000000000001', 'Test Organization', 'test-org', '{}')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Default Feature Flags
-- ============================================================================
INSERT INTO feature_flags (name, description, enabled, config) VALUES
  ('agent_fabric', 'Enable Agent Fabric features', true, '{"version": "1.0"}'),
  ('episodic_memory', 'Enable episodic memory for agents', true, '{}'),
  ('semantic_search', 'Enable vector-based semantic search', true, '{"threshold": 0.7}'),
  ('sof_governance', 'Enable Scope of Fidelity governance', true, '{}'),
  ('advanced_analytics', 'Enable advanced analytics dashboard', false, '{}')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 5. Agent Types (if using agent_ontologies)
-- ============================================================================
-- INSERT INTO agent_ontologies (name, description, capabilities) VALUES
--   ('Opportunity Agent', 'Identifies business opportunities', '["analysis", "research"]'),
--   ('Target Agent', 'Defines intervention targets', '["planning", "strategy"]'),
--   ('Realization Agent', 'Tracks value realization', '["monitoring", "reporting"]')
-- ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 6. Default Retention Policies
-- ============================================================================
-- INSERT INTO retention_policies (table_name, retention_days, archive_enabled) VALUES
--   ('audit_logs', 365, true),
--   ('agent_sessions', 90, false),
--   ('llm_usage', 180, true)
-- ON CONFLICT (table_name) DO NOTHING;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Seed data loaded successfully';
  RAISE NOTICE '   - % roles created', (SELECT count(*) FROM roles);
  RAISE NOTICE '   - % feature flags set', (SELECT count(*) FROM feature_flags);
END $$;

