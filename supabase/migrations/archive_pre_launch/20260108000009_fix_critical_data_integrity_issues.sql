-- Fix critical data integrity issues from database migration review
-- Addresses missing foreign key constraints and data validation

BEGIN;

-- ============================================
-- CRITICAL: Fix missing foreign key constraints
-- ============================================

-- Add missing foreign key constraint from value_cases to workflow_executions
-- This ensures that value cases are properly linked to their workflow executions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'value_cases'
               AND column_name = 'workflow_execution_id'
               AND table_schema = 'public') THEN
        ALTER TABLE public.value_cases
        ADD CONSTRAINT fk_value_cases_workflow_execution_id
        FOREIGN KEY (workflow_execution_id) REFERENCES public.workflow_executions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add missing foreign key constraint from workflow_executions to value_cases
-- This creates a bidirectional relationship for better data integrity
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'value_case_id'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions
        ADD CONSTRAINT fk_workflow_executions_value_case_id
        FOREIGN KEY (value_case_id) REFERENCES public.value_cases(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- HIGH PRIORITY: Add missing NOT NULL constraints
-- ============================================

-- Add NOT NULL constraints for critical fields that should never be null
DO $$
BEGIN
    -- Ensure organizations.name is NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'organizations'
               AND column_name = 'name'
               AND is_nullable = 'YES') THEN
        ALTER TABLE public.organizations ALTER COLUMN name SET NOT NULL;
    END IF;

    -- Ensure users.email is NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users'
               AND column_name = 'email'
               AND is_nullable = 'YES') THEN
        ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;
    END IF;

    -- Ensure agent_sessions.user_id is NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_sessions'
               AND column_name = 'user_id'
               AND is_nullable = 'YES') THEN
        ALTER TABLE public.agent_sessions ALTER COLUMN user_id SET NOT NULL;
    END IF;

    -- Ensure agents.name is NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agents'
               AND column_name = 'name'
               AND is_nullable = 'YES') THEN
        ALTER TABLE public.agents ALTER COLUMN name SET NOT NULL;
    END IF;

    -- Ensure value_cases.session_id is NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'value_cases'
               AND column_name = 'session_id'
               AND is_nullable = 'YES') THEN
        ALTER TABLE public.value_cases ALTER COLUMN session_id SET NOT NULL;
    END IF;
END $$;

-- ============================================
-- HIGH PRIORITY: Add missing CHECK constraints
-- ============================================

-- Add CHECK constraint for users.role with correct values
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users'
               AND column_name = 'role'
               AND table_schema = 'public') THEN
        -- Drop existing constraint if it exists with wrong values
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_name = 'users' AND constraint_name = 'chk_users_role') THEN
            ALTER TABLE public.users DROP CONSTRAINT chk_users_role;
        END IF;
        -- Add correct constraint
        ALTER TABLE public.users ADD CONSTRAINT chk_users_role
        CHECK (role IN ('member', 'manager', 'admin'));
    END IF;
END $$;

-- Add CHECK constraint for organizations.tier with correct values
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'organizations'
               AND column_name = 'tier'
               AND table_schema = 'public') THEN
        -- Drop existing constraint if it exists with wrong values
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_name = 'organizations' AND constraint_name = 'chk_organizations_tier') THEN
            ALTER TABLE public.organizations DROP CONSTRAINT chk_organizations_tier;
        END IF;
        -- Add correct constraint
        ALTER TABLE public.organizations ADD CONSTRAINT chk_organizations_tier
        CHECK (tier IN ('free', 'pro', 'enterprise'));
    END IF;
END $$;

-- Add CHECK constraint for agent_memory.memory_type with correct values
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_memory'
               AND column_name = 'memory_type'
               AND table_schema = 'public') THEN
        -- Drop existing constraint if it exists with wrong values
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_name = 'agent_memory' AND constraint_name = 'chk_agent_memory_memory_type') THEN
            ALTER TABLE public.agent_memory DROP CONSTRAINT chk_agent_memory_memory_type;
        END IF;
        -- Add correct constraint
        ALTER TABLE public.agent_memory ADD CONSTRAINT chk_agent_memory_memory_type
        CHECK (memory_type IN ('episodic', 'semantic', 'procedural'));
    END IF;
END $$;

COMMIT;