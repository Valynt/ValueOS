-- Add NOT NULL constraints and defaults to boolean fields
-- This fixes critical data integrity issues for boolean fields across multiple tables

BEGIN;

-- Fix agent_sessions table boolean fields
ALTER TABLE public.agent_sessions
ALTER COLUMN is_active SET DEFAULT true,
ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE public.agent_sessions
ALTER COLUMN is_completed SET DEFAULT false,
ALTER COLUMN is_completed SET NOT NULL;

-- Fix workflow_executions table boolean fields
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'is_success'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions
        ALTER COLUMN is_success SET DEFAULT false,
        ALTER COLUMN is_success SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'is_completed'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions
        ALTER COLUMN is_completed SET DEFAULT false,
        ALTER COLUMN is_completed SET NOT NULL;
    END IF;
END $$;

-- Fix organizations table boolean fields
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'organizations'
               AND column_name = 'is_active'
               AND table_schema = 'public') THEN
        ALTER TABLE public.organizations
        ALTER COLUMN is_active SET DEFAULT true,
        ALTER COLUMN is_active SET NOT NULL;
    END IF;
END $$;

-- Fix users table boolean fields
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users'
               AND column_name = 'is_active'
               AND table_schema = 'public') THEN
        ALTER TABLE public.users
        ALTER COLUMN is_active SET DEFAULT true,
        ALTER COLUMN is_active SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users'
               AND column_name = 'email_verified'
               AND table_schema = 'public') THEN
        ALTER TABLE public.users
        ALTER COLUMN email_verified SET DEFAULT false,
        ALTER COLUMN email_verified SET NOT NULL;
    END IF;
END $$;

-- Fix agent_performance_summary table boolean fields
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_performance_summary'
               AND column_name = 'is_success'
               AND table_schema = 'public') THEN
        ALTER TABLE public.agent_performance_summary
        ALTER COLUMN is_success SET DEFAULT false,
        ALTER COLUMN is_success SET NOT NULL;
    END IF;
END $$;

-- Fix llm_gating table boolean fields
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'llm_gating'
               AND column_name = 'is_enabled'
               AND table_schema = 'public') THEN
        ALTER TABLE public.llm_gating
        ALTER COLUMN is_enabled SET DEFAULT true,
        ALTER COLUMN is_enabled SET NOT NULL;
    END IF;
END $$;

-- Fix progressive_rollouts table boolean fields
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'progressive_rollouts'
               AND column_name = 'is_active'
               AND table_schema = 'public') THEN
        ALTER TABLE public.progressive_rollouts
        ALTER COLUMN is_active SET DEFAULT true,
        ALTER COLUMN is_active SET NOT NULL;
    END IF;
END $$;

-- Fix feature_flags table boolean fields
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'feature_flags'
               AND column_name = 'is_enabled'
               AND table_schema = 'public') THEN
        ALTER TABLE public.feature_flags
        ALTER COLUMN is_enabled SET DEFAULT false,
        ALTER COLUMN is_enabled SET NOT NULL;
    END IF;
END $$;

-- Populate existing NULL values with defaults
UPDATE public.agent_sessions SET is_active = true WHERE is_active IS NULL;
UPDATE public.agent_sessions SET is_completed = false WHERE is_completed IS NULL;
UPDATE public.workflow_executions SET is_success = false WHERE is_success IS NULL AND is_success IS NOT NULL;
UPDATE public.workflow_executions SET is_completed = false WHERE is_completed IS NULL AND is_completed IS NOT NULL;
UPDATE public.organizations SET is_active = true WHERE is_active IS NULL;
UPDATE public.users SET is_active = true WHERE is_active IS NULL;
UPDATE public.users SET email_verified = false WHERE email_verified IS NULL;
UPDATE public.agent_performance_summary SET is_success = false WHERE is_success IS NULL;
UPDATE public.llm_gating SET is_enabled = true WHERE is_enabled IS NULL;
UPDATE public.progressive_rollouts SET is_active = true WHERE is_active IS NULL;
UPDATE public.feature_flags SET is_enabled = false WHERE is_enabled IS NULL;

COMMIT;