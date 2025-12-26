-- Add Missing tenant_id Columns
-- This migration adds tenant_id columns to tables that need them
-- Must run BEFORE 20251213000000_fix_rls_tenant_isolation.sql
-- Created: 2025-12-26

-- ============================================================================
-- Add tenant_id columns to tables that are missing them
-- ============================================================================

-- Check and add tenant_id to agent_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'agent_sessions' 
    AND column_name = 'tenant_id'
  ) THEN
    -- Check if table exists first
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'agent_sessions'
    ) THEN
      ALTER TABLE agent_sessions ADD COLUMN tenant_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant ON agent_sessions(tenant_id);
      RAISE NOTICE 'Added tenant_id column to agent_sessions';
    ELSE
      RAISE NOTICE 'Table agent_sessions does not exist - skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Column agent_sessions.tenant_id already exists';
  END IF;
END $$;

-- Check and add tenant_id to agent_predictions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'agent_predictions' 
    AND column_name = 'tenant_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'agent_predictions'
    ) THEN
      ALTER TABLE agent_predictions ADD COLUMN tenant_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_agent_predictions_tenant_id ON agent_predictions(tenant_id);
      RAISE NOTICE 'Added tenant_id column to agent_predictions';
    ELSE
      RAISE NOTICE 'Table agent_predictions does not exist - skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Column agent_predictions.tenant_id already exists';
  END IF;
END $$;

-- Check and add tenant_id to workflow_executions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'workflow_executions' 
    AND column_name = 'tenant_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'workflow_executions'
    ) THEN
      ALTER TABLE workflow_executions ADD COLUMN tenant_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id);
      RAISE NOTICE 'Added tenant_id column to workflow_executions';
    ELSE
      RAISE NOTICE 'Table workflow_executions does not exist - skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Column workflow_executions.tenant_id already exists';
  END IF;
END $$;

-- Check and add tenant_id to canvas_data if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'canvas_data' 
    AND column_name = 'tenant_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'canvas_data'
    ) THEN
      ALTER TABLE canvas_data ADD COLUMN tenant_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_canvas_data_tenant ON canvas_data(tenant_id);
      RAISE NOTICE 'Added tenant_id column to canvas_data';
    ELSE
      RAISE NOTICE 'Table canvas_data does not exist - skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Column canvas_data.tenant_id already exists';
  END IF;
END $$;

-- Check and add tenant_id to value_trees if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'value_trees' 
    AND column_name = 'tenant_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'value_trees'
    ) THEN
      ALTER TABLE value_trees ADD COLUMN tenant_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_value_trees_tenant ON value_trees(tenant_id);
      RAISE NOTICE 'Added tenant_id column to value_trees';
    ELSE
      RAISE NOTICE 'Table value_trees does not exist - skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Column value_trees.tenant_id already exists';
  END IF;
END $$;

-- ============================================================================
-- Add foreign key constraints to tenants table
-- ============================================================================

-- Add FK constraints if tables exist and have tenant_id
DO $$
DECLARE
  tbl_name TEXT;
BEGIN
  FOR tbl_name IN 
    SELECT t FROM unnest(ARRAY[
      'agent_sessions',
      'agent_predictions', 
      'workflow_executions',
      'canvas_data',
      'value_trees'
    ]) AS t
  LOOP
    -- Check if both table and column exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      AND c.table_name = tbl_name
      AND c.column_name = 'tenant_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      AND t.table_name = 'tenants'
    ) THEN
      -- Add FK constraint if it doesn't exist
      BEGIN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT fk_%I_tenant 
           FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
          tbl_name, tbl_name
        );
        RAISE NOTICE 'Added FK constraint to %.tenant_id', tbl_name;
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'FK constraint already exists on %.tenant_id', tbl_name;
        WHEN foreign_key_violation THEN
          RAISE WARNING 'Cannot add FK constraint to %.tenant_id - data integrity issue', tbl_name;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
DECLARE
  tables_with_tenant_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_with_tenant_id
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND column_name = 'tenant_id'
  AND table_name IN (
    'agent_sessions',
    'agent_predictions',
    'workflow_executions',
    'canvas_data',
    'value_trees'
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tenant Column Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables with tenant_id column: %', tables_with_tenant_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Apply RLS policies with migration 20251213000000';
  RAISE NOTICE '';
END $$;
