-- ============================================================================
-- ValueCanvas Seed Data
-- Minimal seed data for local development
-- Runs automatically on `supabase db reset`
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Default Roles
-- ============================================================================

DO $$
BEGIN
  -- System roles (no organization_id)
  INSERT INTO roles (role_name, description, is_custom_role, permissions)
  VALUES
    ('owner', 'Organization owner with full access', false, '[]'::jsonb),
    ('admin', 'Administrator with management access', false, '[]'::jsonb),
    ('member', 'Standard member access', false, '[]'::jsonb),
    ('viewer', 'Read-only access', false, '[]'::jsonb)
  ON CONFLICT (role_name) DO NOTHING;
  
  RAISE NOTICE 'Created default roles';
END $$;

-- ============================================================================
-- 2. Essential Feature Flags
-- ============================================================================

DO $$
BEGIN
  INSERT INTO feature_flags (name, description, enabled, config)
  VALUES
    ('agent_fabric', 'Enable Agent Fabric', true, '{"version": "1.0"}'::jsonb),
    ('episodic_memory', 'Enable episodic memory', true, '{}'::jsonb),
    ('semantic_search', 'Enable vector search', true, '{"threshold": 0.7}'::jsonb),
    ('llm_monitoring', 'Enable LLM cost tracking', true, '{}'::jsonb)
  ON CONFLICT (name) DO NOTHING;
  
  RAISE NOTICE 'Created feature flags';
END $$;

-- ============================================================================
-- 3. Default Agents (Optional - uncomment if needed)
-- ============================================================================

-- DO $$
-- BEGIN
--   INSERT INTO agents (name, agent_type, description, model, system_prompt)
--   VALUES
--     ('Opportunity Agent', 'opportunity', 'Identifies business opportunities', 'gpt-4', 'You are an expert at identifying business opportunities...'),
--     ('Target Agent', 'target', 'Defines intervention targets', 'gpt-4', 'You are an expert at defining intervention targets...'),
--     ('Realization Agent', 'realization', 'Tracks value realization', 'gpt-4', 'You are an expert at tracking value realization...')
--   ON CONFLICT DO NOTHING;
--   
--   RAISE NOTICE 'Created default agents';
-- END $$;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  role_count INTEGER;
  flag_count INTEGER;
BEGIN
  SELECT count(*) INTO role_count FROM roles WHERE is_custom_role = false;
  SELECT count(*) INTO flag_count FROM feature_flags;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Seed Data Loaded Successfully';
  RAISE NOTICE '   Roles:         % system roles', role_count;
  RAISE NOTICE '   Feature Flags: % flags', flag_count;
  RAISE NOTICE '';
END $$;

