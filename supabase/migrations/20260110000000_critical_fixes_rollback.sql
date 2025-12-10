-- ============================================================================
-- ROLLBACK MIGRATION FOR CRITICAL RLS FIXES
-- ============================================================================
-- Migration: 20260110000000_critical_fixes_rollback
-- Date: 2025-12-10
-- Purpose: Safe rollback of critical RLS performance and security fixes
-- 
-- WARNING: This rollback will:
-- 1. Revert RLS policies to use is_org_member() (slower performance)
-- 2. Remove auth.get_current_org_id() function
-- 3. Revert audit immutability triggers to basic version
-- 4. Drop composite indexes
-- 5. Remove organization_id from junction tables (data loss if executed after production use)
-- 
-- IMPORTANT: Only use this rollback if:
-- - Migration caused unexpected issues in staging
-- - Need to revert to previous state for debugging
-- - DO NOT use in production after applications depend on new schema
-- ============================================================================

BEGIN;

\echo ''
\echo '============================================================================'
\echo 'ROLLBACK: Reverting Critical RLS Performance and Security Fixes'
\echo '============================================================================'
\echo ''
\echo 'WARNING: This will revert performance optimizations and remove schema changes.'
\echo 'Press Ctrl+C within 5 seconds to cancel...'
\echo ''

SELECT pg_sleep(5);

-- ============================================================================
-- SECTION 1: REVERT RLS POLICIES TO ORIGINAL is_org_member()
-- ============================================================================

\echo 'Reverting RLS policies to use is_org_member()...'

-- Organizations
DROP POLICY IF EXISTS orgs_select_memberships ON public.organizations;
CREATE POLICY orgs_select_memberships ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

-- Roles
DROP POLICY IF EXISTS roles_tenant_isolation ON public.roles;
CREATE POLICY roles_tenant_isolation ON public.roles
  FOR ALL TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id))
  WITH CHECK (organization_id IS NULL OR public.is_org_member(organization_id));

-- Cases
DROP POLICY IF EXISTS cases_tenant_isolation ON public.cases;
CREATE POLICY cases_tenant_isolation ON public.cases
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Workflows
DROP POLICY IF EXISTS workflows_tenant_isolation ON public.workflows;
CREATE POLICY workflows_tenant_isolation ON public.workflows
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Messages
DROP POLICY IF EXISTS messages_tenant_isolation ON public.messages;
CREATE POLICY messages_tenant_isolation ON public.messages
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Agents
DROP POLICY IF EXISTS agents_tenant_isolation ON public.agents;
CREATE POLICY agents_tenant_isolation ON public.agents
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Agent Sessions
DROP POLICY IF EXISTS agent_sessions_tenant_isolation ON public.agent_sessions;
CREATE POLICY agent_sessions_tenant_isolation ON public.agent_sessions
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Episodic Memory
DROP POLICY IF EXISTS episodic_memory_tenant_isolation ON public.episodic_memory;
CREATE POLICY episodic_memory_tenant_isolation ON public.episodic_memory
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- Agent Memory
DROP POLICY IF EXISTS agent_memory_tenant_isolation ON public.agent_memory;
CREATE POLICY agent_memory_tenant_isolation ON public.agent_memory
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- LLM Usage
DROP POLICY IF EXISTS llm_usage_tenant_isolation ON public.llm_usage;
CREATE POLICY llm_usage_tenant_isolation ON public.llm_usage
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- Agent Predictions
DROP POLICY IF EXISTS agent_predictions_tenant_isolation ON public.agent_predictions;
CREATE POLICY agent_predictions_tenant_isolation ON public.agent_predictions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- Value Fabric tables (abbreviated for brevity - similar pattern)
DROP POLICY IF EXISTS valuefabric_tenant_isolation ON public.business_objectives;
CREATE POLICY valuefabric_tenant_isolation ON public.business_objectives
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_capabilities_tenant ON public.capabilities;
CREATE POLICY valuefabric_capabilities_tenant ON public.capabilities
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_use_cases_tenant ON public.use_cases;
CREATE POLICY valuefabric_use_cases_tenant ON public.use_cases
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_kpis_tenant ON public.kpis;
CREATE POLICY valuefabric_kpis_tenant ON public.kpis
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_value_trees_tenant ON public.value_trees;
CREATE POLICY valuefabric_value_trees_tenant ON public.value_trees
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_value_commits_tenant ON public.value_commits;
CREATE POLICY valuefabric_value_commits_tenant ON public.value_commits
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Additional Value Fabric tables
DROP POLICY IF EXISTS valuefabric_roi_models_tenant ON public.roi_models;
CREATE POLICY valuefabric_roi_models_tenant ON public.roi_models
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_roi_calculations_tenant ON public.roi_model_calculations;
CREATE POLICY valuefabric_roi_calculations_tenant ON public.roi_model_calculations
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_benchmarks_tenant ON public.benchmarks;
CREATE POLICY valuefabric_benchmarks_tenant ON public.benchmarks
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_kpi_targets_tenant ON public.kpi_targets;
CREATE POLICY valuefabric_kpi_targets_tenant ON public.kpi_targets
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_telemetry_tenant ON public.telemetry_events;
CREATE POLICY valuefabric_telemetry_tenant ON public.telemetry_events
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_realization_reports_tenant ON public.realization_reports;
CREATE POLICY valuefabric_realization_reports_tenant ON public.realization_reports
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_realization_results_tenant ON public.realization_results;
CREATE POLICY valuefabric_realization_results_tenant ON public.realization_results
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_expansion_models_tenant ON public.expansion_models;
CREATE POLICY valuefabric_expansion_models_tenant ON public.expansion_models
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_expansion_improvements_tenant ON public.expansion_improvements;
CREATE POLICY valuefabric_expansion_improvements_tenant ON public.expansion_improvements
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_financial_metrics_tenant ON public.financial_metrics;
CREATE POLICY valuefabric_financial_metrics_tenant ON public.financial_metrics
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_value_tree_nodes_tenant ON public.value_tree_nodes;
CREATE POLICY valuefabric_value_tree_nodes_tenant ON public.value_tree_nodes
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS valuefabric_value_tree_links_tenant ON public.value_tree_links;
CREATE POLICY valuefabric_value_tree_links_tenant ON public.value_tree_links
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

