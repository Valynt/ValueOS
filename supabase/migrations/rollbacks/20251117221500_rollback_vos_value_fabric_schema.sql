/*
  # Rollback Migration for VOS Value Fabric Schema

  ## Purpose
  This down migration safely removes all VOS Value Fabric tables and structures
  created in migration 20251117180000_create_vos_value_fabric_schema.sql

  ## CRITICAL WARNING
  - This migration will DROP ALL VOS DATA including:
    - Business objectives, capabilities, use cases
    - Value trees, ROI models, benchmarks
    - Value commits, telemetry events, realization reports
    - Expansion models and all related data
  - Only run this in development or with confirmed backup
  - Cascade deletes will remove all dependent records

  ## Rollback Order
  1. Drop helper functions
  2. Drop junction tables (many-to-many relationships)
  3. Drop dependent tables (foreign key children)
  4. Drop parent tables
  5. Drop extensions (only if safe)

  ## Usage
  To rollback VOS schema:
  ```sql
  \i supabase/migrations/20251117221500_rollback_vos_value_fabric_schema.sql
  ```

  ## Re-apply
  To re-apply VOS schema after rollback:
  ```sql
  \i supabase/migrations/20251117180000_create_vos_value_fabric_schema.sql
  ```
*/

-- =====================================================
-- STEP 1: Drop Helper Functions
-- =====================================================

DROP FUNCTION IF EXISTS get_compliant_artifacts(text) CASCADE;

-- =====================================================
-- STEP 2: Drop EXPANSION Stage Tables (Dependent)
-- =====================================================

DROP TABLE IF EXISTS expansion_improvements CASCADE;
DROP TABLE IF EXISTS expansion_models CASCADE;

-- =====================================================
-- STEP 3: Drop REALIZATION Stage Tables (Dependent)
-- =====================================================

DROP TABLE IF EXISTS realization_results CASCADE;
DROP TABLE IF EXISTS realization_reports CASCADE;
DROP TABLE IF EXISTS telemetry_events CASCADE;

-- =====================================================
-- STEP 4: Drop TARGET Stage Tables (Dependent)
-- =====================================================

DROP TABLE IF EXISTS kpi_targets CASCADE;
DROP TABLE IF EXISTS value_commits CASCADE;
DROP TABLE IF EXISTS benchmarks CASCADE;
DROP TABLE IF EXISTS roi_model_calculations CASCADE;
DROP TABLE IF EXISTS roi_models CASCADE;
DROP TABLE IF EXISTS value_tree_links CASCADE;
DROP TABLE IF EXISTS value_tree_nodes CASCADE;
DROP TABLE IF EXISTS value_trees CASCADE;

-- =====================================================
-- STEP 5: Drop OPPORTUNITY Stage Junction Tables
-- =====================================================

DROP TABLE IF EXISTS kpi_financial_metrics CASCADE;
DROP TABLE IF EXISTS use_case_kpis CASCADE;
DROP TABLE IF EXISTS use_case_capabilities CASCADE;

-- =====================================================
-- STEP 6: Drop OPPORTUNITY Stage Tables
-- =====================================================

DROP TABLE IF EXISTS use_cases CASCADE;
DROP TABLE IF EXISTS capabilities CASCADE;
DROP TABLE IF EXISTS business_objectives CASCADE;

-- =====================================================
-- STEP 7: Drop Indexes (if any survived cascade)
-- =====================================================

-- Value Trees
DROP INDEX IF EXISTS idx_value_trees_case CASCADE;
DROP INDEX IF EXISTS idx_value_trees_use_case CASCADE;
DROP INDEX IF EXISTS idx_value_trees_compliance CASCADE;
DROP INDEX IF EXISTS idx_value_tree_nodes_tree CASCADE;
DROP INDEX IF EXISTS idx_value_tree_nodes_type CASCADE;
DROP INDEX IF EXISTS idx_value_tree_nodes_reference CASCADE;
DROP INDEX IF EXISTS idx_value_tree_links_parent CASCADE;
DROP INDEX IF EXISTS idx_value_tree_links_child CASCADE;

