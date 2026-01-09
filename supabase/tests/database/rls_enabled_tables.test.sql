-- tests/database/rls_enabled_tables.test.sql
-- Verify RLS is enabled with policies on all tenant-scoped tables.

BEGIN;
SELECT plan(93);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ab_tests'
  ), false),
  'RLS enabled with policies on public.ab_tests'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'academy_certifications'
  ), false),
  'RLS enabled with policies on public.academy_certifications'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'academy_lessons'
  ), false),
  'RLS enabled with policies on public.academy_lessons'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'academy_modules'
  ), false),
  'RLS enabled with policies on public.academy_modules'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'academy_progress'
  ), false),
  'RLS enabled with policies on public.academy_progress'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_accuracy_metrics'
  ), false),
  'RLS enabled with policies on public.agent_accuracy_metrics'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_activities'
  ), false),
  'RLS enabled with policies on public.agent_activities'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_audit_log'
  ), false),
  'RLS enabled with policies on public.agent_audit_log'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_memory'
  ), false),
  'RLS enabled with policies on public.agent_memory'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_metrics'
  ), false),
  'RLS enabled with policies on public.agent_metrics'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_ontologies'
  ), false),
  'RLS enabled with policies on public.agent_ontologies'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_predictions'
  ), false),
  'RLS enabled with policies on public.agent_predictions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_retraining_queue'
  ), false),
  'RLS enabled with policies on public.agent_retraining_queue'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agents'
  ), false),
  'RLS enabled with policies on public.agents'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_sessions'
  ), false),
  'RLS enabled with policies on public.agent_sessions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'agent_tools'
  ), false),
  'RLS enabled with policies on public.agent_tools'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'approval_requests'
  ), false),
  'RLS enabled with policies on public.approval_requests'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'approvals'
  ), false),
  'RLS enabled with policies on public.approvals'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'approver_roles'
  ), false),
  'RLS enabled with policies on public.approver_roles'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'assumptions'
  ), false),
  'RLS enabled with policies on public.assumptions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_log_access'
  ), false),
  'RLS enabled with policies on public.audit_log_access'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs'
  ), false),
  'RLS enabled with policies on public.audit_logs'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs_archive'
  ), false),
  'RLS enabled with policies on public.audit_logs_archive'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'automated_check_results'
  ), false),
  'RLS enabled with policies on public.automated_check_results'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'automated_responses'
  ), false),
  'RLS enabled with policies on public.automated_responses'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'backup_logs'
  ), false),
  'RLS enabled with policies on public.backup_logs'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'billing_customers'
  ), false),
  'RLS enabled with policies on public.billing_customers'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'business_cases'
  ), false),
  'RLS enabled with policies on public.business_cases'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'canvas_components'
  ), false),
  'RLS enabled with policies on public.canvas_components'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'company_profiles'
  ), false),
  'RLS enabled with policies on public.company_profiles'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'compensation_queue'
  ), false),
  'RLS enabled with policies on public.compensation_queue'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'compliance_evidence'
  ), false),
  'RLS enabled with policies on public.compliance_evidence'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'compliance_reports'
  ), false),
  'RLS enabled with policies on public.compliance_reports'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'component_history'
  ), false),
  'RLS enabled with policies on public.component_history'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'component_relationships'
  ), false),
  'RLS enabled with policies on public.component_relationships'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'confidence_violations'
  ), false),
  'RLS enabled with policies on public.confidence_violations'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'contextual_triggers'
  ), false),
  'RLS enabled with policies on public.contextual_triggers'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'cost_alerts'
  ), false),
  'RLS enabled with policies on public.cost_alerts'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'device_trust_history'
  ), false),
  'RLS enabled with policies on public.device_trust_history'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evaluation_runs'
  ), false),
  'RLS enabled with policies on public.evaluation_runs'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'expansion_results'
  ), false),
  'RLS enabled with policies on public.expansion_results'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'feature_flag_evaluations'
  ), false),
  'RLS enabled with policies on public.feature_flag_evaluations'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'feature_flags'
  ), false),
  'RLS enabled with policies on public.feature_flags'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'feedback_loops'
  ), false),
  'RLS enabled with policies on public.feedback_loops'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'financial_models'
  ), false),
  'RLS enabled with policies on public.financial_models'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'golden_examples'
  ), false),
  'RLS enabled with policies on public.golden_examples'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'integrity_results'
  ), false),
  'RLS enabled with policies on public.integrity_results'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'invoices'
  ), false),
  'RLS enabled with policies on public.invoices'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'kpi_hypotheses'
  ), false),
  'RLS enabled with policies on public.kpi_hypotheses'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'llm_calls'
  ), false),
  'RLS enabled with policies on public.llm_calls'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'llm_job_results'
  ), false),
  'RLS enabled with policies on public.llm_job_results'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'llm_usage'
  ), false),
  'RLS enabled with policies on public.llm_usage'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'message_bus'
  ), false),
  'RLS enabled with policies on public.message_bus'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'opportunity_results'
  ), false),
  'RLS enabled with policies on public.opportunity_results'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'policy_rules'
  ), false),
  'RLS enabled with policies on public.policy_rules'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'prompt_executions'
  ), false),
  'RLS enabled with policies on public.prompt_executions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'prompt_versions'
  ), false),
  'RLS enabled with policies on public.prompt_versions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'rate_limit_violations'
  ), false),
  'RLS enabled with policies on public.rate_limit_violations'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'realization_results'
  ), false),
  'RLS enabled with policies on public.realization_results'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'resource_artifacts'
  ), false),
  'RLS enabled with policies on public.resource_artifacts'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'roles'
  ), false),
  'RLS enabled with policies on public.roles'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'secret_audit_logs'
  ), false),
  'RLS enabled with policies on public.secret_audit_logs'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'security_audit_log'
  ), false),
  'RLS enabled with policies on public.security_audit_log'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'security_events'
  ), false),
  'RLS enabled with policies on public.security_events'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'security_incidents'
  ), false),
  'RLS enabled with policies on public.security_incidents'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'security_metrics'
  ), false),
  'RLS enabled with policies on public.security_metrics'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'security_policies'
  ), false),
  'RLS enabled with policies on public.security_policies'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'semantic_memory'
  ), false),
  'RLS enabled with policies on public.semantic_memory'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'subscription_items'
  ), false),
  'RLS enabled with policies on public.subscription_items'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'subscriptions'
  ), false),
  'RLS enabled with policies on public.subscriptions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'system_metrics'
  ), false),
  'RLS enabled with policies on public.system_metrics'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'target_results'
  ), false),
  'RLS enabled with policies on public.target_results'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'task_queue'
  ), false),
  'RLS enabled with policies on public.task_queue'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tenant_integrations'
  ), false),
  'RLS enabled with policies on public.tenant_integrations'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tenants'
  ), false),
  'RLS enabled with policies on public.tenants'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'usage_aggregates'
  ), false),
  'RLS enabled with policies on public.usage_aggregates'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'usage_alerts'
  ), false),
  'RLS enabled with policies on public.usage_alerts'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'usage_events'
  ), false),
  'RLS enabled with policies on public.usage_events'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'usage_quotas'
  ), false),
  'RLS enabled with policies on public.usage_quotas'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_behavior_analysis'
  ), false),
  'RLS enabled with policies on public.user_behavior_analysis'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_roles'
  ), false),
  'RLS enabled with policies on public.user_roles'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_sessions'
  ), false),
  'RLS enabled with policies on public.user_sessions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_tenants'
  ), false),
  'RLS enabled with policies on public.user_tenants'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'value_cases'
  ), false),
  'RLS enabled with policies on public.value_cases'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'value_ledger'
  ), false),
  'RLS enabled with policies on public.value_ledger'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'value_maps'
  ), false),
  'RLS enabled with policies on public.value_maps'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'value_prediction_accuracy'
  ), false),
  'RLS enabled with policies on public.value_prediction_accuracy'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'value_tree_links'
  ), false),
  'RLS enabled with policies on public.value_tree_links'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'value_tree_nodes'
  ), false),
  'RLS enabled with policies on public.value_tree_nodes'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'value_trees'
  ), false),
  'RLS enabled with policies on public.value_trees'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'workflow_executions'
  ), false),
  'RLS enabled with policies on public.workflow_executions'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'workflows'
  ), false),
  'RLS enabled with policies on public.workflows'
);

SELECT ok(
  COALESCE((
    SELECT c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname
        AND p.tablename = c.relname
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'workflow_states'
  ), false),
  'RLS enabled with policies on public.workflow_states'
);

SELECT * FROM finish();
ROLLBACK;