\echo '✅ Reverted RLS policies to original is_org_member() function'

-- ============================================================================
-- SECTION 2: DROP OPTIMIZED FUNCTIONS
-- ============================================================================

\echo 'Dropping optimized functions...'

DROP FUNCTION IF EXISTS public.is_org_member_optimized(UUID);
DROP FUNCTION IF EXISTS auth.get_current_org_id();
DROP FUNCTION IF EXISTS public.validate_critical_fixes();

\echo '✅ Removed optimized functions'

-- ============================================================================
-- SECTION 3: REVERT AUDIT IMMUTABILITY TRIGGERS
-- ============================================================================

\echo 'Reverting audit immutability triggers to basic version...'

-- Restore original prevent_audit_modification function (without logging)
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

\echo '✅ Reverted audit triggers to basic version'

-- ============================================================================
-- SECTION 4: DROP COMPOSITE INDEXES
-- ============================================================================

\echo 'Dropping composite indexes...'

DROP INDEX CONCURRENTLY IF EXISTS public.idx_cases_org_user;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_cases_org_status;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_workflows_org_user;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_workflows_org_status;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_messages_org_created;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_agent_sessions_org_status;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_audit_logs_org_created;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_agent_memory_org_agent;

\echo '✅ Dropped 8 composite indexes'

-- ============================================================================
-- SECTION 5: REMOVE ORGANIZATION_ID FROM JUNCTION TABLES
-- ============================================================================

\echo ''
\echo '⚠️  WARNING: Removing organization_id from junction tables'
\echo '    This will drop columns and associated data. Proceed with caution!'
\echo ''

-- Drop RLS policies first
DROP POLICY IF EXISTS use_case_capabilities_tenant_isolation ON public.use_case_capabilities;
DROP POLICY IF EXISTS service_role_use_case_capabilities ON public.use_case_capabilities;
DROP POLICY IF EXISTS use_case_kpis_tenant_isolation ON public.use_case_kpis;
DROP POLICY IF EXISTS service_role_use_case_kpis ON public.use_case_kpis;
DROP POLICY IF EXISTS kpi_financial_metrics_tenant_isolation ON public.kpi_financial_metrics;
DROP POLICY IF EXISTS service_role_kpi_financial_metrics ON public.kpi_financial_metrics;
DROP POLICY IF EXISTS team_members_tenant_isolation ON public.team_members;
DROP POLICY IF EXISTS service_role_team_members ON public.team_members;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_use_case_capabilities_org;
DROP INDEX IF EXISTS public.idx_use_case_kpis_org;
DROP INDEX IF EXISTS public.idx_kpi_financial_metrics_org;
DROP INDEX IF EXISTS public.idx_team_members_org;

-- Drop columns
ALTER TABLE public.use_case_capabilities DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.use_case_kpis DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.kpi_financial_metrics DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS organization_id;

-- Disable RLS on junction tables (they rely on parent table RLS)
ALTER TABLE public.use_case_capabilities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_financial_metrics DISABLE ROW LEVEL SECURITY;

\echo '✅ Removed organization_id from 4 junction tables'

-- ============================================================================
-- SECTION 6: ROLLBACK COMPLETE
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo 'ROLLBACK COMPLETE'
\echo '============================================================================'
\echo ''
\echo 'All changes have been reverted:'
\echo '  - RLS policies use original is_org_member() (slower performance)'
\echo '  - Optimized functions removed'
\echo '  - Audit triggers reverted to basic version'
\echo '  - Composite indexes dropped'
\echo '  - Junction table organization_id columns removed'
\echo ''
\echo 'Database is now in pre-migration state.'
\echo ''
\echo '============================================================================'

COMMIT;
