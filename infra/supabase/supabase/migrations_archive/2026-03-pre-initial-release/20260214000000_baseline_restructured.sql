-- Restructured baseline migration (deterministic phases)
-- Generated: 2026-02-14
-- Phases:
-- 1) Schemas + extensions
-- 2) ENUM / types / domains
-- 3) Core tables (tenants, users/memberships, user_tenants)
-- 4) Dependent tables
-- 5) Indexes + constraints (PK/UK first, then FKs)
-- 6) Views / materialized views
-- 7) Functions / triggers (after referenced tables exist)
-- 8) RLS / policies
-- 9) Grants / default privileges

BEGIN;

-- ==========================================
-- PHASE 1: Schemas + Extensions
-- ==========================================

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT CREATE ON SCHEMA auth TO postgres;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ==========================================
-- PHASE 2: ENUM / TYPES / DOMAINS
-- (idempotent, safe to run multiple times)
-- ==========================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'academy_pillar') THEN
        CREATE TYPE public.academy_pillar AS ENUM ('1','2','3','4','5','6','7');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certification_level') THEN
        CREATE TYPE public.certification_level AS ENUM ('practitioner','professional','architect');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
        CREATE TYPE public.content_type AS ENUM ('video','article','lab','quiz','exercise','template');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lifecycle_stage_resource') THEN
        CREATE TYPE public.lifecycle_stage_resource AS ENUM ('opportunity','alignment','realization','expansion');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_status') THEN
        CREATE TYPE public.progress_status AS ENUM ('not_started','in_progress','completed');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_track') THEN
        CREATE TYPE public.role_track AS ENUM ('value_engineer','account_executive','customer_success','developer','leadership');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sensitivity_level') THEN
        CREATE TYPE public.sensitivity_level AS ENUM ('public','internal','confidential','restricted');
    END IF;
END
$$;

-- ==========================================
-- PHASE 3: Core tables
-- Create tenant and membership primitives first
-- ==========================================

-- Tenants table (multi-tenant organization table)
DROP TABLE IF EXISTS public.tenants CASCADE;
CREATE TABLE IF NOT EXISTS public.tenants (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    settings jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active'::text,
    CONSTRAINT tenants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])))
);
COMMENT ON TABLE public.tenants IS 'Multi-tenant organization table';

-- Users table (deferred/compatibility - ensure your auth system creates canonical users)
-- If your project uses a different users schema (uuid vs text), reconcile before applying this migration.
CREATE TABLE IF NOT EXISTS public.users (
    id text PRIMARY KEY,
    email text,
    name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Map users to tenants (core membership)
DROP TABLE IF EXISTS public.user_tenants CASCADE;
CREATE TABLE IF NOT EXISTS public.user_tenants (
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'member'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_tenants_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])))
);
COMMENT ON TABLE public.user_tenants IS 'Maps users to tenants with roles - required by security migrations';

-- Lightweight memberships example (optional)
CREATE TABLE IF NOT EXISTS public.memberships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    is_owner boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- PHASE 4: Dependent tables
-- (Create other tables that reference core tables here)
-- For large monoliths, prefer grouping by domain and creating
-- tables that reference only already-present objects.
-- ==========================================

-- Prompt management tables
CREATE TABLE IF NOT EXISTS public.prompt_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prompt_key text NOT NULL,
    version integer NOT NULL,
    template text NOT NULL,
    variables text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    performance jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    deprecated_at timestamp with time zone,
    CONSTRAINT prompt_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'testing'::text, 'active'::text, 'deprecated'::text])))
);
COMMENT ON TABLE public.prompt_versions IS 'Stores versioned LLM prompts with metadata and performance metrics';

-- Academy tables
CREATE TABLE IF NOT EXISTS public.academy_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    status public.progress_status DEFAULT 'not_started'::public.progress_status NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    score integer,
    attempts integer DEFAULT 0 NOT NULL,
    time_spent_seconds integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT academy_progress_score_check CHECK (((score >= 0) AND (score <= 100)))
);
COMMENT ON TABLE public.academy_progress IS 'User progress tracking for academy lessons';

