-- Add missing CHECK constraints for data validation
-- This ensures data integrity and prevents invalid data from being inserted

BEGIN;

-- Add CHECK constraints for agent_sessions table
ALTER TABLE public.agent_sessions ADD CONSTRAINT chk_agent_sessions_status
CHECK (status IN ('pending', 'active', 'completed', 'failed', 'cancelled'));

ALTER TABLE public.agent_sessions ADD CONSTRAINT chk_agent_sessions_created_at_not_future
CHECK (created_at <= NOW());

ALTER TABLE public.agent_sessions ADD CONSTRAINT chk_agent_sessions_updated_at_not_before_created
CHECK (updated_at >= created_at);

-- Add CHECK constraints for workflow_executions table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'status'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions ADD CONSTRAINT chk_workflow_executions_status
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'priority'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions ADD CONSTRAINT chk_workflow_executions_priority
        CHECK (priority >= 0 AND priority <= 10);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'progress'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions ADD CONSTRAINT chk_workflow_executions_progress
        CHECK (progress >= 0.0 AND progress <= 100.0);
    END IF;
END $$;

-- Add CHECK constraints for organizations table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'organizations'
               AND column_name = 'tier'
               AND table_schema = 'public') THEN
        ALTER TABLE public.organizations ADD CONSTRAINT chk_organizations_tier
        CHECK (tier IN ('free', 'professional', 'enterprise', 'custom'));
    END IF;
END $$;

-- Add CHECK constraints for users table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users'
               AND column_name = 'role'
               AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD CONSTRAINT chk_users_role
        CHECK (role IN ('user', 'admin', 'super_admin'));
    END IF;
END $$;

-- Add CHECK constraints for agent_memory table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_memory'
               AND column_name = 'memory_type'
               AND table_schema = 'public') THEN
        ALTER TABLE public.agent_memory ADD CONSTRAINT chk_agent_memory_memory_type
        CHECK (memory_type IN ('short_term', 'long_term', 'shared', 'domain', 'conversation', 'factual', 'procedural'));
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_memory'
               AND column_name = 'confidence'
               AND table_schema = 'public') THEN
        ALTER TABLE public.agent_memory ADD CONSTRAINT chk_agent_memory_confidence
        CHECK (confidence >= 0.0 AND confidence <= 1.0);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_memory'
               AND column_name = 'importance'
               AND table_schema = 'public') THEN
        ALTER TABLE public.agent_memory ADD CONSTRAINT chk_agent_memory_importance
        CHECK (importance >= 0.0 AND importance <= 1.0);
    END IF;
END $$;

-- Add CHECK constraints for agent_performance_summary table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_performance_summary'
               AND column_name = 'accuracy_score'
               AND table_schema = 'public') THEN
        ALTER TABLE public.agent_performance_summary ADD CONSTRAINT chk_agent_performance_accuracy_score
        CHECK (accuracy_score >= 0.0 AND accuracy_score <= 1.0);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'agent_performance_summary'
               AND column_name = 'response_time_ms'
               AND table_schema = 'public') THEN
        ALTER TABLE public.agent_performance_summary ADD CONSTRAINT chk_agent_performance_response_time_positive
        CHECK (response_time_ms > 0);
    END IF;
END $$;

-- Add CHECK constraints for llm_gating table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'llm_gating'
               AND column_name = 'max_tokens_per_request'
               AND table_schema = 'public') THEN
        ALTER TABLE public.llm_gating ADD CONSTRAINT chk_llm_gating_max_tokens_positive
        CHECK (max_tokens_per_request > 0);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'llm_gating'
               AND column_name = 'requests_per_minute'
               AND table_schema = 'public') THEN
        ALTER TABLE public.llm_gating ADD CONSTRAINT chk_llm_gating_requests_per_minute_positive
        CHECK (requests_per_minute > 0);
    END IF;
END $$;

-- Add CHECK constraints for progressive_rollouts table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'progressive_rollouts'
               AND column_name = 'rollout_percentage'
               AND table_schema = 'public') THEN
        ALTER TABLE public.progressive_rollouts ADD CONSTRAINT chk_progressive_rollouts_percentage
        CHECK (rollout_percentage >= 0.0 AND rollout_percentage <= 100.0);
    END IF;
END $$;

-- Add CHECK constraints for integration_configs table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'integration_configs'
               AND column_name = 'sync_interval_minutes'
               AND table_schema = 'public') THEN
        ALTER TABLE public.integration_configs ADD CONSTRAINT chk_integration_configs_sync_interval_positive
        CHECK (sync_interval_minutes > 0);
    END IF;
END $$;

COMMIT;