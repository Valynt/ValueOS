-- ============================================================================
-- 20260212000003_indexes.sql — Consolidated indexes for ValueOS
-- Inventory and standardization pass:
--   * Removed blanket EXCEPTION swallowing wrappers.
--   * Standardized names to idx_<table>__<cols>.
--   * Added per-index comments describing target query patterns.

-- ============================================================================
-- Legacy index rename/pre-check pass.
-- Raise explicit errors when both legacy and target names exist, or when an
-- expected target name exists on an unexpected table.
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  new_idx_table regclass;
BEGIN
  FOR rec IN
    SELECT *
    FROM (VALUES
      ('idx_audit_logs_org_created_id', 'idx_audit_logs__organization_id_created_at_id', 'public.audit_logs'),
      ('idx_cases_org_status_updated_id', 'idx_cases__organization_id_status_updated_at_id', 'public.cases'),
      ('idx_workflows_org_updated_id', 'idx_workflows__organization_id_updated_at_id', 'public.workflows'),
      ('idx_users_org_status_created_id', 'idx_users__organization_id_status_created_at_id', 'public.users'),
      ('idx_agent_runs_org_status_created_id', 'idx_agent_runs__organization_id_status_created_at_id', 'public.agent_runs'),
      ('idx_cases_fts', 'idx_cases__fts_title_description', 'public.cases'),
      ('idx_models_fts', 'idx_models__fts_name_description', 'public.models'),
      ('idx_cases_title_trgm', 'idx_cases__lower_title_trgm', 'public.cases'),
      ('idx_models_name_trgm', 'idx_models__lower_name_trgm', 'public.models'),
      ('idx_workflows_name_trgm', 'idx_workflows__lower_name_trgm', 'public.workflows'),
      ('idx_cases_metadata_gin', 'idx_cases__metadata_gin', 'public.cases'),
      ('idx_workflows_definition_gin', 'idx_workflows__definition_gin', 'public.workflows'),
      ('idx_agents_config_gin', 'idx_agents__config_gin', 'public.agents'),
      ('idx_shared_artifacts_content_gin', 'idx_shared_artifacts__content_gin', 'public.shared_artifacts'),
      ('idx_llm_usage_tenant_endpoint_created_at', 'idx_llm_usage__tenant_id_endpoint_created_at', 'public.llm_usage'),
      ('idx_llm_usage_tenant_created', 'idx_llm_usage__tenant_id_created_at', 'public.llm_usage'),
      ('idx_audit_logs_org_action_created_at', 'idx_audit_logs__organization_id_action_created_at', 'public.audit_logs'),
      ('idx_audit_logs_tenant_action_created_at', 'idx_audit_logs__tenant_id_action_created_at', 'public.audit_logs'),
      ('idx_audit_logs_tenant_created_id', 'idx_audit_logs__tenant_id_created_at_id', 'public.audit_logs'),
      ('idx_audit_logs_resource_org', 'idx_audit_logs__tenant_id_resource_id', 'public.audit_logs'),
      ('idx_audit_logs_trace_id', 'idx_audit_logs__tenant_id_trace_id', 'public.audit_logs'),
      ('idx_audit_logs_request_id', 'idx_audit_logs__tenant_id_request_id', 'public.audit_logs'),
      ('idx_messages_tenant_case_created_at', 'idx_messages__tenant_id_case_id_created_at', 'public.messages'),
      ('idx_messages_tenant_workflow_created_at', 'idx_messages__tenant_id_workflow_id_created_at', 'public.messages'),
      ('idx_messages_case_tenant', 'idx_messages__tenant_id_case_id', 'public.messages'),
      ('idx_messages_workflow_tenant', 'idx_messages__tenant_id_workflow_id', 'public.messages'),
      ('idx_opportunities_tenant_value_case', 'idx_opportunities__tenant_id_value_case_id', 'public.opportunities'),
      ('idx_opportunities_tenant_status_created_at', 'idx_opportunities__tenant_id_status_created_at', 'public.opportunities'),
      ('idx_opportunities_tenant_created_at_amount', 'idx_opportunities__tenant_id_created_at_amount', 'public.opportunities'),
      ('idx_opportunities_tenant_status_value_case', 'idx_opportunities__tenant_id_status_value_case_id', 'public.opportunities'),
      ('idx_opportunities_tenant_amount_created_at', 'idx_opportunities__tenant_id_amount_created_at', 'public.opportunities'),
      ('idx_value_cases_tenant_status_updated_at', 'idx_value_cases__tenant_id_status_updated_at', 'public.value_cases'),
      ('idx_value_cases_tenant_session_created_at', 'idx_value_cases__tenant_id_session_id_created_at', 'public.value_cases'),
      ('idx_cases_tenant_status_updated_at', 'idx_cases__tenant_id_status_updated_at', 'public.cases'),
      ('idx_cases_tenant_status_updated_id', 'idx_cases__tenant_id_status_updated_at_id', 'public.cases'),
      ('idx_cases_user_org', 'idx_cases__tenant_id_user_id', 'public.cases'),
      ('idx_agent_runs_tenant_status_created_id', 'idx_agent_runs__tenant_id_status_created_at_id', 'public.agent_runs'),
      ('idx_agent_runs_tenant_type_created_at', 'idx_agent_runs__tenant_id_agent_type_created_at', 'public.agent_runs')
    ) AS t(old_name, new_name, expected_table)
  LOOP
    IF to_regclass('public.' || rec.new_name) IS NOT NULL THEN
      SELECT i.indrelid::regclass
      INTO new_idx_table
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = rec.new_name;

      IF new_idx_table::text <> rec.expected_table THEN
        RAISE EXCEPTION 'Index % already exists on %, expected %', rec.new_name, new_idx_table, rec.expected_table;
      END IF;
    END IF;

    IF to_regclass('public.' || rec.old_name) IS NOT NULL THEN
      IF to_regclass('public.' || rec.new_name) IS NOT NULL THEN
        RAISE EXCEPTION 'Both legacy index % and target index % exist; resolve manually before migration', rec.old_name, rec.new_name;
      END IF;

      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.old_name, rec.new_name);
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================

