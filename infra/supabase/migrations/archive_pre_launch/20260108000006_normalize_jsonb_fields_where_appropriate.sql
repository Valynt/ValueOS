-- Normalize JSONB fields where appropriate and add proper constraints
-- This improves data consistency, query performance, and type safety

BEGIN;

-- Normalize agent_sessions.metadata JSONB field with proper structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_sessions'
               AND column_name = 'metadata'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for metadata JSONB structure
        ALTER TABLE public.agent_sessions ADD CONSTRAINT chk_agent_sessions_metadata_structure
        CHECK (
            metadata IS NULL OR
            jsonb_typeof(metadata) = 'object' AND
            (metadata ? 'agent_type') AND
            (metadata ? 'workflow_type')
        );

        -- Create index on metadata fields for common queries
        CREATE INDEX IF NOT EXISTS idx_agent_sessions_metadata_agent_type ON public.agent_sessions USING gin ((metadata->>'agent_type'));
        CREATE INDEX IF NOT EXISTS idx_agent_sessions_metadata_workflow_type ON public.agent_sessions USING gin ((metadata->>'workflow_type'));
    END IF;
END $$;

-- Normalize workflow_executions.input_params JSONB field
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'input_params'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for input_params JSONB structure
        ALTER TABLE public.workflow_executions ADD CONSTRAINT chk_workflow_executions_input_params_structure
        CHECK (
            input_params IS NULL OR
            jsonb_typeof(input_params) = 'object'
        );
    END IF;
END $$;

-- Normalize workflow_executions.output_data JSONB field
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'output_data'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for output_data JSONB structure
        ALTER TABLE public.workflow_executions ADD CONSTRAINT chk_workflow_executions_output_data_structure
        CHECK (
            output_data IS NULL OR
            jsonb_typeof(output_data) = 'object'
        );
    END IF;
END $$;

-- Normalize agent_memory.metadata JSONB field
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_memory'
               AND column_name = 'metadata'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for metadata JSONB structure
        ALTER TABLE public.agent_memory ADD CONSTRAINT chk_agent_memory_metadata_structure
        CHECK (
            metadata IS NULL OR
            jsonb_typeof(metadata) = 'object'
        );

        -- Create index on metadata for common memory queries
        CREATE INDEX IF NOT EXISTS idx_agent_memory_metadata_memory_type ON public.agent_memory USING gin ((metadata->>'memory_type'));
        CREATE INDEX IF NOT EXISTS idx_agent_memory_metadata_source ON public.agent_memory USING gin ((metadata->>'source'));
    END IF;
END $$;

-- Normalize organizations.settings JSONB field
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'organizations'
               AND column_name = 'settings'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for settings JSONB structure
        ALTER TABLE public.organizations ADD CONSTRAINT chk_organizations_settings_structure
        CHECK (
            settings IS NULL OR
            jsonb_typeof(settings) = 'object'
        );
    END IF;
END $$;

-- Normalize users.preferences JSONB field
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users'
               AND column_name = 'preferences'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for preferences JSONB structure
        ALTER TABLE public.users ADD CONSTRAINT chk_users_preferences_structure
        CHECK (
            preferences IS NULL OR
            jsonb_typeof(preferences) = 'object'
        );
    END IF;
END $$;

-- Normalize agent_performance_summary.metadata JSONB field
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_performance_summary'
               AND column_name = 'metadata'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for metadata JSONB structure
        ALTER TABLE public.agent_performance_summary ADD CONSTRAINT chk_agent_performance_metadata_structure
        CHECK (
            metadata IS NULL OR
            jsonb_typeof(metadata) = 'object'
        );
    END IF;
END $$;

-- Normalize integration_configs.config JSONB field
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'integration_configs'
               AND column_name = 'config'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for config JSONB structure
        ALTER TABLE public.integration_configs ADD CONSTRAINT chk_integration_configs_config_structure
        CHECK (
            config IS NULL OR
            jsonb_typeof(config) = 'object'
        );
    END IF;
END $$;

-- Normalize value_cases.business_case JSONB field with proper structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'value_cases'
               AND column_name = 'business_case'
               AND table_schema = 'public') THEN

        -- Add CHECK constraint for business_case JSONB structure
        ALTER TABLE public.value_cases ADD CONSTRAINT chk_value_cases_business_case_structure
        CHECK (
            business_case IS NULL OR
            jsonb_typeof(business_case) = 'object' AND
            (business_case ? 'problem_statement') AND
            (business_case ? 'proposed_solution') AND
            (business_case ? 'expected_outcomes')
        );

        -- Create index on business case fields
        CREATE INDEX IF NOT EXISTS idx_value_cases_business_case_problem ON public.value_cases USING gin ((business_case->>'problem_statement'));
        CREATE INDEX IF NOT EXISTS idx_value_cases_business_case_solution ON public.value_cases USING gin ((business_case->>'proposed_solution'));
    END IF;
END $$;

-- Clean up any invalid JSONB data that might exist
UPDATE public.agent_sessions SET metadata = '{}' WHERE metadata IS NULL OR jsonb_typeof(metadata) != 'object';
UPDATE public.workflow_executions SET input_params = '{}' WHERE input_params IS NULL OR jsonb_typeof(input_params) != 'object';
UPDATE public.workflow_executions SET output_data = '{}' WHERE output_data IS NULL OR jsonb_typeof(output_data) != 'object';
UPDATE public.agent_memory SET metadata = '{}' WHERE metadata IS NULL OR jsonb_typeof(metadata) != 'object';
UPDATE public.organizations SET settings = '{}' WHERE settings IS NULL OR jsonb_typeof(settings) != 'object';
UPDATE public.users SET preferences = '{}' WHERE preferences IS NULL OR jsonb_typeof(preferences) != 'object';
UPDATE public.agent_performance_summary SET metadata = '{}' WHERE metadata IS NULL OR jsonb_typeof(metadata) != 'object';
UPDATE public.integration_configs SET config = '{}' WHERE config IS NULL OR jsonb_typeof(config) != 'object';

COMMIT;