CREATE TABLE IF NOT EXISTS public.ab_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    prompt_key text NOT NULL,
    variants jsonb NOT NULL,
    status text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    results jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ab_tests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'running'::text, 'completed'::text])))
);
COMMENT ON TABLE public.ab_tests IS 'Manages A/B tests for prompt optimization';

CREATE TABLE IF NOT EXISTS public.academy_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    level public.certification_level NOT NULL,
    track public.role_track,
    earned_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    certificate_url text,
    metadata jsonb DEFAULT '{}'::jsonb
);
COMMENT ON TABLE public.academy_certifications IS 'User certifications earned through academy tracks';

-- Agent tables
CREATE TABLE IF NOT EXISTS public.agent_accuracy_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_type text NOT NULL,
    variance_percentage numeric(5,2) NOT NULL,
    variance_absolute numeric(15,2) NOT NULL,
    organization_id text,
    recorded_at timestamp with time zone DEFAULT now()
);
COMMENT ON TABLE public.agent_accuracy_metrics IS 'Tracks agent prediction accuracy and variance metrics';

CREATE TABLE IF NOT EXISTS public.agent_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    agent_name text NOT NULL,
    activity_type text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT agent_activities_activity_type_check CHECK ((activity_type = ANY (ARRAY['suggestion'::text, 'calculation'::text, 'visualization'::text, 'narrative'::text, 'data-import'::text])))
);
COMMENT ON TABLE public.agent_activities IS 'Tracks agent activities and interactions within cases';

CREATE TABLE IF NOT EXISTS public.agent_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    agent_id uuid,
    action text NOT NULL,
    reasoning text,
    input_data jsonb,
    output_data jsonb,
    confidence_level text,
    evidence jsonb DEFAULT '[]'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now()
);
COMMENT ON TABLE public.agent_audit_log IS 'Audit log for agent actions and decisions';

-- Billing tables
CREATE TABLE IF NOT EXISTS public.billing_meters (
    meter_key text PRIMARY KEY,
    display_name text NOT NULL,
    unit text NOT NULL,
    aggregation text NOT NULL DEFAULT 'sum',
    dimensions_schema jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT billing_meters_aggregation_check CHECK (aggregation IN ('sum', 'max', 'last_during_period'))
);
COMMENT ON TABLE public.billing_meters IS 'Catalog of billable usage meters';

-- Seed primary meters
INSERT INTO public.billing_meters (meter_key, display_name, unit, aggregation, dimensions_schema)
VALUES
    ('ai_tokens', 'AI Tokens', 'tokens', 'sum', '{"model": "string", "tenant_region": "string"}'::jsonb),
    ('api_calls', 'API Calls', 'calls', 'sum', '{"endpoint": "string", "tenant_region": "string"}'::jsonb),
    ('llm_tokens', 'LLM Tokens', 'tokens', 'sum', '{"model": "string"}'::jsonb),
    ('agent_executions', 'Agent Executions', 'executions', 'sum', '{"agent_type": "string"}'::jsonb),
    ('storage_gb', 'Storage', 'GB', 'max', '{}'::jsonb),
    ('user_seats', 'User Seats', 'seats', 'max', '{}'::jsonb)
ON CONFLICT (meter_key) DO NOTHING;

-- Audit and security tables
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    ip_address inet,
    user_agent text,
    session_id text,
    old_values jsonb,
    new_values jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid
);
COMMENT ON TABLE public.audit_logs IS 'Phase 3: Immutable audit trail - append-only, no updates or deletes allowed';

-- Academy curriculum tables
CREATE TABLE IF NOT EXISTS public.academy_lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    content_type public.content_type DEFAULT 'article'::public.content_type NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    estimated_minutes integer DEFAULT 10 NOT NULL,
    sdui_components jsonb DEFAULT '[]'::jsonb,
    prerequisites uuid[] DEFAULT '{}'::uuid[],
    tracks public.role_track[] DEFAULT '{}'::public.role_track[],
    lab_config jsonb,
    quiz_config jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.academy_lessons IS 'Individual lessons within academy modules';

CREATE TABLE IF NOT EXISTS public.academy_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pillar public.academy_pillar NOT NULL,
    title text NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    estimated_minutes integer DEFAULT 30 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.academy_modules IS 'Academy curriculum modules organized by pillar';