-- ==========================================================================
-- Cursor pagination indexes (organization-scoped)
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs__organization_id_created_at_id
  ON public.audit_logs (organization_id, created_at DESC, id DESC);
COMMENT ON INDEX public.idx_audit_logs__organization_id_created_at_id IS
  'Cursor pagination for organization audit logs ordered by created_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_cases__organization_id_status_updated_at_id
  ON public.cases (organization_id, status, updated_at DESC, id DESC);
COMMENT ON INDEX public.idx_cases__organization_id_status_updated_at_id IS
  'Organization-scoped case listing filtered by status and ordered by updated_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_workflows__organization_id_updated_at_id
  ON public.workflows (organization_id, updated_at DESC, id DESC);
COMMENT ON INDEX public.idx_workflows__organization_id_updated_at_id IS
  'Cursor pagination for organization workflows ordered by updated_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_users__organization_id_status_created_at_id
  ON public.users (organization_id, status, created_at DESC, id DESC);
COMMENT ON INDEX public.idx_users__organization_id_status_created_at_id IS
  'Organization user listing filtered by status and ordered by created_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_agent_runs__organization_id_status_created_at_id
  ON public.agent_runs (organization_id, status, created_at DESC, id DESC);
COMMENT ON INDEX public.idx_agent_runs__organization_id_status_created_at_id IS
  'Organization agent run listing filtered by status and ordered by created_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_audit_logs__organization_id_action_created_at
  ON public.audit_logs (organization_id, action, created_at DESC);
COMMENT ON INDEX public.idx_audit_logs__organization_id_action_created_at IS
  'Organization audit filtering by action with recent-first ordering.';

-- ==========================================================================
-- Full-text search indexes
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_cases__fts_title_description
  ON public.cases USING GIN (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  );
COMMENT ON INDEX public.idx_cases__fts_title_description IS
  'Full-text search on case title + description for keyword discovery.';

CREATE INDEX IF NOT EXISTS idx_models__fts_name_description
  ON public.models USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  );
COMMENT ON INDEX public.idx_models__fts_name_description IS
  'Full-text search on model name + description for catalog discovery.';

-- ==========================================================================
-- Trigram indexes for fuzzy/ILIKE queries
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_cases__lower_title_trgm
  ON public.cases USING GIN (lower(title) gin_trgm_ops);
COMMENT ON INDEX public.idx_cases__lower_title_trgm IS
  'Case title fuzzy match and ILIKE searches using trigram matching.';

CREATE INDEX IF NOT EXISTS idx_models__lower_name_trgm
  ON public.models USING GIN (lower(name) gin_trgm_ops);
