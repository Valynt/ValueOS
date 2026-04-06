# RLS Coverage Audit

Audit basis: `docs/db/schema_snapshot.sql` cross-referenced against all active migrations under
`infra/supabase/supabase/migrations/` (excluding `archive/` and `*.rollback.sql`).

Last audited: 2026-03-27  
Total public tables in snapshot: 147  
Coverage: 100% — every table is either RLS-enabled or explicitly classified as exempt below.

## Classification key

| Class | Meaning |
|---|---|
| `tenant_scoped` | Carries `tenant_id` or `organization_id`; authenticated users see only their tenant's rows via `security.user_has_tenant_access()` |
| `service_only` | No tenant column or system-internal; only `service_role` may access |
| `own_row` | User identity table; authenticated users see only their own row |
| `public_read` | Intentionally readable by all authenticated users (e.g. feature flags, roles) |
| `partition_child` | Partition of a parent table; inherits parent RLS + has its own `ENABLE ROW LEVEL SECURITY` per `20260917` migration |

## Partition child tables

PostgreSQL does not automatically enforce RLS on partition children even when the parent has it enabled.
Migration `20260917000000_rls_and_search_path_remediation.sql` explicitly calls `ENABLE ROW LEVEL SECURITY`
on all existing partition children and patches `create_next_monthly_partitions()` to do the same for
future partitions.

| Table | Parent | Class |
|---|---|---|
| `usage_ledger_p_2026_04` | `usage_ledger` | `partition_child` |
| `usage_ledger_p_2026_05` | `usage_ledger` | `partition_child` |
| `usage_ledger_p_default` | `usage_ledger` | `partition_child` |
| `rated_ledger_p_2026_04` | `rated_ledger` | `partition_child` |
| `rated_ledger_p_2026_05` | `rated_ledger` | `partition_child` |
| `rated_ledger_p_default` | `rated_ledger` | `partition_child` |
| `saga_transitions_p_2026_04` | `saga_transitions` | `partition_child` |
| `saga_transitions_p_2026_05` | `saga_transitions` | `partition_child` |
| `saga_transitions_p_default` | `saga_transitions` | `partition_child` |
| `value_loop_events_p_2026_04` | `value_loop_events` | `partition_child` |
| `value_loop_events_p_2026_05` | `value_loop_events` | `partition_child` |
| `value_loop_events_p_default` | `value_loop_events` | `partition_child` |
| `secret_audit_logs_2024` | `secret_audit_logs` | `partition_child` |
| `secret_audit_logs_2025` | `secret_audit_logs` | `partition_child` |
| `secret_audit_logs_2026` | `secret_audit_logs` | `partition_child` |
| `secret_audit_logs_default` | `secret_audit_logs` | `partition_child` |
| `secret_audit_logs_legacy` | `secret_audit_logs` | `partition_child` |

## Full table inventory