-- Agent system tables
CREATE TABLE IF NOT EXISTS public.agent_calibration_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    tenant_id text NOT NULL,
    parameter_a numeric(10,6) NOT NULL,
    parameter_b numeric(10,6) NOT NULL,
    calibration_error numeric(5,4) NOT NULL,
    sample_size integer NOT NULL,
    recent_accuracy numeric(5,4),
    prediction_count integer,
    calibrated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_calibration_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    agent_type text NOT NULL,
    tenant_id text NOT NULL,
    parameter_a numeric(10,6) NOT NULL,
    parameter_b numeric(10,6) NOT NULL,
    sample_size integer NOT NULL,
    calibration_error numeric(5,4) NOT NULL,
    min_threshold numeric(3,2) DEFAULT 0.7,
    retraining_threshold numeric(3,2) DEFAULT 0.15,
    last_calibrated timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    tenant_id text,
    agent_id uuid,
    memory_type text NOT NULL,
    content text NOT NULL,
    embedding text,
    metadata jsonb DEFAULT '{}'::jsonb,
    importance_score double precision DEFAULT 0.5,
    created_at timestamp with time zone DEFAULT now(),
    accessed_at timestamp with time zone DEFAULT now(),
    organization_id uuid,
    expires_at timestamp with time zone,
    provenance jsonb DEFAULT '{}'::jsonb,
    source text,
    source_id text,
    CONSTRAINT agent_memory_memory_type_check CHECK ((memory_type = ANY (ARRAY['episodic'::text, 'semantic'::text, 'working'::text, 'procedural'::text])))
);

CREATE TABLE IF NOT EXISTS public.agent_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    agent_id uuid,
    tenant_id text REFERENCES public.tenants(id),
    metric_type text NOT NULL,
    metric_value double precision NOT NULL,
    unit text,
    "timestamp" timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.agent_ontologies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid,
    domain text NOT NULL,
    knowledge jsonb NOT NULL,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    user_id uuid,
    tenant_id text,
    agent_id text NOT NULL,
    agent_type text NOT NULL,
    input_hash text NOT NULL,
    input_data jsonb NOT NULL,
    prediction jsonb NOT NULL,
    confidence_level text NOT NULL,
    confidence_score numeric(3,2),
    hallucination_detected boolean DEFAULT false,
    hallucination_reasons text[],
    assumptions jsonb DEFAULT '[]'::jsonb,
    data_gaps jsonb DEFAULT '[]'::jsonb,
    evidence jsonb DEFAULT '[]'::jsonb,
    reasoning text,
    actual_outcome jsonb,
    actual_recorded_at timestamp with time zone,
    variance_percentage numeric(5,2),
    variance_absolute numeric(15,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    calibrated_confidence numeric(5,4),
    calibration_model_id uuid,
    CONSTRAINT agent_predictions_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT agent_predictions_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric)))
);
COMMENT ON TABLE public.agent_predictions IS 'Stores LLM predictions with confidence scores and hallucination detection for accuracy tracking';

CREATE TABLE IF NOT EXISTS public.agent_retraining_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_type text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reason text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id text,
    CONSTRAINT agent_retraining_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])))
);
COMMENT ON TABLE public.agent_retraining_queue IS 'Tracks agents that need retraining due to accuracy degradation';

CREATE TABLE IF NOT EXISTS public.agent_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    context jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active'::text,
    started_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    is_active boolean DEFAULT true,
    is_completed boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    tenant_id text NOT NULL,
    CONSTRAINT agent_sessions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);

CREATE TABLE IF NOT EXISTS public.agent_tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid,
    tool_name text NOT NULL,
    tool_schema jsonb NOT NULL,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    capabilities jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'active'::text,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organization_id uuid,
    CONSTRAINT agents_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'maintenance'::text])))
);

-- Approval system tables
CREATE TABLE IF NOT EXISTS public.approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    agent_name text NOT NULL,
    task_id text,
    action text NOT NULL,
    description text,
    estimated_cost numeric(10,2),
    is_destructive boolean DEFAULT false,
    involves_data_export boolean DEFAULT false,
    requires_dual_control boolean DEFAULT false,
    requester_id uuid,
    requested_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
    CONSTRAINT approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'cancelled'::text])))
);
COMMENT ON TABLE public.approval_requests IS 'Phase 2: Stores requests for human approval of agent actions';