COMMENT ON INDEX public.idx_models__lower_name_trgm IS
  'Model name fuzzy match and ILIKE searches using trigram matching.';

CREATE INDEX IF NOT EXISTS idx_workflows__lower_name_trgm
  ON public.workflows USING GIN (lower(name) gin_trgm_ops);
COMMENT ON INDEX public.idx_workflows__lower_name_trgm IS
  'Workflow name fuzzy match and ILIKE searches using trigram matching.';

-- ==========================================================================
-- JSONB indexes for metadata/config filtering
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_cases__metadata_gin
  ON public.cases USING GIN (metadata);
COMMENT ON INDEX public.idx_cases__metadata_gin IS
  'Case metadata JSONB containment/existence filters.';

CREATE INDEX IF NOT EXISTS idx_workflows__definition_gin
  ON public.workflows USING GIN (definition);
COMMENT ON INDEX public.idx_workflows__definition_gin IS
  'Workflow definition JSONB containment/existence filters.';

CREATE INDEX IF NOT EXISTS idx_agents__config_gin
  ON public.agents USING GIN (config);
COMMENT ON INDEX public.idx_agents__config_gin IS
  'Agent configuration JSONB containment/existence filters.';

CREATE INDEX IF NOT EXISTS idx_shared_artifacts__content_gin
  ON public.shared_artifacts USING GIN (content);
COMMENT ON INDEX public.idx_shared_artifacts__content_gin IS
  'Shared artifact content JSONB containment/existence filters.';

-- ==========================================================================
-- Tenant hot-path indexes (tenant_id leading)
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_llm_usage__tenant_id_endpoint_created_at
  ON public.llm_usage (tenant_id, endpoint, created_at DESC);
COMMENT ON INDEX public.idx_llm_usage__tenant_id_endpoint_created_at IS
  'Tenant usage analytics filtered by endpoint and ordered by newest first.';

CREATE INDEX IF NOT EXISTS idx_llm_usage__tenant_id_created_at
  ON public.llm_usage (tenant_id, created_at DESC);
COMMENT ON INDEX public.idx_llm_usage__tenant_id_created_at IS
  'Tenant usage timeline queries ordered by created_at DESC.';

CREATE INDEX IF NOT EXISTS idx_audit_logs__tenant_id_action_created_at
  ON public.audit_logs (tenant_id, action, created_at DESC);
COMMENT ON INDEX public.idx_audit_logs__tenant_id_action_created_at IS
  'Tenant audit filtering by action with recent-first ordering.';

CREATE INDEX IF NOT EXISTS idx_audit_logs__tenant_id_created_at_id
  ON public.audit_logs (tenant_id, created_at DESC, id DESC);
COMMENT ON INDEX public.idx_audit_logs__tenant_id_created_at_id IS
  'Tenant audit cursor pagination ordered by created_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_audit_logs__tenant_id_resource_id
  ON public.audit_logs (tenant_id, resource_id);
COMMENT ON INDEX public.idx_audit_logs__tenant_id_resource_id IS
  'Tenant audit lookups by resource_id for resource-scoped event history.';

CREATE INDEX IF NOT EXISTS idx_audit_logs__tenant_id_trace_id
  ON public.audit_logs (tenant_id, trace_id);
COMMENT ON INDEX public.idx_audit_logs__tenant_id_trace_id IS
  'Tenant audit correlation by trace_id for distributed request tracing.';

CREATE INDEX IF NOT EXISTS idx_audit_logs__tenant_id_request_id
  ON public.audit_logs (tenant_id, request_id);
COMMENT ON INDEX public.idx_audit_logs__tenant_id_request_id IS
  'Tenant audit correlation by request_id for request-level troubleshooting.';

CREATE INDEX IF NOT EXISTS idx_messages__tenant_id_case_id_created_at
  ON public.messages (tenant_id, case_id, created_at DESC);
COMMENT ON INDEX public.idx_messages__tenant_id_case_id_created_at IS
  'Tenant case message feeds filtered by case_id and ordered by newest first.';

CREATE INDEX IF NOT EXISTS idx_messages__tenant_id_workflow_id_created_at
  ON public.messages (tenant_id, workflow_id, created_at DESC);
COMMENT ON INDEX public.idx_messages__tenant_id_workflow_id_created_at IS
  'Tenant workflow message feeds filtered by workflow_id and ordered by newest first.';

