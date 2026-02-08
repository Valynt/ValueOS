-- Migration: Multi-tenant indexing strategy and query optimization
-- Run with: supabase db push (or your migration tool)

-- ============================================
-- Tenant-scoped composite indexes for filtering + cursor pagination
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_id
  ON audit_logs (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cases_org_status_updated_id
  ON cases (organization_id, status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_workflows_org_updated_id
  ON workflows (organization_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_users_org_status_created_id
  ON users (organization_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org_status_created_id
  ON agent_runs (organization_id, status, created_at DESC, id DESC);

-- ============================================
-- Search indexes (GIN/FTS and trigram)
-- ============================================

-- Full-text search for case discovery
CREATE INDEX IF NOT EXISTS idx_cases_fts
  ON cases USING GIN (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  );

-- Full-text search for model discovery
CREATE INDEX IF NOT EXISTS idx_models_fts
  ON models USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  );

-- Trigram search for fuzzy/ILIKE queries on names
CREATE INDEX IF NOT EXISTS idx_cases_title_trgm
  ON cases USING GIN (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_models_name_trgm
  ON models USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_workflows_name_trgm
  ON workflows USING GIN (lower(name) gin_trgm_ops);

-- ============================================
-- JSONB indexes for metadata/config filtering
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cases_metadata_gin
  ON cases USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_workflows_definition_gin
  ON workflows USING GIN (definition);

CREATE INDEX IF NOT EXISTS idx_agents_config_gin
  ON agents USING GIN (config);

CREATE INDEX IF NOT EXISTS idx_shared_artifacts_content_gin
  ON shared_artifacts USING GIN (content);
