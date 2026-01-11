-- Standardize index naming conventions for better maintainability
-- Rename indexes to follow idx_{table}_{column1}_{column2} pattern

BEGIN;

-- ============================================
-- MEDIUM PRIORITY: Standardize index naming
-- ============================================

-- Rename audit_logs indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_org_time') THEN
        ALTER INDEX idx_audit_org_time RENAME TO idx_audit_logs_organization_id_created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_resource') THEN
        ALTER INDEX idx_audit_resource RENAME TO idx_audit_logs_organization_id_resource_type_resource_id;
    END IF;
END $$;

-- Rename agent indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_agent_org_type') THEN
        ALTER INDEX idx_agent_org_type RENAME TO idx_agents_organization_id_agent_type;
    END IF;
END $$;

-- Rename agent_runs indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_run_org_agent') THEN
        ALTER INDEX idx_run_org_agent RENAME TO idx_agent_runs_organization_id_agent_id_created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_run_user') THEN
        ALTER INDEX idx_run_user RENAME TO idx_agent_runs_organization_id_user_id_created_at;
    END IF;
END $$;

-- Rename agent_memory indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memory_org_agent') THEN
        ALTER INDEX idx_memory_org_agent RENAME TO idx_agent_memory_organization_id_agent_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memory_embedding') THEN
        ALTER INDEX idx_memory_embedding RENAME TO idx_agent_memory_embedding;
    END IF;
END $$;

-- Rename models indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_model_org_status') THEN
        ALTER INDEX idx_model_org_status RENAME TO idx_models_organization_id_status_created_at;
    END IF;
END $$;

-- Rename kpis indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kpi_model') THEN
        ALTER INDEX idx_kpi_model RENAME TO idx_kpis_organization_id_model_id_category;
    END IF;
END $$;

-- Rename cases indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cases_org_status') THEN
        ALTER INDEX idx_cases_org_status RENAME TO idx_cases_organization_id_status_created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cases_user') THEN
        ALTER INDEX idx_cases_user RENAME TO idx_cases_organization_id_user_id_created_at;
    END IF;
END $$;

-- Rename workflows indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workflows_org_active') THEN
        ALTER INDEX idx_workflows_org_active RENAME TO idx_workflows_organization_id_is_active_created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workflows_name_version') THEN
        ALTER INDEX idx_workflows_name_version RENAME TO idx_workflows_organization_id_name_version;
    END IF;
END $$;

-- Rename workflow_states indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workflow_states_org_status') THEN
        ALTER INDEX idx_workflow_states_org_status RENAME TO idx_workflow_states_organization_id_status_started_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workflow_states_workflow') THEN
        ALTER INDEX idx_workflow_states_workflow RENAME TO idx_workflow_states_organization_id_workflow_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workflow_states_case') THEN
        ALTER INDEX idx_workflow_states_case RENAME TO idx_workflow_states_organization_id_case_id;
    END IF;
END $$;

-- Rename shared_artifacts indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shared_artifacts_org_type') THEN
        ALTER INDEX idx_shared_artifacts_org_type RENAME TO idx_shared_artifacts_organization_id_artifact_type_created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shared_artifacts_case') THEN
        ALTER INDEX idx_shared_artifacts_case RENAME TO idx_shared_artifacts_organization_id_case_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shared_artifacts_creator') THEN
        ALTER INDEX idx_shared_artifacts_creator RENAME TO idx_shared_artifacts_organization_id_created_by_created_at;
    END IF;
END $$;

-- Rename organizations indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orgs_id') THEN
        ALTER INDEX idx_orgs_id RENAME TO idx_organizations_id;
    END IF;
END $$;

-- Rename audit_logs indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_org') THEN
        ALTER INDEX idx_audit_org RENAME TO idx_audit_logs_organization_id;
    END IF;
END $$;

-- Rename users indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_org_email') THEN
        ALTER INDEX idx_users_org_email RENAME TO idx_users_organization_id_email;
    END IF;
END $$;

-- Rename agents indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_agents_org_active') THEN
        ALTER INDEX idx_agents_org_active RENAME TO idx_agents_organization_id_is_active;
    END IF;
END $$;

-- Rename agent_performance_summary indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_agent_performance_tenant_created') THEN
        ALTER INDEX idx_agent_performance_tenant_created RENAME TO idx_agent_performance_summary_tenant_id_created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_agent_performance_agent_success') THEN
        ALTER INDEX idx_agent_performance_agent_success RENAME TO idx_agent_performance_summary_agent_id_is_success_created_at;
    END IF;
END $$;

-- Rename llm_gating indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_llm_gating_tenant_enabled') THEN
        ALTER INDEX idx_llm_gating_tenant_enabled RENAME TO idx_llm_gating_tenant_id_is_enabled;
    END IF;
END $$;

-- Rename progressive_rollouts indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_progressive_rollouts_tenant_active') THEN
        ALTER INDEX idx_progressive_rollouts_tenant_active RENAME TO idx_progressive_rollouts_tenant_id_is_active;
    END IF;
END $$;

-- Rename feature_flags indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_feature_flags_name_enabled') THEN
        ALTER INDEX idx_feature_flags_name_enabled RENAME TO idx_feature_flags_name_is_enabled;
    END IF;
END $$;

-- Rename value_cases indexes (recently added)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_value_cases_tenant_id_session_id') THEN
        ALTER INDEX idx_value_cases_tenant_id_session_id RENAME TO idx_value_cases_tenant_id_session_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_value_cases_created_at') THEN
        ALTER INDEX idx_value_cases_created_at RENAME TO idx_value_cases_created_at;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_value_cases_status') THEN
        ALTER INDEX idx_value_cases_status RENAME TO idx_value_cases_status;
    END IF;
END $$;

COMMIT;