CREATE INDEX IF NOT EXISTS idx_messages__tenant_id_case_id
  ON public.messages (tenant_id, case_id);
COMMENT ON INDEX public.idx_messages__tenant_id_case_id IS
  'Tenant message existence and join lookups by case_id.';

CREATE INDEX IF NOT EXISTS idx_messages__tenant_id_workflow_id
  ON public.messages (tenant_id, workflow_id);
COMMENT ON INDEX public.idx_messages__tenant_id_workflow_id IS
  'Tenant message existence and join lookups by workflow_id.';

-- ==========================================================================
-- Opportunities indexes
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_opportunities__tenant_id_value_case_id
  ON public.opportunities (tenant_id, value_case_id);
COMMENT ON INDEX public.idx_opportunities__tenant_id_value_case_id IS
  'Tenant opportunity lookups and joins by value_case_id.';

CREATE INDEX IF NOT EXISTS idx_opportunities__tenant_id_status_created_at
  ON public.opportunities (tenant_id, status, created_at DESC);
COMMENT ON INDEX public.idx_opportunities__tenant_id_status_created_at IS
  'Tenant opportunity listing filtered by status and ordered by created_at DESC.';

CREATE INDEX IF NOT EXISTS idx_opportunities__tenant_id_created_at_amount
  ON public.opportunities (tenant_id, created_at DESC, amount DESC);
COMMENT ON INDEX public.idx_opportunities__tenant_id_created_at_amount IS
  'Tenant opportunity recency feed with secondary amount sorting.';

CREATE INDEX IF NOT EXISTS idx_opportunities__tenant_id_status_value_case_id
  ON public.opportunities (tenant_id, status, value_case_id);
COMMENT ON INDEX public.idx_opportunities__tenant_id_status_value_case_id IS
  'Tenant opportunity filtering by status with value_case drill-down.';

CREATE INDEX IF NOT EXISTS idx_opportunities__tenant_id_amount_created_at
  ON public.opportunities (tenant_id, amount DESC, created_at DESC);
COMMENT ON INDEX public.idx_opportunities__tenant_id_amount_created_at IS
  'Tenant opportunity ranking by amount with recency tie-breaker.';

-- ==========================================================================
-- Value cases indexes
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_value_cases__tenant_id_status_updated_at
  ON public.value_cases (tenant_id, status, updated_at DESC);
COMMENT ON INDEX public.idx_value_cases__tenant_id_status_updated_at IS
  'Tenant value case listing filtered by status and ordered by updated_at DESC.';

CREATE INDEX IF NOT EXISTS idx_value_cases__tenant_id_session_id_created_at
  ON public.value_cases (tenant_id, session_id, created_at DESC);
COMMENT ON INDEX public.idx_value_cases__tenant_id_session_id_created_at IS
  'Tenant session timeline for value cases ordered by created_at DESC.';

-- ==========================================================================
-- Cases tenant indexes
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_cases__tenant_id_status_updated_at
  ON public.cases (tenant_id, status, updated_at DESC);
COMMENT ON INDEX public.idx_cases__tenant_id_status_updated_at IS
  'Tenant case listing filtered by status and ordered by updated_at DESC.';

CREATE INDEX IF NOT EXISTS idx_cases__tenant_id_status_updated_at_id
  ON public.cases (tenant_id, status, updated_at DESC, id DESC);
COMMENT ON INDEX public.idx_cases__tenant_id_status_updated_at_id IS
  'Tenant case cursor pagination filtered by status and ordered by updated_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_cases__tenant_id_user_id
  ON public.cases (tenant_id, user_id);
COMMENT ON INDEX public.idx_cases__tenant_id_user_id IS
  'Tenant case joins/lookups by user_id.';

-- ==========================================================================
-- Agent runs tenant indexes
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_agent_runs__tenant_id_status_created_at_id
  ON public.agent_runs (tenant_id, status, created_at DESC, id DESC);
COMMENT ON INDEX public.idx_agent_runs__tenant_id_status_created_at_id IS
  'Tenant agent run cursor pagination filtered by status and ordered by created_at DESC, id DESC.';

CREATE INDEX IF NOT EXISTS idx_agent_runs__tenant_id_agent_type_created_at
  ON public.agent_runs (tenant_id, agent_type, created_at DESC);
COMMENT ON INDEX public.idx_agent_runs__tenant_id_agent_type_created_at IS
  'Tenant agent run listing filtered by agent_type and ordered by created_at DESC.';