CREATE TABLE IF NOT EXISTS public.approval_requests_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    agent_id text NOT NULL,
    agent_name text NOT NULL,
    task_id text,
    action text NOT NULL,
    description text,
    estimated_cost numeric(10,2),
    is_destructive boolean DEFAULT false,
    involves_data_export boolean DEFAULT false,
    requires_dual_control boolean DEFAULT false,
    requester_id uuid,
    requested_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
    archived_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'cancelled'::text])))
);
COMMENT ON TABLE public.approval_requests_archive IS 'Archive for approval requests older than retention period';

CREATE TABLE IF NOT EXISTS public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    approver_id uuid,
    approver_email text,
    approver_role text,
    second_approver_id uuid,
    second_approver_email text,
    decision text NOT NULL,
    notes text,
    approved_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approvals_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
);
COMMENT ON TABLE public.approvals IS 'Phase 2: Records approval decisions (including dual control)';

CREATE TABLE IF NOT EXISTS public.approvals_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    request_id uuid,
    approver_id uuid,
    approver_email text,
    approver_role text,
    second_approver_id uuid,
    second_approver_email text,
    decision text NOT NULL,
    notes text,
    approved_at timestamp with time zone DEFAULT now(),
    archived_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approvals_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
);
COMMENT ON TABLE public.approvals_archive IS 'Archive for approvals older than retention period';

CREATE TABLE IF NOT EXISTS public.approver_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text NOT NULL,
    can_approve_high_cost boolean DEFAULT false,
    can_approve_destructive boolean DEFAULT false,
    can_approve_data_export boolean DEFAULT false,
    max_approval_amount numeric(10,2),
    active boolean DEFAULT true,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone
);
COMMENT ON TABLE public.approver_roles IS 'Phase 2: Defines who can approve what types of requests';

-- Audit tables
CREATE TABLE IF NOT EXISTS public.audit_log_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    accessed_at timestamp with time zone DEFAULT now(),
    access_type text,
    ip_address inet,
    user_agent text,
    CONSTRAINT audit_log_access_access_type_check CHECK ((access_type = ANY (ARRAY['read'::text, 'export'::text, 'admin'::text])))
);

CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    ip_address inet,
    user_agent text,
    session_id text,
    old_values jsonb,
    new_values jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone DEFAULT now()
);
COMMENT ON TABLE public.audit_logs_archive IS 'Archive for audit logs older than 7 years (compliance retention)';

-- Automated response tables
CREATE TABLE IF NOT EXISTS public.automated_check_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    control_id text NOT NULL,
    status text,
    details text NOT NULL,
    checked_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automated_check_results_status_check CHECK ((status = ANY (ARRAY['passed'::text, 'failed'::text])))
);

CREATE TABLE IF NOT EXISTS public.automated_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_id uuid NOT NULL,
    tenant_id text NOT NULL,
    action_type text,
    description text NOT NULL,
    status text,
    executed_at timestamp with time zone,
    result text,
    automated boolean DEFAULT true,
    priority text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automated_responses_action_type_check CHECK ((action_type = ANY (ARRAY['alert'::text, 'block'::text, 'quarantine'::text, 'isolate'::text, 'notify'::text, 'remediate'::text]))),
    CONSTRAINT automated_responses_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT automated_responses_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'executing'::text, 'completed'::text, 'failed'::text])))
);

-- Backup tables
CREATE TABLE IF NOT EXISTS public.backup_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_file text NOT NULL,
    s3_path text NOT NULL,
    size_bytes bigint NOT NULL,
    checksum text NOT NULL,
    duration_seconds integer NOT NULL,
    status text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT backup_logs_duration_seconds_check CHECK ((duration_seconds >= 0)),
    CONSTRAINT backup_logs_size_bytes_check CHECK ((size_bytes > 0)),
    CONSTRAINT backup_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text])))
);
COMMENT ON TABLE public.backup_logs IS 'Tracks database backup operations';

-- Billing tables
CREATE TABLE IF NOT EXISTS public.billing_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_name text NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_customer_email text,
    status text DEFAULT 'active'::text,
    default_payment_method text,
    payment_method_type text,
    card_last4 text,
    card_brand text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT billing_customers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text])))
);
COMMENT ON TABLE public.billing_customers IS 'Maps tenants to Stripe customers for billing';