-- ROI Models
DROP INDEX IF EXISTS idx_roi_models_tree CASCADE;
DROP INDEX IF EXISTS idx_roi_models_financial CASCADE;
DROP INDEX IF EXISTS idx_roi_models_compliance CASCADE;
DROP INDEX IF EXISTS idx_roi_model_calculations_model CASCADE;
DROP INDEX IF EXISTS idx_roi_model_calculations_order CASCADE;

-- Benchmarks
DROP INDEX IF EXISTS idx_benchmarks_kpi_hypothesis CASCADE;
DROP INDEX IF EXISTS idx_benchmarks_kpi_name CASCADE;
DROP INDEX IF EXISTS idx_benchmarks_industry CASCADE;
DROP INDEX IF EXISTS idx_benchmarks_date CASCADE;

-- Value Commits
DROP INDEX IF EXISTS idx_value_commits_case CASCADE;
DROP INDEX IF EXISTS idx_value_commits_status CASCADE;
DROP INDEX IF EXISTS idx_value_commits_compliance CASCADE;
DROP INDEX IF EXISTS idx_kpi_targets_commit CASCADE;
DROP INDEX IF EXISTS idx_kpi_targets_hypothesis CASCADE;

-- Telemetry
DROP INDEX IF EXISTS idx_telemetry_events_case CASCADE;
DROP INDEX IF EXISTS idx_telemetry_events_kpi CASCADE;
DROP INDEX IF EXISTS idx_telemetry_events_timestamp CASCADE;

-- Realization
DROP INDEX IF EXISTS idx_realization_reports_case CASCADE;
DROP INDEX IF EXISTS idx_realization_reports_period CASCADE;
DROP INDEX IF EXISTS idx_realization_reports_compliance CASCADE;
DROP INDEX IF EXISTS idx_realization_results_report CASCADE;
DROP INDEX IF EXISTS idx_realization_results_target CASCADE;

-- Expansion
DROP INDEX IF EXISTS idx_expansion_models_case CASCADE;
DROP INDEX IF EXISTS idx_expansion_models_type CASCADE;
DROP INDEX IF EXISTS idx_expansion_models_status CASCADE;
DROP INDEX IF EXISTS idx_expansion_models_compliance CASCADE;
DROP INDEX IF EXISTS idx_expansion_improvements_model CASCADE;

-- Capabilities
DROP INDEX IF EXISTS idx_capabilities_name CASCADE;
DROP INDEX IF EXISTS idx_capabilities_category CASCADE;
DROP INDEX IF EXISTS idx_capabilities_tags CASCADE;
DROP INDEX IF EXISTS idx_capabilities_embedding CASCADE;

-- Use Cases
DROP INDEX IF EXISTS idx_use_cases_persona CASCADE;
DROP INDEX IF EXISTS idx_use_cases_industry CASCADE;
DROP INDEX IF EXISTS idx_use_cases_template CASCADE;

-- Business Objectives
DROP INDEX IF EXISTS idx_business_objectives_case CASCADE;
DROP INDEX IF EXISTS idx_business_objectives_priority CASCADE;

-- =====================================================
-- STEP 8: Note about Extensions
-- =====================================================

-- DO NOT drop extensions unless you are certain they are not used elsewhere:
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
-- DROP EXTENSION IF EXISTS "vector" CASCADE;
--
-- These extensions may be used by other parts of the application.
-- Only drop if you are rolling back the ENTIRE database.

-- =====================================================
-- Rollback Complete
-- =====================================================

-- Verify cleanup
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'business_objectives', 'capabilities', 'use_cases',
    'use_case_capabilities', 'use_case_kpis', 'kpi_financial_metrics',
    'value_trees', 'value_tree_nodes', 'value_tree_links',
    'roi_models', 'roi_model_calculations', 'benchmarks',
    'value_commits', 'kpi_targets',
    'telemetry_events', 'realization_reports', 'realization_results',
    'expansion_models', 'expansion_improvements'
  );

  IF table_count > 0 THEN
    RAISE NOTICE 'WARNING: % VOS tables still exist after rollback', table_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All VOS Value Fabric tables have been dropped';
  END IF;
END $$;