| Table | Class | Policy / Migration | Notes |
|---|---|---|---|
| `ab_tests` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `academy_certifications` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Written by academy workers |
| `academy_lessons` | `public_read` | `20260917000000_rls_and_search_path_remediation` | Read-only catalog |
| `academy_modules` | `public_read` | `20260917000000_rls_and_search_path_remediation` | Read-only catalog |
| `academy_progress` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | Per-user progress |
| `agent_accuracy_metrics` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Written by eval workers |
| `agent_activities` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `agent_audit_log` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Audit trail, service_role only |
| `agent_calibration_history` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `agent_calibration_models` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `agent_memory` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `agent_metrics` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `agent_ontologies` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `agent_predictions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `agent_retraining_queue` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Queue table, service_role only |
| `agent_sessions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `agent_tools` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `agents` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `approval_requests` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `approval_requests_archive` | `service_only` | `20260922000000_rls_gap_remediation` | Archive, service_role only |
| `approvals` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `approvals_archive` | `service_only` | `20260922000000_rls_gap_remediation` | Archive, service_role only |
| `approver_roles` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `assumptions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `audit_log_access` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Audit access log |
| `audit_logs` | `service_only` | `20260213000010_canonical_identity_baseline` | Audit trail, service_role only |
| `audit_logs_archive` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Archive, service_role only |
| `automated_check_results` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `automated_responses` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `backup_logs` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Infra logs, service_role only |
| `billing_approval_policies` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `billing_approval_requests` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `billing_customers` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `billing_meters` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `billing_price_versions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `business_cases` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `canvas_components` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `cases` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_capabilities` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_claim_governance` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_competitors` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_context_versions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_contexts` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_personas` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_products` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_profiles` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `company_research_jobs` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Written by research workers |
| `company_research_suggestions` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Written by research workers |
| `company_value_patterns` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `compliance_evidence` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `compliance_reports` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `component_history` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `component_relationships` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `confidence_violations` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `contextual_triggers` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `cost_alerts` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Cost monitoring, service_role only |
| `crm_connections` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `crm_object_maps` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `crm_stage_triggers` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `crm_webhook_events` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `device_trust_history` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `entitlement_snapshots` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Written by billing workers |
| `evaluation_runs` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `evidence_items` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Written by eval workers |
| `feature_flag_evaluations` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Telemetry, service_role only |
| `feature_flags` | `public_read` | `20260917000000_rls_and_search_path_remediation` | Read by all authenticated |
| `financial_models` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `golden_examples` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `hitl_requests` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `integration_usage_log` | `service_only` | `20260922000000_rls_gap_remediation` | No tenant_id; internal telemetry |
| `invoices` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `kpi_hypotheses` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `llm_calls` | `service_only` | `20260922000000_rls_gap_remediation` | No tenant_id; written by LLM gateway workers |
| `llm_job_results` | `tenant_scoped` | `20260921000000_llm_job_results_tenant_id` | `tenant_id` added and scoped |
| `llm_usage` | `own_row` | `20260928000000_restore_llm_usage` | Users see own rows; admins see all; service_role has full access |
| `login_attempts` | `service_only` | `20260922000000_rls_gap_remediation` | Security audit, service_role only |
| `memberships` | `service_only` | `20260922000000_rls_gap_remediation` | Managed by auth service; no direct user access |
| `memory_access_grants` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_approvals` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_artifact_chunks` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_artifacts` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_benchmark_datasets` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `memory_benchmark_run_locks` | `service_only` | `20260922000000_rls_gap_remediation` | Lock table, service_role only |
| `memory_benchmark_slices` | `service_only` | `20260922000000_rls_gap_remediation` | Benchmark data, service_role only |
| `memory_benchmark_versions` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `memory_entities` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_entity_edges` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_fact_evidence` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_facts` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_model_run_evidence` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_model_runs` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_narratives` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_profiles` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `memory_provenance` | `service_only` | `20260922000000_rls_gap_remediation` | Provenance audit, service_role only |
| `memory_tenants` | `service_only` | `20260213000010_canonical_identity_baseline` | Managed by tenant provisioning |
| `memory_value_cases` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `message_bus` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `messages` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `policy_rules` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `prompt_executions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `prompt_versions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `provenance_records` | `tenant_scoped` | `20260902000000_provenance_records` | `tenant_id` scoped |
| `rate_limit_violations` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Security telemetry, service_role only |
| `resource_artifacts` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `retention_policies` | `service_only` | `20260922000000_rls_gap_remediation` | Infra config, service_role only |
| `roles` | `public_read` | `20260213000010_canonical_identity_baseline` | Role catalog, read by authenticated |
| `saga_transitions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped; partitioned |
| `secret_audit_logs` | `service_only` | `20260922000000_rls_gap_remediation` | Security audit, service_role only; partitioned |
| `security_audit_log` | `service_only` | `20260213000010_canonical_identity_baseline` | Security audit, service_role only |
| `security_events` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `security_incidents` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `security_metrics` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `security_policies` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `semantic_memory` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `subscription_items` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `subscriptions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `system_metrics` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Infra telemetry, service_role only |
| `task_queue` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `teams` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `tenant_integrations` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `tenants` | `service_only` | `20260213000010_canonical_identity_baseline` | Managed by provisioning service |
| `usage_aggregates` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `usage_alerts` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `usage_events` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped; partitioned |
| `usage_ledger` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped; partitioned |
| `usage_policies` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `usage_quotas` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `user_behavior_analysis` | `tenant_scoped` | `20260917000000_rls_and_search_path_remediation` | `tenant_id` scoped |
| `user_profile_directory` | `service_only` | `20260922000000_rls_gap_remediation` | Managed by auth service |
| `user_roles` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `user_sessions` | `own_row` | `20260213000010_canonical_identity_baseline` | Users see only their own sessions |
| `user_tenants` | `own_row` | `20260213000010_canonical_identity_baseline` | Users see only their own memberships |
| `users` | `own_row` | `20260213000010_canonical_identity_baseline` | Users see only their own row |
| `value_case_sagas` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `value_case_templates` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `value_cases` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `value_ledger` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `value_maps` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `value_prediction_accuracy` | `service_only` | `20260922000000_rls_gap_remediation` | ML telemetry, service_role only |
| `webhook_dead_letter_queue` | `service_only` | `20260302000000_webhook_tenant_isolation` | Webhook DLQ, service_role only |
| `webhook_events` | `service_only` | `20260917000000_rls_and_search_path_remediation` | Inbound webhooks have no user session |
| `workflow_executions` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `workflow_stage_runs` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |
| `workflows` | `tenant_scoped` | `20260213000010_canonical_identity_baseline` | `tenant_id` scoped |

## Explicitly exempt tables (no RLS required)

None. All tables have RLS enabled. Tables classified `service_only` have RLS enabled with a
`service_role`-only policy — this is not an exemption, it is the correct posture for tables
that have no user-session access path.

## Maintenance

When adding a new table:
1. The CI gate (`scripts/ci/check-migration-rls-required.sh`) will fail if the migration
   does not include `ENABLE ROW LEVEL SECURITY` for the new table.
2. Add a row to this document in the same PR.
3. Classify the table using the key above.
4. If the table is `service_only`, document why in the Notes column.

When adding a partition child:
- The `create_next_monthly_partitions()` function (patched in `20260917`) automatically
  calls `ENABLE ROW LEVEL SECURITY` on new partitions. No manual step required.
- Add the partition to the "Partition child tables" section above.