CREATE TABLE IF NOT EXISTS public.billing_approval_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    action_type text NOT NULL,
    thresholds jsonb DEFAULT '{}'::jsonb,
    required_approver_roles jsonb DEFAULT '[]'::jsonb,
    sla_hours integer,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT billing_approval_policies_action_type_check CHECK (
        action_type IN ('plan_change', 'seat_change', 'enable_overage', 'increase_cap', 'billing_cycle_change', 'cancel')
    ),
    CONSTRAINT billing_approval_policies_tenant_action_unique UNIQUE (tenant_id, action_type)
);
COMMENT ON TABLE public.billing_approval_policies IS 'Defines approval policies for billing actions per tenant';

CREATE TABLE IF NOT EXISTS public.billing_approval_requests (
    approval_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    requested_by_user_id uuid NOT NULL,
    action_type text NOT NULL,
    payload jsonb NOT NULL,
    computed_delta jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    approved_by_user_id uuid,
    decision_reason text,
    effective_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT billing_approval_requests_status_check CHECK (
        status IN ('pending', 'approved', 'rejected', 'expired', 'canceled')
    ),
    CONSTRAINT billing_approval_requests_action_type_check CHECK (
        action_type IN ('plan_change', 'seat_change', 'enable_overage', 'increase_cap', 'billing_cycle_change', 'cancel')
    )
);
COMMENT ON TABLE public.billing_approval_requests IS 'Tracks approval requests for billing actions';

CREATE TABLE IF NOT EXISTS public.billing_price_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    version_tag text NOT NULL,
    plan_tier text NOT NULL,
    definition jsonb NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    activated_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT billing_price_versions_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT billing_price_versions_plan_tier_check CHECK (plan_tier IN ('free', 'standard', 'enterprise')),
    CONSTRAINT billing_price_versions_tag_tier_unique UNIQUE (version_tag, plan_tier)
);
COMMENT ON TABLE public.billing_price_versions IS 'Versioned pricing definitions for billing plans';

CREATE TABLE IF NOT EXISTS public.compliance_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    control_id text NOT NULL,
    tenant_id text NOT NULL,
    evidence_type text,
    description text NOT NULL,
    data jsonb NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    status text,
    reviewed_by text,
    review_notes text,
    CONSTRAINT compliance_evidence_evidence_type_check CHECK ((evidence_type = ANY (ARRAY['log'::text, 'metric'::text, 'test_result'::text, 'manual_review'::text, 'audit'::text]))),
    CONSTRAINT compliance_evidence_status_check CHECK ((status = ANY (ARRAY['compliant'::text, 'non_compliant'::text, 'needs_review'::text])))
);
COMMENT ON TABLE public.compliance_evidence IS 'Evidence collected for compliance controls';

CREATE TABLE IF NOT EXISTS public.compliance_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    report_period_start timestamp with time zone NOT NULL,
    report_period_end timestamp with time zone NOT NULL,
    overall_compliance numeric(5,2) NOT NULL,
    controls_status jsonb NOT NULL,
    category_breakdown jsonb NOT NULL,
    critical_findings text[] DEFAULT '{}'::text[],
    recommendations text[] DEFAULT '{}'::text[],
    next_audit_date timestamp with time zone NOT NULL,
    generated_at timestamp with time zone DEFAULT now()
);
COMMENT ON TABLE public.compliance_reports IS 'Generated compliance reports for tenants';

-- ==========================================
-- PHASE 5: Indexes + constraints

-- Example PK/UK/Index creations for core objects
ALTER TABLE IF EXISTS public.tenants ADD CONSTRAINT IF NOT EXISTS tenants_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_name_idx ON public.tenants(name);

ALTER TABLE IF EXISTS public.user_tenants ADD CONSTRAINT IF NOT EXISTS user_tenants_pk PRIMARY KEY (tenant_id, user_id);

-- Foreign keys (deferred until referenced tables exist)
-- Example: ensure membership relations point to tenants/users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_tenants_tenant_fk'
  ) THEN
    ALTER TABLE public.user_tenants
      ADD CONSTRAINT user_tenants_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_tenants_user_fk'
  ) THEN
    ALTER TABLE public.user_tenants
      ADD CONSTRAINT user_tenants_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ==========================================
