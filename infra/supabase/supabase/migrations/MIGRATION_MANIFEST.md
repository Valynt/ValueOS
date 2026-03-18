# Migration Manifest

This document tracks the state of database migrations and explains any intentional gaps or deferred migrations.

## Migration Count Summary

| Category | Count |
|----------|-------|
| Active migrations | ~72 |
| Rollback files | ~72 (one per migration) |
| Deferred migrations | 3 |
| Archived migrations | 58 (10 + 48 in subdirs) |

## Migration Categories

### 1. Core Baseline (00000000000000)
- `00000000000000_initial_release_baseline.sql` - Initial schema baseline
- `00000000000001_initial_seed_minimal.sql` - Minimal seed data

### 2. Identity & Security (20260213-202603)
- `20260213000010_canonical_identity_baseline` - Identity system foundation
- `20260301000000_rls_service_role_audit` - RLS policy audit
- `20260303000001_harden_tenant_rls_service_role_exceptions` - RLS hardening
- `20260308000000_fix_jwt_claim_only_rls_policies` - JWT claim fixes

### 3. Billing & Ledger (20260220-202603)
- `20260220000000_billing_v2_rated_ledger` - Rated ledger v2
- `20260302100000_billing_deployment_tables` - Billing deployment
- `20260304030000_create_usage_ledger` - Usage ledger
- `20260304050000_tenant_billing_access_enforcement` - Billing access control
- `20260308010000_rated_ledger_immutability_and_rls` - Ledger immutability
- `20260910000000_billing_overrides` - Billing override support

### 4. Domain & Value (20260227-202609)
- `20260227000000_domain_packs_v1` - Domain packs v1
- `20260303000000_domain_packs_v2_layers` - Domain packs v2
- `20260303010000_value_cases_stage_and_portfolio_rpc` - Value cases RPC
- `20260317000000_value_tree_and_model_snapshots_v2` - Value tree v2
- `20260320000000_value_loop_analytics` - Value loop analytics
- `20260802000000_projects` - Project support
- `20260807000000_kpi_dependencies_entity_graph` - KPI dependencies
- `20260808000000_value_case_related_org_scope` - Value case org scope

### 5. Workflow & Execution (202603-202608)
- `20260310000000_core_workflow_tables` - Core workflows
- `20260323000000_saga_transitions` - Saga pattern
- `20260324000000_performance_indexes` - Performance indexes
- `20260806000000_workflow_states` - Workflow states

### 6. Tenant & Access (202603-202609)
- `20260304000000_tenant_provisioning_workflow` - Tenant provisioning
- `20260304010000_provision_tenant_rpc` - Provision RPC
- `20260306000000_harden_provision_tenant_function` - Hardened provisioning
- `20260307000000_refresh_provision_tenant_rpc_contracts` - RPC refresh
- `20260327000001_sync_user_tenants_to_memberships` - Membership sync
- `20260328000000_roles_slug_and_system_flag` - Roles system
- `20260911000000_user_tenants_fk_and_refresh_rpc` - User tenant FKs

### 7. Memory & Persistence (202603-202609)
- `20260321000000_back_half_tables` - Back-half tables
- `20260322000000_persistent_memory_tables` - Persistent memory
- `20260326000000_semantic_memory_stats_rpc` - Memory stats RPC
- `20260331040000_semantic_memory_embedding_model` - Embedding model
- `20260912000000_company_value_context` - Company value context
- `20260914000000_agent_execution_lineage` - Agent lineage

### 8. Audit & Compliance (202603-202608)
- `20260304020000_compliance_control_status` - Compliance controls
- `20260327000100_portfolio_rpc_access_audit` - Portfolio audit
- `20260327010100_fix_compliance_control_rls` - Compliance RLS fixes
- `20260803000000_audit_logs_archive_rls_hardening` - Audit hardening
- `20260803000000_remediate_claim_only_membership_policies` - Policy remediation
- `20260804000000_audit_artifact_permission_policies` - Artifact permissions
- `20260804000000_security_audit_worm_archive` - WORM archive
- `20260805000000_audit_write_triggers` - Audit triggers

### 9. Webhooks & Events (202603)
- `20260302000000_webhook_tenant_isolation` - Webhook isolation
- `20260304040000_tenant_execution_state` - Execution state
- `20260304060000_usage_events_evidence_constraints` - Usage events
- `20260401000000_security_anomaly_alerts` - Security alerts
- `20260804000000_state_events` - State events

### 10. Performance & Partitioning (202604-202608)
- `20260401000000_partition_high_volume_tables` - Table partitioning
- `20260331020000_promote_deferred_indexes` - Deferred indexes
- `20260327020000_fix_performance_index_violations` - Index violations
- `20260801000000_pg_cron_partition_scheduler` - Partition scheduler

### 11. Deferred Migrations (`_deferred/`)
These migrations are intentionally deferred for post-launch:
- Future feature migrations not required for v1 launch
- Complex schema changes requiring coordination

### 12. Archived Migrations (`_archived_monolith_20260213/`)
Historical migrations from the monolith period. Preserved for reference but not applied to current schema.

## Validation

Run migration hygiene check:
```bash
node scripts/ci/check-migration-hygiene.mjs
```

Check for pending migrations:
```bash
supabase migration list --local
```

## Rollback Policy

Every migration has a corresponding `.rollback.sql` file. In emergency:
```bash
# Rollback specific migration
psql $DATABASE_URL -f <migration>.rollback.sql

# Or use Supabase CLI
supabase db reset
```

---
**Last Updated**: 2026-03-18  
**Validated**: ✅ All migrations have valid timestamps and rollback files