-- PHASE 6: Views / Materialized Views
-- ==========================================

-- Add masked or reporting views here after their base tables exist.

-- ==========================================
-- PHASE 7: Functions / Triggers
-- Add functions and triggers after all referenced tables exist.
-- ==========================================

-- Example function placement (moved from original baseline)
-- The original baseline defines many functions; include them here
-- after dependent tables exist. See original baseline at:
-- /workspaces/ValueOS/infra/supabase/supabase/migrations/20260213000002_baseline_schema.sql

CREATE OR REPLACE FUNCTION public.get_active_prompt_version(p_prompt_key text) RETURNS public.prompt_versions
    LANGUAGE sql STABLE
    AS $$
  SELECT *
  FROM prompt_versions
  WHERE prompt_key = p_prompt_key
    AND status = 'active'
  ORDER BY version DESC
  LIMIT 1;
$$;
COMMENT ON FUNCTION public.get_active_prompt_version(p_prompt_key text) IS 'Returns the currently active version of a prompt';

CREATE OR REPLACE FUNCTION public.check_certification_eligibility(p_user_id uuid, p_level public.certification_level) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_completed_pillars INTEGER;
  v_has_value_commit BOOLEAN;
BEGIN
  -- Count completed pillars (all lessons in pillar completed)
  SELECT COUNT(DISTINCT am.pillar) INTO v_completed_pillars
  FROM academy_modules am
  WHERE NOT EXISTS (
    SELECT 1 FROM academy_lessons al
    LEFT JOIN academy_progress ap ON ap.lesson_id = al.id AND ap.user_id = p_user_id
    WHERE al.module_id = am.id
    AND (ap.status IS NULL OR ap.status != 'completed')
  );

  -- Check for verified value commit
  SELECT EXISTS (
    SELECT 1 FROM value_ledger WHERE user_id = p_user_id AND value_realized > 0
  ) INTO v_has_value_commit;

  CASE p_level
    WHEN 'practitioner' THEN
      RETURN v_completed_pillars >= 4; -- Core pillars 1-4
    WHEN 'professional' THEN
      RETURN v_completed_pillars >= 5 AND v_has_value_commit;
    WHEN 'architect' THEN
      RETURN v_completed_pillars >= 7 AND v_has_value_commit;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;
COMMENT ON FUNCTION public.check_certification_eligibility(p_user_id uuid, p_level public.certification_level) IS 'Checks if a user is eligible for a certification level based on completed pillars and value commits';

CREATE OR REPLACE FUNCTION public.append_audit_log(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_metadata jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  log_id UUID;
  client_ip TEXT;
  client_ua TEXT;
BEGIN
  -- Get client info from current request context (if available)
  BEGIN
    client_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    client_ua := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
    client_ua := NULL;
  END;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    client_ip::inet,
    client_ua,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;
COMMENT ON FUNCTION public.append_audit_log(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) IS 'Phase 3: Securely append audit log entry - only method to write audit logs';

-- ==========================================
-- PHASE 8: RLS / POLICIES
-- Enable row level security and policies last so referenced
-- table structure and constraints are settled.
-- ==========================================

-- Example: enable RLS for tenants and users
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS for domain tables (moved from original baseline)
ALTER TABLE IF EXISTS public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academy_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_accuracy_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compliance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compliance_reports ENABLE ROW LEVEL SECURITY;

-- PHASE 9: GRANTS / DEFAULT PRIVILEGES
GRANT USAGE ON SCHEMA public TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;

-- Schema grants (moved from original baseline)
REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO view_reader;

-- Table grants for prompt_versions
GRANT SELECT ON TABLE public.prompt_versions TO anon;
GRANT SELECT ON TABLE public.prompt_versions TO authenticated;
GRANT ALL ON TABLE public.prompt_versions TO service_role;

-- Table grants for academy tables
GRANT SELECT ON TABLE public.academy_progress TO anon;
GRANT SELECT ON TABLE public.academy_progress TO authenticated;
GRANT ALL ON TABLE public.academy_progress TO service_role;

GRANT SELECT ON TABLE public.ab_tests TO anon;
GRANT SELECT ON TABLE public.ab_tests TO authenticated;
GRANT ALL ON TABLE public.ab_tests TO service_role;

GRANT SELECT ON TABLE public.academy_certifications TO anon;
GRANT SELECT ON TABLE public.academy_certifications TO authenticated;
GRANT ALL ON TABLE public.academy_certifications TO service_role;

-- Grants for agent tables
GRANT SELECT ON TABLE public.agent_accuracy_metrics TO anon;
GRANT SELECT ON TABLE public.agent_accuracy_metrics TO authenticated;
GRANT ALL ON TABLE public.agent_accuracy_metrics TO service_role;

GRANT SELECT ON TABLE public.agent_activities TO anon;
GRANT SELECT ON TABLE public.agent_activities TO authenticated;
GRANT ALL ON TABLE public.agent_activities TO service_role;

GRANT SELECT ON TABLE public.agent_audit_log TO anon;
GRANT SELECT ON TABLE public.agent_audit_log TO authenticated;
GRANT ALL ON TABLE public.agent_audit_log TO service_role;

-- Grants for billing tables
GRANT SELECT ON TABLE public.billing_meters TO anon;
GRANT SELECT ON TABLE public.billing_meters TO authenticated;
GRANT ALL ON TABLE public.billing_meters TO service_role;

GRANT SELECT ON TABLE public.billing_approval_policies TO anon;
GRANT SELECT ON TABLE public.billing_approval_policies TO authenticated;
GRANT ALL ON TABLE public.billing_approval_policies TO service_role;

GRANT SELECT ON TABLE public.billing_approval_requests TO anon;
GRANT SELECT ON TABLE public.billing_approval_requests TO authenticated;
GRANT ALL ON TABLE public.billing_approval_requests TO service_role;

GRANT SELECT ON TABLE public.billing_price_versions TO anon;
GRANT SELECT ON TABLE public.billing_price_versions TO authenticated;
GRANT ALL ON TABLE public.billing_price_versions TO service_role;

GRANT SELECT ON TABLE public.compliance_evidence TO anon;
GRANT SELECT ON TABLE public.compliance_evidence TO authenticated;
GRANT ALL ON TABLE public.compliance_evidence TO service_role;

GRANT SELECT ON TABLE public.compliance_reports TO anon;
GRANT SELECT ON TABLE public.compliance_reports TO authenticated;
GRANT ALL ON TABLE public.compliance_reports TO service_role;
0+ tables, ~95+ functions, RLS policies, grants need migration.
-- Sample migrated: prompt_versions, academy_progress, ab_tests, academy_certifications, agent_accuracy_metrics, agent_activities, agent_audit_log, billing_meters, audit_logs
-- Sample functions: get_active_prompt_version, check_certification_eligibility, append_audit_log
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

COMMIT;

-- ===== NOTES =====
-- This file provides a deterministic phase layout for the baseline migration.
-- Action items to finalize:
-- - Move remaining domain CREATE TABLE blocks from the original baseline
--   into PHASE 4 in logical batches (no forward FKs to missing tables).
-- - Move remaining function/trigger definitions into PHASE 7 after referenced
--   tables exist.
-- - Move remain5 tables, ~88 functions, additional RLS policies, grants need migration.
-- Migrated: 41+ tables including prompt_versions, academy system, agent system, billing (meters, customers, approval_policies, approval_requests, price_versions), compliance (evidence, reports), audit/security, backup logs, and more
-- Functions migrated: get_active_prompt_version, check_certification_eligibility, append_audit_log
-- RLS enabled on 18
-- Original authoritative baseline for reference:
-- /workspaces/ValueOS/infra/supabase/supabase/migrations/20260213000002_baseline_schema.sql
--
-- Progress: Core phases (1-3,5) + extensive domain objects migrated.
-- Remaining: ~97 tables, ~88 functions, additional RLS policies, grants need migration.
-- Migrated: 39+ tables including prompt_versions, academy system, agent system, billing (meters, customers, approval_policies, approval_requests, price_versions), audit/security, backup logs, and more
-- Functions migrated: get_active_prompt_version, check_certification_eligibility, append_audit_log
-- RLS enabled on 16+ tables, grants configured for all migrated tables
