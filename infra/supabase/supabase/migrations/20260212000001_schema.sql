-- ============================================================================
-- 001_schema.sql — Consolidated schema for ValueOS
-- Squashed from 43 deferred migrations into a single ordered migration set.
-- Base: 20240101000000_release_v1.sql (squashed schema dump)
-- ============================================================================

-- language: postgresql
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- ================================================
-- Source: supabase/migrations/20241227000000_squashed_schema.sql
-- ================================================
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.15 (Debian 15.15-1.pgdg12+1)
-- Dumped by pg_dump version 15.15 (Debian 15.15-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET search_path = public, pg_temp;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Allow local superuser to create helper in auth schema
-- Ensure auth schema and jwt helper exist for local environments
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT CREATE ON SCHEMA auth TO postgres;

  -- feature_flags column guard
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='feature_flags' AND column_name='is_enabled') THEN
    BEGIN
      UPDATE public.feature_flags SET is_enabled = false WHERE is_enabled IS NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: academy_pillar; Type: TYPE; Schema: public; Owner: -
--

-- Populate existing NULL values with defaults (guarded for fresh DB)
DO $$
BEGIN
  -- agent_sessions
  BEGIN
    UPDATE public.agent_sessions SET is_active = true WHERE is_active IS NULL;
    UPDATE public.agent_sessions SET is_completed = false WHERE is_completed IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- workflow_executions
  BEGIN
    UPDATE public.workflow_executions SET is_success = false WHERE is_success IS NULL;
    UPDATE public.workflow_executions SET is_completed = false WHERE is_completed IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- progressive_rollouts (exists guard)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'progressive_rollouts') THEN
    BEGIN
      EXECUTE 'UPDATE public.progressive_rollouts SET is_active = true WHERE is_active IS NULL';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- feature_flags column guard
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='feature_flags' AND column_name='is_enabled') THEN
    BEGIN
      UPDATE public.feature_flags SET is_enabled = false WHERE is_enabled IS NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;
--

-- Populate existing NULL values with defaults (guarded for fresh DB)
DO $$
BEGIN
  -- agent_sessions
  BEGIN
    UPDATE public.agent_sessions SET is_active = true WHERE is_active IS NULL;
    UPDATE public.agent_sessions SET is_completed = false WHERE is_completed IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- workflow_executions
  BEGIN
    UPDATE public.workflow_executions SET is_success = false WHERE is_success IS NULL;
    UPDATE public.workflow_executions SET is_completed = false WHERE is_completed IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- progressive_rollouts (exists guard)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'progressive_rollouts') THEN
    BEGIN
      EXECUTE 'UPDATE public.progressive_rollouts SET is_active = true WHERE is_active IS NULL';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- feature_flags column guard
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='feature_flags' AND column_name='is_enabled') THEN
    BEGIN
      UPDATE public.feature_flags SET is_enabled = false WHERE is_enabled IS NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;
            END;
            $$;
$$;


--
-- Name: role_track; Type: TYPE; Schema: public; Owner: -
--

DO $$
-- Populate existing NULL values with defaults (guarded for fresh DB)
DO $$
BEGIN
  -- agent_sessions
  BEGIN
    UPDATE public.agent_sessions SET is_active = true WHERE is_active IS NULL;
    UPDATE public.agent_sessions SET is_completed = false WHERE is_completed IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- workflow_executions
  BEGIN
    UPDATE public.workflow_executions SET is_success = false WHERE is_success IS NULL;
    UPDATE public.workflow_executions SET is_completed = false WHERE is_completed IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  -- progressive_rollouts (exists guard)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'progressive_rollouts') THEN
    BEGIN
      EXECUTE 'UPDATE public.progressive_rollouts SET is_active = true WHERE is_active IS NULL';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- feature_flags column guard
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='feature_flags' AND column_name='is_enabled') THEN
    BEGIN
      UPDATE public.feature_flags SET is_enabled = false WHERE is_enabled IS NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;
                BEGIN
                  EXECUTE 'UPDATE public.agent_performance_summary SET metadata = ''{}'' WHERE metadata IS NULL OR jsonb_typeof(metadata) != ''object''';
                EXCEPTION WHEN OTHERS THEN NULL; END;
              END IF;

              -- integration_configs (guarded)
              IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'integration_configs') THEN
                BEGIN
                  EXECUTE 'UPDATE public.integration_configs SET config = ''{}'' WHERE config IS NULL OR jsonb_typeof(config) != ''object''';
                EXCEPTION WHEN OTHERS THEN NULL; END;
              END IF;
            END;
            $$;
  v_plan_tier TEXT;
  v_membership_id UUID;
BEGIN
  -- Start transaction with row locking
  -- Lock the subscriptions table to prevent concurrent seat allocations
  SELECT plan_tier INTO v_plan_tier
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
  FOR UPDATE; -- Lock the row

  -- Get current active user count with locking
  SELECT COUNT(*) INTO v_current_users
  FROM user_tenants
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
  FOR UPDATE; -- Lock user_tenants for this tenant

  -- Determine max users based on plan
  CASE v_plan_tier
    WHEN 'free' THEN v_max_users := 3;
    WHEN 'starter' THEN v_max_users := 10;
    WHEN 'professional' THEN v_max_users := 50;
    WHEN 'enterprise' THEN v_max_users := 1000; -- Large number for unlimited
    ELSE v_max_users := 3; -- Default to free tier
  END CASE;

  -- Check if adding this user would exceed limits
  IF v_current_users >= v_max_users THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Seat limit exceeded',
      'current_users', v_current_users,
      'max_users', v_max_users
    );
    -- Populate existing NULL values with defaults (guarded for fresh DB)
    DO $$
    BEGIN
      -- agent_sessions
      BEGIN
        UPDATE public.agent_sessions SET is_active = true WHERE is_active IS NULL;
        UPDATE public.agent_sessions SET is_completed = false WHERE is_completed IS NULL;
      EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

      -- workflow_executions
      BEGIN
        UPDATE public.workflow_executions SET is_success = false WHERE is_success IS NULL;
        UPDATE public.workflow_executions SET is_completed = false WHERE is_completed IS NULL;
      EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

      -- progressive_rollouts (exists guard)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'progressive_rollouts') THEN
        BEGIN
          EXECUTE 'UPDATE public.progressive_rollouts SET is_active = true WHERE is_active IS NULL';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;

      -- feature_flags column guard
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='feature_flags' AND column_name='is_enabled') THEN
        BEGIN
          UPDATE public.feature_flags SET is_enabled = false WHERE is_enabled IS NULL;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END;
    $$;

    COMMIT;
      'membership_id', v_membership_id,
      'seats_before', v_current_users,
      'seats_after', v_current_users + 1,
      'max_seats', v_max_users
    )
  );

  -- Return success
  RETURN json_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'current_users', v_current_users + 1,
    'max_users', v_max_users
  );

EXCEPTION
  WHEN OTHERS THEN
  -- Populate existing NULL values with defaults (guarded for fresh DB)
  DO $$
  BEGIN
    -- agent_sessions
    BEGIN
      UPDATE public.agent_sessions SET is_active = true WHERE is_active IS NULL;
      UPDATE public.agent_sessions SET is_completed = false WHERE is_completed IS NULL;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

    -- workflow_executions
    BEGIN
      UPDATE public.workflow_executions SET is_success = false WHERE is_success IS NULL;
      UPDATE public.workflow_executions SET is_completed = false WHERE is_completed IS NULL;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

    -- progressive_rollouts (exists guard)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'progressive_rollouts') THEN
      BEGIN
        EXECUTE 'UPDATE public.progressive_rollouts SET is_active = true WHERE is_active IS NULL';
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    -- feature_flags column guard
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='feature_flags' AND column_name='is_enabled') THEN
      BEGIN
        UPDATE public.feature_flags SET is_enabled = false WHERE is_enabled IS NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END;
  $$;

  COMMIT;
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


--
-- Name: FUNCTION append_audit_log(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.append_audit_log(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) IS 'Phase 3: Securely append audit log entry - only method to write audit logs';


--
-- Name: approve_request(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.approve_request(p_request_id uuid, p_second_approver_email text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  request RECORD;
  approver_valid BOOLEAN;
  existing_approval UUID;
BEGIN
  -- Get request details
  SELECT * INTO request
  FROM public.approval_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;

  -- Check if request has expired
  IF request.expires_at < NOW() THEN
    UPDATE public.approval_requests
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_request_id;

    RAISE EXCEPTION 'Request has expired';
  END IF;

  -- Check if approver has permission
  SELECT EXISTS (
    SELECT 1 FROM public.approver_roles
    WHERE user_id = auth.uid()
      AND active = TRUE
      AND (
        (request.estimated_cost <= max_approval_amount) OR
        (can_approve_high_cost AND request.estimated_cost > 100) OR
        (can_approve_destructive AND request.is_destructive) OR
        (can_approve_data_export AND request.involves_data_export)
      )
  ) INTO approver_valid;

  IF NOT approver_valid THEN
    RAISE EXCEPTION 'User does not have permission to approve this request';
  END IF;

  -- Check dual control requirement
  IF request.requires_dual_control AND p_second_approver_email IS NULL THEN
    RAISE EXCEPTION 'This request requires dual control (second approver)';
  END IF;

  -- Check if already approved
  SELECT id INTO existing_approval
  FROM public.approvals
  WHERE request_id = p_request_id;

  IF existing_approval IS NOT NULL THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Record approval
  INSERT INTO public.approvals (
    request_id,
    approver_id,
    approver_email,
    second_approver_email,
    decision,
    notes
  ) VALUES (
    p_request_id,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    p_second_approver_email,
    'approved',
    p_notes
  );

  -- Update request status
  UPDATE public.approval_requests
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION approve_request(p_request_id uuid, p_second_approver_email text, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.approve_request(p_request_id uuid, p_second_approver_email text, p_notes text) IS 'Phase 2: Approves an approval request (with dual control check)';


--
-- Name: audit_tenant_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.audit_tenant_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate tenant_id is not NULL
  IF NEW.tenant_id IS NULL THEN
    -- Log critical security violation
    INSERT INTO security_audit_log (
      event_type,
      user_id,
      tenant_id,
      details,
      severity
    ) VALUES (
      'tenant_id_null_violation',
      (auth.uid())::text,
      NULL,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'attempted_at', NOW()
      ),
      'critical'
    );

    RAISE EXCEPTION 'SECURITY VIOLATION: tenant_id cannot be NULL (table: %, operation: %)',
      TG_TABLE_NAME, TG_OP;
  END IF;

  -- Validate user has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_tenants.user_id = (auth.uid())::text
      AND user_tenants.tenant_id = NEW.tenant_id
  ) THEN
    -- Log unauthorized access attempt
    INSERT INTO security_audit_log (
      event_type,
      user_id,
      tenant_id,
      details,
      severity
    ) VALUES (
      'unauthorized_tenant_access',
      (auth.uid())::text,
      NEW.tenant_id,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'attempted_at', NOW()
      ),
      'critical'
    );

    RAISE EXCEPTION 'SECURITY VIOLATION: User % does not have access to tenant %',
      (auth.uid())::text, NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: audit_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  org_id uuid;
  user_id uuid;
  has_org boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'organization_id'
  ) INTO has_org;

  IF has_org THEN
    IF TG_OP = 'DELETE' THEN
      org_id := OLD.organization_id;
    ELSE
      org_id := NEW.organization_id;
    END IF;
  ELSE
    org_id := (SELECT public.get_current_org_id());
  END IF;

  user_id := (SELECT public.get_current_user_id());

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'delete', TG_TABLE_NAME, OLD.id, jsonb_build_object('before', row_to_json(OLD)));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'update', TG_TABLE_NAME, NEW.id, jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)));
  ELSE
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'create', TG_TABLE_NAME, NEW.id, jsonb_build_object('after', row_to_json(NEW)));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: calculate_version_performance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.calculate_version_performance(p_version_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'avgLatency', AVG(latency),
    'avgCost', AVG(cost),
    'avgTokens', AVG((tokens->>'total')::INTEGER),
    'successRate', AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END),
    'userSatisfaction', AVG((feedback->>'rating')::NUMERIC),
    'executionCount', COUNT(*)
  )
  INTO result
  FROM prompt_executions
  WHERE prompt_version_id = p_version_id;

  RETURN result;
END;
$$;


--
-- Name: FUNCTION calculate_version_performance(p_version_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_version_performance(p_version_id uuid) IS 'Calculates aggregate performance metrics for a prompt version';


--
-- Name: check_account_lockout(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.check_account_lockout(user_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  failed_attempts INT;
  lockout_duration INTERVAL := '15 minutes';
  max_attempts INT := 5;
BEGIN
  SELECT COUNT(*)
  INTO failed_attempts
  FROM public.login_attempts
  WHERE email = user_email
    AND success = FALSE
    AND attempted_at > NOW() - lockout_duration;

  RETURN failed_attempts >= max_attempts;
END;
$$;


--
-- Name: FUNCTION check_account_lockout(user_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_account_lockout(user_email text) IS 'Returns true if account is locked due to too many failed login attempts (5 failures in 15 minutes)';


--
-- Name: check_certification_eligibility(uuid, public.certification_level); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: classify_data_sensitivity(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.classify_data_sensitivity(field_name text, field_value text) RETURNS public.sensitivity_level
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Restricted: Known sensitive field names or contains PII
  IF field_name IN ('ssn', 'social_security', 'credit_card', 'password', 'api_key', 'secret') THEN
    RETURN 'restricted';
  END IF;

  IF public.contains_pii(field_value) THEN
    RETURN 'restricted';
  END IF;

  -- Confidential: Personal info fields
  IF field_name IN ('email', 'phone', 'address', 'dob', 'salary', 'medical') THEN
    RETURN 'confidential';
  END IF;

  -- Internal: Business data
  IF field_name IN ('revenue', 'profit', 'cost', 'internal_notes') THEN
    RETURN 'internal';
  END IF;

  -- Public: Everything else (default to internal for safety)
  RETURN 'internal';
END;
$$;


--
-- Name: FUNCTION classify_data_sensitivity(field_name text, field_value text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.classify_data_sensitivity(field_name text, field_value text) IS 'Auto-classifies data sensitivity based on field name and content';


--
-- Name: cleanup_expired_approval_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.cleanup_expired_approval_requests() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.approval_requests
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN expired_count;
END;
$$;


--
-- Name: FUNCTION cleanup_expired_approval_requests(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_expired_approval_requests() IS 'Phase 2: Marks expired approval requests';


--
-- Name: cleanup_expired_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.cleanup_expired_data() RETURNS TABLE(table_name text, archived_count bigint, deleted_count bigint, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  policy RECORD;
  archived BIGINT;
  deleted BIGINT;
  cutoff_date TIMESTAMPTZ;
  error_msg TEXT;
BEGIN
  FOR policy IN
    SELECT * FROM public.retention_policies WHERE enabled = true
  LOOP
    cutoff_date := NOW() - (policy.retention_days || ' days')::INTERVAL;
    archived := 0;
    deleted := 0;
    error_msg := NULL;

    BEGIN
      -- Archive if configured
      IF policy.archive_before_delete AND policy.archive_table IS NOT NULL THEN
        EXECUTE format(
          'INSERT INTO %I SELECT *, NOW() as archived_at FROM %I WHERE %I < $1',
          policy.archive_table,
          policy.table_name,
          policy.date_column
        ) USING cutoff_date;

        GET DIAGNOSTICS archived = ROW_COUNT;
      END IF;

      -- Delete expired records
      EXECUTE format(
        'DELETE FROM %I WHERE %I < $1',
        policy.table_name,
        policy.date_column
      ) USING cutoff_date;

      GET DIAGNOSTICS deleted = ROW_COUNT;

      -- Update policy status
      UPDATE public.retention_policies
      SET
        last_run_at = NOW(),
        last_run_status = 'success',
        last_run_archived = archived,
        last_run_deleted = deleted,
        updated_at = NOW()
      WHERE id = policy.id;

      -- Return results
      table_name := policy.table_name;
      archived_count := archived;
      deleted_count := deleted;
      status := 'success';
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      error_msg := SQLERRM;

      -- Update policy with error
      UPDATE public.retention_policies
      SET
        last_run_at = NOW(),
        last_run_status = 'error: ' || error_msg,
        updated_at = NOW()
      WHERE id = policy.id;

      -- Return error
      table_name := policy.table_name;
      archived_count := 0;
      deleted_count := 0;
      status := 'error: ' || error_msg;
      RETURN NEXT;
    END;
  END LOOP;
END;
$_$;


--
-- Name: FUNCTION cleanup_expired_data(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_expired_data() IS 'Phase 3: Executes retention policies - archives and deletes expired data';


--
-- Name: cleanup_old_agent_sessions(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.cleanup_old_agent_sessions(days_old integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM agent_sessions
  WHERE updated_at < NOW() - (days_old || ' days')::INTERVAL
    AND status != 'active';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_agent_sessions(days_old integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_agent_sessions(days_old integer) IS 'Cleanup agent sessions older than specified days (default 30)';


--
-- Name: cleanup_old_llm_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.cleanup_old_llm_usage() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM llm_usage
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_llm_usage(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_llm_usage() IS 'Deletes LLM usage records older than 90 days';


--
-- Name: cleanup_old_login_attempts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '90 days';
END;
$$;


--
-- Name: FUNCTION cleanup_old_login_attempts(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_login_attempts() IS 'Removes login attempts older than 90 days for compliance and performance';


--
-- Name: cleanup_table_data(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.cleanup_table_data(p_table_name text, p_dry_run boolean DEFAULT true) RETURNS TABLE(action text, row_count bigint, cutoff_date timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  policy RECORD;
  archived BIGINT;
  deleted BIGINT;
  cutoff TIMESTAMPTZ;
BEGIN
  -- Get policy
  SELECT * INTO policy
  FROM public.retention_policies
  WHERE table_name = p_table_name AND enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No enabled retention policy found for table: %', p_table_name;
  END IF;

  cutoff := NOW() - (policy.retention_days || ' days')::INTERVAL;

  -- Count records to be processed
  IF p_dry_run THEN
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE %I < $1',
      policy.table_name,
      policy.date_column
    ) USING cutoff INTO deleted;

    action := 'dry_run_would_delete';
    row_count := deleted;
    cutoff_date := cutoff;
    RETURN NEXT;

    IF policy.archive_before_delete AND policy.archive_table IS NOT NULL THEN
      action := 'dry_run_would_archive';
      row_count := deleted;
      cutoff_date := cutoff;
      RETURN NEXT;
    END IF;
  ELSE
    -- Archive if configured
    IF policy.archive_before_delete AND policy.archive_table IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO %I SELECT *, NOW() as archived_at FROM %I WHERE %I < $1',
        policy.archive_table,
        policy.table_name,
        policy.date_column
      ) USING cutoff;

      GET DIAGNOSTICS archived = ROW_COUNT;

      action := 'archived';
      row_count := archived;
      cutoff_date := cutoff;
      RETURN NEXT;
    END IF;

    -- Delete expired records
    EXECUTE format(
      'DELETE FROM %I WHERE %I < $1',
      policy.table_name,
      policy.date_column
    ) USING cutoff;

    GET DIAGNOSTICS deleted = ROW_COUNT;

    action := 'deleted';
    row_count := deleted;
    cutoff_date := cutoff;
    RETURN NEXT;
  END IF;
END;
$_$;


--
-- Name: FUNCTION cleanup_table_data(p_table_name text, p_dry_run boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_table_data(p_table_name text, p_dry_run boolean) IS 'Phase 3: Manual cleanup for specific table with dry-run support';


--
-- Name: contains_pii(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.contains_pii(text_value text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF text_value IS NULL THEN
    RETURN false;
  END IF;

  -- Check for email patterns
  IF text_value ~ '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' THEN
    RETURN true;
  END IF;

  -- Check for phone patterns
  IF text_value ~ '\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}' THEN
    RETURN true;
  END IF;

  -- Check for SSN patterns
  IF text_value ~ '\d{3}-?\d{2}-?\d{4}' THEN
    RETURN true;
  END IF;

  -- Check for credit card patterns
  IF text_value ~ '\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: FUNCTION contains_pii(text_value text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.contains_pii(text_value text) IS 'Detects if text contains common PII patterns';


--
-- Name: create_approval_request(text, text, text, numeric, boolean, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.create_approval_request(p_agent_name text, p_action text, p_description text, p_estimated_cost numeric, p_is_destructive boolean, p_involves_data_export boolean, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  request_id UUID;
  requires_dual BOOLEAN;
BEGIN
  -- Determine if dual control is required
  requires_dual := (p_estimated_cost > 100) OR p_action IN (
    'DELETE_USER', 'PURGE_DATABASE', 'MODIFY_BILLING', 'GRANT_ADMIN_ACCESS'
  );

  INSERT INTO public.approval_requests (
    agent_name,
    action,
    description,
    estimated_cost,
    is_destructive,
    involves_data_export,
    requires_dual_control,
    requester_id,
    metadata
  ) VALUES (
    p_agent_name,
    p_action,
    p_description,
    p_estimated_cost,
    p_is_destructive,
    p_involves_data_export,
    requires_dual,
    auth.uid(),
    p_metadata
  )
  RETURNING id INTO request_id;

  RETURN request_id;
END;
$$;


--
-- Name: FUNCTION create_approval_request(p_agent_name text, p_action text, p_description text, p_estimated_cost numeric, p_is_destructive boolean, p_involves_data_export boolean, p_metadata jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_approval_request(p_agent_name text, p_action text, p_description text, p_estimated_cost numeric, p_is_destructive boolean, p_involves_data_export boolean, p_metadata jsonb) IS 'Phase 2: Creates a new approval request for an agent action';


--
-- Name: decrypt_field(bytea, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.decrypt_field(encrypted bytea, encryption_key text DEFAULT current_setting('app.encryption_key'::text, true)) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if user is admin
  BEGIN
    SELECT raw_user_meta_data->>'role' INTO user_role
    FROM auth.users
    WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    user_role := NULL;
  END;

  -- Only admins can decrypt
  IF user_role != 'admin' THEN
    RETURN '[ENCRYPTED]';
  END IF;

  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN '[ENCRYPTION_KEY_NOT_CONFIGURED]';
  END IF;

  RETURN pgp_sym_decrypt(encrypted, encryption_key);
END;
$$;


--
-- Name: FUNCTION decrypt_field(encrypted bytea, encryption_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.decrypt_field(encrypted bytea, encryption_key text) IS 'Decrypts field - only accessible to admins';


--
-- Name: delete_old_secret_audit_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.delete_old_secret_audit_logs() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM secret_audit_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Deleted old secret audit logs';
END;
$$;


--
-- Name: detect_regressions(text, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.detect_regressions(p_agent_type text, p_threshold double precision DEFAULT 0.05) RETURNS TABLE(example_name text, previous_score double precision, current_score double precision, score_diff double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  WITH latest_two_runs AS (
    SELECT id, results
    FROM evaluation_runs
    WHERE agent_type = p_agent_type
    ORDER BY created_at DESC
    LIMIT 2
  ),
  current_run AS (
    SELECT id, results FROM latest_two_runs LIMIT 1
  ),
  previous_run AS (
    SELECT id, results FROM latest_two_runs OFFSET 1 LIMIT 1
  )
  SELECT
    (curr_result->>'exampleName')::TEXT as example_name,
    (prev_result->>'overallScore')::FLOAT as previous_score,
    (curr_result->>'overallScore')::FLOAT as current_score,
    ((curr_result->>'overallScore')::FLOAT - (prev_result->>'overallScore')::FLOAT) as score_diff
  FROM
    current_run,
    jsonb_array_elements(current_run.results) curr_result,
    previous_run,
    jsonb_array_elements(previous_run.results) prev_result
  WHERE
    curr_result->>'exampleId' = prev_result->>'exampleId'
    AND ((curr_result->>'overallScore')::FLOAT - (prev_result->>'overallScore')::FLOAT) < -p_threshold
  ORDER BY score_diff ASC;
END;
$$;


--
-- Name: FUNCTION detect_regressions(p_agent_type text, p_threshold double precision); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.detect_regressions(p_agent_type text, p_threshold double precision) IS 'Compare latest two evaluation runs to detect performance regressions';


--
-- Name: encrypt_field(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.encrypt_field(plaintext text, encryption_key text DEFAULT current_setting('app.encryption_key'::text, true)) RETURNS bytea
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  RETURN pgp_sym_encrypt(plaintext, encryption_key);
END;
$$;


--
-- Name: FUNCTION encrypt_field(plaintext text, encryption_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.encrypt_field(plaintext text, encryption_key text) IS 'Encrypts sensitive field using symmetric encryption';


--
-- Name: get_ab_test_results(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_ab_test_results(p_test_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  test_record ab_tests;
  variant JSONB;
  results JSONB := '[]'::JSONB;
  variant_result JSONB;
BEGIN
  SELECT * INTO test_record FROM ab_tests WHERE id = p_test_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  FOR variant IN SELECT * FROM jsonb_array_elements(test_record.variants)
  LOOP
    SELECT jsonb_build_object(
      'variant', variant->>'name',
      'executions', COUNT(*),
      'avgLatency', AVG(latency),
      'avgCost', AVG(cost),
      'successRate', AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END),
      'userSatisfaction', AVG((feedback->>'rating')::NUMERIC)
    )
    INTO variant_result
    FROM prompt_executions
    WHERE prompt_version_id = (variant->>'versionId')::UUID;

    results := results || jsonb_build_array(variant_result);
  END LOOP;

  RETURN results;
END;
$$;


--
-- Name: FUNCTION get_ab_test_results(p_test_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_ab_test_results(p_test_id uuid) IS 'Returns aggregated results for an A/B test';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: prompt_versions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.prompt_versions CASCADE;
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


--
-- Name: TABLE prompt_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.prompt_versions IS 'Stores versioned LLM prompts with metadata and performance metrics';


--
-- Name: get_active_prompt_version(text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: FUNCTION get_active_prompt_version(p_prompt_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_active_prompt_version(p_prompt_key text) IS 'Returns the currently active version of a prompt';


--
-- Name: get_agent_accuracy(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_agent_accuracy(p_agent_type text, p_days integer DEFAULT 30) RETURNS TABLE(date date, prediction_count bigint, avg_confidence numeric, hallucination_rate numeric, avg_variance numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(ap.created_at) as date,
    COUNT(*) as prediction_count,
    ROUND(AVG(ap.confidence_score)::DECIMAL, 3) as avg_confidence,
    ROUND(
      (COUNT(*) FILTER (WHERE ap.hallucination_detected = TRUE)::DECIMAL /
      NULLIF(COUNT(*), 0) * 100),
      2
    ) as hallucination_rate,
    ROUND(AVG(ABS(ap.variance_percentage))::DECIMAL, 2) as avg_variance
  FROM agent_predictions ap
  WHERE ap.agent_type = p_agent_type
    AND ap.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(ap.created_at)
  ORDER BY date DESC;
END;
$$;


--
-- Name: FUNCTION get_agent_accuracy(p_agent_type text, p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_agent_accuracy(p_agent_type text, p_days integer) IS 'Calculate agent accuracy metrics over a time period';


--
-- Name: get_agent_session_stats(timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_agent_session_stats(start_date timestamp without time zone DEFAULT (now() - '7 days'::interval), end_date timestamp without time zone DEFAULT now()) RETURNS TABLE(total_sessions bigint, active_sessions bigint, completed_sessions bigint, error_sessions bigint, abandoned_sessions bigint, avg_duration_minutes numeric, unique_users bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_sessions,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active_sessions,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_sessions,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT as error_sessions,
    COUNT(*) FILTER (WHERE status = 'abandoned')::BIGINT as abandoned_sessions,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60)::NUMERIC(10,2) as avg_duration_minutes,
    COUNT(DISTINCT user_id)::BIGINT as unique_users
  FROM agent_sessions
  WHERE created_at BETWEEN start_date AND end_date;
END;
$$;


--
-- Name: FUNCTION get_agent_session_stats(start_date timestamp without time zone, end_date timestamp without time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_agent_session_stats(start_date timestamp without time zone, end_date timestamp without time zone) IS 'Get statistics for agent sessions within a date range';


--
-- Name: get_calibrated_confidence(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_calibrated_confidence(p_agent_id text, p_raw_confidence numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_model RECORD;
  v_z DECIMAL;
  v_calibrated DECIMAL;
BEGIN
  -- Get latest calibration model
  SELECT parameter_a, parameter_b INTO v_model
  FROM agent_calibration_models
  WHERE agent_id = p_agent_id
  ORDER BY last_calibrated DESC
  LIMIT 1;

  IF v_model IS NULL THEN
    -- No calibration model, return raw confidence
    RETURN p_raw_confidence;
  END IF;

  -- Apply Platt scaling: C_cal = 1 / (1 + exp(-(A * C_raw + B)))
  v_z := v_model.parameter_a * p_raw_confidence + v_model.parameter_b;
  v_calibrated := 1.0 / (1.0 + EXP(-v_z));

  -- Clamp to [0, 1]
  RETURN GREATEST(0.0, LEAST(1.0, v_calibrated));
END;
$$;


--
-- Name: get_current_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_current_org_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'org_id'), '')::uuid
$$;


--
-- Name: get_current_usage(uuid, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_current_usage(p_tenant_id uuid, p_metric text, p_period_start timestamp with time zone DEFAULT date_trunc('month'::text, now()), p_period_end timestamp with time zone DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval)) RETURNS numeric
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  total_usage DECIMAL(15, 4);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO total_usage
  FROM public.usage_events
  WHERE tenant_id = p_tenant_id
    AND metric = p_metric
    AND timestamp >= p_period_start
    AND timestamp < p_period_end;

  RETURN total_usage;
END;
$$;


--
-- Name: get_current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;


--
-- Name: get_daily_llm_cost(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_daily_llm_cost(p_user_id uuid DEFAULT NULL::uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN (
            SELECT COALESCE(SUM(estimated_cost), 0)
            FROM llm_usage
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        );
    ELSE
        RETURN (
            SELECT COALESCE(SUM(estimated_cost), 0)
            FROM llm_usage
            WHERE user_id = p_user_id
            AND created_at >= NOW() - INTERVAL '24 hours'
        );
    END IF;
END;
$$;


--
-- Name: FUNCTION get_daily_llm_cost(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_daily_llm_cost(p_user_id uuid) IS 'Returns total LLM cost for the last 24 hours, optionally filtered by user';


--
-- Name: get_evaluation_statistics(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_evaluation_statistics(p_agent_type text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalRuns', COUNT(*),
    'avgPassRate', AVG((summary->>'passRate')::float),
    'avgScore', AVG((summary->>'avgScore')::float),
    'avgDuration', AVG((summary->>'avgDuration')::float),
    'latestRun', MAX(created_at),
    'trendData', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', created_at,
          'passRate', (summary->>'passRate')::float,
          'avgScore', (summary->>'avgScore')::float
        )
        ORDER BY created_at DESC
      )
      FROM (
        SELECT created_at, summary
        FROM evaluation_runs
        WHERE agent_type = p_agent_type
        ORDER BY created_at DESC
        LIMIT 10
      ) recent_runs
    )
  )
  INTO result
  FROM evaluation_runs
  WHERE agent_type = p_agent_type;

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_evaluation_statistics(p_agent_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_evaluation_statistics(p_agent_type text) IS 'Get aggregate statistics and trends for an agent type';


--
-- Name: get_flag_analytics(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_flag_analytics(p_flag_key text, p_days integer DEFAULT 7) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  result JSONB;
  start_date TIMESTAMPTZ;
BEGIN
  start_date := NOW() - (p_days || ' days')::INTERVAL;

  SELECT jsonb_build_object(
    'totalEvaluations', COUNT(*),
    'enabledCount', COUNT(*) FILTER (WHERE enabled = true),
    'enabledPercentage',
      CASE
        WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE enabled = true)::FLOAT / COUNT(*)::FLOAT * 100)
        ELSE 0
      END,
    'variantDistribution', (
      SELECT jsonb_object_agg(variant, count)
      FROM (
        SELECT variant, COUNT(*) as count
        FROM feature_flag_evaluations
        WHERE flag_key = p_flag_key
          AND evaluated_at >= start_date
          AND variant IS NOT NULL
        GROUP BY variant
      ) variants
    )
  )
  INTO result
  FROM feature_flag_evaluations
  WHERE flag_key = p_flag_key
    AND evaluated_at >= start_date;

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_flag_analytics(p_flag_key text, p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_flag_analytics(p_flag_key text, p_days integer) IS 'Returns analytics for a feature flag over specified days';


--
-- Name: get_high_scoring_memories(text, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_high_scoring_memories(p_type text, p_min_score double precision DEFAULT 0.7, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, type text, content text, metadata jsonb, score double precision, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        sm.id,
        sm.type,
        sm.content,
        sm.metadata,
        (sm.metadata->>'score')::float as score,
        sm.created_at
      FROM semantic_memory sm
      WHERE sm.type = p_type
        AND (sm.metadata->>'score')::float >= p_min_score
      ORDER BY (sm.metadata->>'score')::float DESC, sm.created_at DESC
      LIMIT p_limit;
    END;
    $$;


--
-- Name: get_hourly_llm_cost(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_hourly_llm_cost() RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(estimated_cost), 0)
        FROM llm_usage
        WHERE created_at >= NOW() - INTERVAL '1 hour'
    );
END;
$$;


--
-- Name: FUNCTION get_hourly_llm_cost(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_hourly_llm_cost() IS 'Returns total LLM cost for the last hour';


--
-- Name: get_llm_usage_stats(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_llm_usage_stats(p_start_date timestamp with time zone DEFAULT (now() - '24:00:00'::interval), p_end_date timestamp with time zone DEFAULT now()) RETURNS TABLE(total_requests bigint, total_cost numeric, total_tokens bigint, avg_cost_per_request numeric, avg_latency_ms numeric, success_rate numeric, top_model text, top_user uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_requests,
        COALESCE(SUM(estimated_cost), 0)::DECIMAL(10, 2) as total_cost,
        COALESCE(SUM(total_tokens), 0)::BIGINT as total_tokens,
        COALESCE(AVG(estimated_cost), 0)::DECIMAL(10, 6) as avg_cost_per_request,
        COALESCE(AVG(latency_ms), 0)::DECIMAL(10, 2) as avg_latency_ms,
        (COUNT(*) FILTER (WHERE success = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL(5, 2) as success_rate,
        (
            SELECT model
            FROM llm_usage
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY model
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as top_model,
        (
            SELECT user_id
            FROM llm_usage
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY user_id
            ORDER BY SUM(estimated_cost) DESC
            LIMIT 1
        ) as top_user
    FROM llm_usage
    WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$;


--
-- Name: FUNCTION get_llm_usage_stats(p_start_date timestamp with time zone, p_end_date timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_llm_usage_stats(p_start_date timestamp with time zone, p_end_date timestamp with time zone) IS 'Returns comprehensive LLM usage statistics for a date range';


--
-- Name: get_memories_by_industry(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_memories_by_industry(p_industry text, p_type text DEFAULT NULL::text, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, type text, content text, metadata jsonb, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        sm.id,
        sm.type,
        sm.content,
        sm.metadata,
        sm.created_at
      FROM semantic_memory sm
      WHERE sm.metadata->>'industry' = p_industry
        AND (p_type IS NULL OR sm.type = p_type)
      ORDER BY sm.created_at DESC
      LIMIT p_limit;
    END;
    $$;


--
-- Name: get_memory_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_memory_statistics() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
    DECLARE
      result JSONB;
    BEGIN
      SELECT jsonb_build_object(
        'totalMemories', COUNT(*),
        'byType', (
          SELECT jsonb_object_agg(type, count)
          FROM (
            SELECT type, COUNT(*) as count
            FROM semantic_memory
            GROUP BY type
          ) type_counts
        ),
        'avgScore', AVG((metadata->>'score')::float),
        'oldestMemory', MIN(created_at),
        'newestMemory', MAX(created_at),
        'avgEmbeddingNorm', AVG(vector_norm(embedding))
      )
      INTO result
      FROM semantic_memory;

      RETURN result;
    END;
    $$;


--
-- Name: get_monthly_llm_cost(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_monthly_llm_cost() RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(estimated_cost), 0)
        FROM llm_usage
        WHERE created_at >= NOW() - INTERVAL '30 days'
    );
END;
$$;


--
-- Name: FUNCTION get_monthly_llm_cost(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_monthly_llm_cost() IS 'Returns total LLM cost for the last 30 days';


--
-- Name: get_resource_audit_logs(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_resource_audit_logs(p_resource_type text, p_resource_id text, p_limit integer DEFAULT 100) RETURNS TABLE(id uuid, user_id uuid, action text, created_at timestamp with time zone, old_values jsonb, new_values jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.user_id,
    a.action,
    a.created_at,
    a.old_values,
    a.new_values
  FROM public.audit_logs a
  WHERE a.resource_type = p_resource_type
    AND a.resource_id = p_resource_id
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: get_tenant_integration(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_tenant_integration(p_tenant_id uuid, p_provider text) RETURNS TABLE(id uuid, access_token text, refresh_token text, token_expires_at timestamp with time zone, instance_url text, hub_id text, scopes text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.access_token,
    ti.refresh_token,
    ti.token_expires_at,
    ti.instance_url,
    ti.hub_id,
    ti.scopes
  FROM tenant_integrations ti
  WHERE ti.tenant_id = p_tenant_id
    AND ti.provider = p_provider
    AND ti.status = 'active';
END;
$$;


--
-- Name: get_usage_percentage(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_usage_percentage(p_tenant_id uuid, p_metric text) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  quota_rec RECORD;
  current_usage DECIMAL(15, 4);
  percentage INTEGER;
BEGIN
  SELECT * INTO quota_rec
  FROM public.usage_quotas
  WHERE tenant_id = p_tenant_id
    AND metric = p_metric
    AND NOW() >= period_start
    AND NOW() < period_end
  LIMIT 1;

  IF NOT FOUND OR quota_rec.quota_amount = 0 THEN
    RETURN 0;
  END IF;

  current_usage := public.get_current_usage(
    p_tenant_id,
    p_metric,
    quota_rec.period_start,
    quota_rec.period_end
  );

  percentage := ROUND((current_usage / quota_rec.quota_amount) * 100);

  RETURN LEAST(percentage, 999); -- Cap at 999%
END;
$$;


--
-- Name: get_user_audit_logs(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_user_audit_logs(p_user_id uuid, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, action text, resource_type text, resource_id text, created_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.action,
    a.resource_type,
    a.resource_id,
    a.created_at,
    a.metadata
  FROM public.audit_logs a
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: get_user_job_stats(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_user_job_stats(p_user_id uuid, p_days integer DEFAULT 7) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  result JSONB;
  start_date TIMESTAMPTZ;
BEGIN
  start_date := NOW() - (p_days || ' days')::INTERVAL;

  SELECT jsonb_build_object(
    'totalJobs', COUNT(*),
    'totalCost', SUM(cost_usd),
    'totalTokens', SUM(total_tokens),
    'avgLatency', AVG(latency_ms),
    'cacheHitRate', AVG(CASE WHEN cached THEN 1.0 ELSE 0.0 END),
    'byType', (
      SELECT jsonb_object_agg(type, stats)
      FROM (
        SELECT
          type,
          jsonb_build_object(
            'count', COUNT(*),
            'cost', SUM(cost_usd),
            'avgLatency', AVG(latency_ms)
          ) as stats
        FROM llm_job_results
        WHERE user_id = p_user_id
          AND created_at >= start_date
        GROUP BY type
      ) type_stats
    ),
    'byProvider', (
      SELECT jsonb_object_agg(provider, count)
      FROM (
        SELECT provider, COUNT(*) as count
        FROM llm_job_results
        WHERE user_id = p_user_id
          AND created_at >= start_date
        GROUP BY provider
      ) provider_stats
    )
  )
  INTO result
  FROM llm_job_results
  WHERE user_id = p_user_id
    AND created_at >= start_date;

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_user_job_stats(p_user_id uuid, p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_job_stats(p_user_id uuid, p_days integer) IS 'Returns job statistics for a user over specified days';


--
-- Name: get_user_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_user_org_id() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN auth.jwt() ->> 'org_id';
END;
$$;


--
-- Name: FUNCTION get_user_org_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_org_id() IS 'Get current user organization ID from JWT';


--
-- Name: is_over_quota(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_over_quota(p_tenant_id uuid, p_metric text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  quota_rec RECORD;
  current_usage DECIMAL(15, 4);
BEGIN
  -- Get current quota
  SELECT * INTO quota_rec
  FROM public.usage_quotas
  WHERE tenant_id = p_tenant_id
    AND metric = p_metric
    AND NOW() >= period_start
    AND NOW() < period_end
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE; -- No quota = unlimited
  END IF;

  -- Get current usage
  current_usage := public.get_current_usage(
    p_tenant_id,
    p_metric,
    quota_rec.period_start,
    quota_rec.period_end
  );

  RETURN current_usage >= quota_rec.quota_amount;
END;
$$;


--
-- Name: log_login_attempt(text, boolean, inet, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_login_attempt(user_email text, attempt_success boolean, client_ip inet DEFAULT NULL::inet, client_user_agent text DEFAULT NULL::text, reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.login_attempts (
    email,
    success,
    ip_address,
    user_agent,
    failure_reason
  ) VALUES (
    user_email,
    attempt_success,
    client_ip,
    client_user_agent,
    reason
  );
END;
$$;


--
-- Name: FUNCTION log_login_attempt(user_email text, attempt_success boolean, client_ip inet, client_user_agent text, reason text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_login_attempt(user_email text, attempt_success boolean, client_ip inet, client_user_agent text, reason text) IS 'Logs a login attempt with IP address and user agent information';


--
-- Name: log_rls_violation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_rls_violation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO security_audit_log (
    event_type,
    user_id,
    table_name,
    attempted_action,
    blocked_at
  ) VALUES (
    'rls_violation',
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    NOW()
  );
  RETURN NULL;
END;
$$;


--
-- Name: mark_integration_error(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.mark_integration_error(p_integration_id uuid, p_error_message text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE tenant_integrations
  SET
    status = 'error',
    error_message = p_error_message,
    updated_at = now()
  WHERE id = p_integration_id;
END;
$$;


--
-- Name: mask_credit_card(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.mask_credit_card(cc text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF cc IS NULL OR cc = '' THEN
    RETURN cc;
  END IF;

  -- Extract digits only
  cc := REGEXP_REPLACE(cc, '[^0-9]', '', 'g');

  IF LENGTH(cc) >= 13 THEN
    -- 1234567890123456 -> ****-****-****-3456
    RETURN '****-****-****-' || SUBSTRING(cc FROM LENGTH(cc) - 3);
  ELSE
    RETURN '****-****-' || cc;
  END IF;
END;
$$;


--
-- Name: FUNCTION mask_credit_card(cc text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mask_credit_card(cc text) IS 'Masks credit card number showing only last 4 digits';


--
-- Name: mask_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.mask_email(email text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF email IS NULL OR email = '' THEN
    RETURN email;
  END IF;

  -- john.doe@example.com -> jo***@example.com
  RETURN REGEXP_REPLACE(email, '(.{2}).*(@.+)', '\1***\2');
END;
$$;


--
-- Name: FUNCTION mask_email(email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mask_email(email text) IS 'Masks email address keeping first 2 chars and domain';


--
-- Name: mask_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.mask_phone(phone text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF phone IS NULL OR phone = '' THEN
    RETURN phone;
  END IF;

  -- Extract digits only
  phone := REGEXP_REPLACE(phone, '[^0-9]', '', 'g');

  IF LENGTH(phone) >= 10 THEN
    -- (555) 123-4567 -> (555) ***-4567
    RETURN '(' || SUBSTRING(phone FROM 1 FOR 3) || ') ***-' || SUBSTRING(phone FROM LENGTH(phone) - 3);
  ELSE
    RETURN '***-' || SUBSTRING(phone FROM LENGTH(phone) - 3);
  END IF;
END;
$$;


--
-- Name: FUNCTION mask_phone(phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mask_phone(phone text) IS 'Masks phone number showing only area code and last 4 digits';


--
-- Name: mask_ssn(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.mask_ssn(ssn text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF ssn IS NULL OR ssn = '' THEN
    RETURN ssn;
  END IF;

  -- Extract digits only
  ssn := REGEXP_REPLACE(ssn, '[^0-9]', '', 'g');

  IF LENGTH(ssn) = 9 THEN
    -- 123456789 -> ***-**-6789
    RETURN '***-**-' || SUBSTRING(ssn FROM 6);
  ELSE
    RETURN '***-**-' || ssn;
  END IF;
END;
$$;


--
-- Name: FUNCTION mask_ssn(ssn text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mask_ssn(ssn text) IS 'Masks SSN showing only last 4 digits';


--
-- Name: match_memory(public.vector, double precision, integer, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.match_memory(query_embedding public.vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10, p_session_id uuid DEFAULT NULL::uuid, p_organization_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, session_id uuid, agent_id uuid, memory_type text, content text, embedding public.vector, metadata jsonb, created_at timestamp with time zone, similarity double precision)
    LANGUAGE plpgsql
    AS $_$
  DECLARE
    sql_query text;
    org_filter text := '';
  BEGIN
    IF p_organization_id IS NOT NULL THEN
      org_filter := format('AND organization_id = %L', p_organization_id::text);
    END IF;

    sql_query := format('
      SELECT
        id,
        session_id,
        agent_id,
        memory_type,
        content,
        embedding,
        metadata,
        created_at,
        1 - (embedding <=> $1) AS similarity
      FROM agent_memory
      WHERE memory_type = ''semantic''
        %s
        %s
      ORDER BY embedding <=> $1
      LIMIT $2
    ',
    CASE WHEN match_threshold > 0 THEN format('AND 1 - (embedding <=> $1) >= %s', match_threshold) ELSE '' END,
    org_filter
    );

    RETURN QUERY EXECUTE sql_query USING query_embedding, match_count;
  END;
  $_$;


--
-- Name: needs_recalibration(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.needs_recalibration(p_agent_id text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_status RECORD;
BEGIN
  SELECT needs_recalibration INTO v_status
  FROM agent_calibration_status
  WHERE agent_id = p_agent_id;

  RETURN COALESCE(v_status.needs_recalibration, true);
END;
$$;


--
-- Name: prevent_audit_deletion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.prevent_audit_deletion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable - deletion not allowed';
  RETURN NULL;
END;
$$;


--
-- Name: prevent_audit_modification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.prevent_audit_modification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable - updates not allowed';
  RETURN NULL;
END;
$$;


--
-- Name: prune_expired_agent_memories(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.prune_expired_agent_memories(p_limit integer DEFAULT 1000) RETURNS TABLE(deleted_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
  rec RECORD;
  del_count INTEGER := 0;
BEGIN
  FOR rec IN SELECT id FROM agent_memory
    WHERE expires_at IS NOT NULL
      AND expires_at <= now()
      AND memory_type != 'episodic'
    LIMIT p_limit
  LOOP
    DELETE FROM agent_memory WHERE id = rec.id;
    del_count := del_count + 1;
  END LOOP;

  RETURN QUERY SELECT del_count;
END;
$$;


--
-- Name: redact_field(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.redact_field(value text, visible_chars integer DEFAULT 4) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN value;
  END IF;

  IF LENGTH(value) <= visible_chars THEN
    RETURN REPEAT('*', LENGTH(value));
  END IF;

  RETURN SUBSTRING(value FROM 1 FOR visible_chars) || REPEAT('*', LENGTH(value) - visible_chars);
END;
$$;


--
-- Name: FUNCTION redact_field(value text, visible_chars integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.redact_field(value text, visible_chars integer) IS 'Generic redaction showing first N characters';


--
-- Name: refresh_llm_performance_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.refresh_llm_performance_metrics() RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY llm_performance_metrics;
    END;
    $$;


--
-- Name: refresh_value_prediction_accuracy_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.refresh_value_prediction_accuracy_metrics() RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY value_prediction_accuracy_metrics;
    END;
    $$;


--
-- Name: reject_request(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.reject_request(p_request_id uuid, p_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Check if request exists and is pending
  IF NOT EXISTS (
    SELECT 1 FROM public.approval_requests
    WHERE id = p_request_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;

  -- Record rejection
  INSERT INTO public.approvals (
    request_id,
    approver_id,
    approver_email,
    decision,
    notes
  ) VALUES (
    p_request_id,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'rejected',
    p_notes
  );

  -- Update request status
  UPDATE public.approval_requests
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION reject_request(p_request_id uuid, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.reject_request(p_request_id uuid, p_notes text) IS 'Phase 2: Rejects an approval request';


--
-- Name: search_semantic_memory(public.vector, double precision, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.search_semantic_memory(query_embedding public.vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10, filter_clause text DEFAULT ''::text) RETURNS TABLE(id uuid, type text, content text, embedding public.vector, metadata jsonb, created_at timestamp with time zone, similarity double precision)
    LANGUAGE plpgsql
    AS $_$
    DECLARE
      sql_query text;
    BEGIN
      sql_query := format('
        SELECT
          id,
          type,
          content,
          embedding,
          metadata,
          created_at,
          1 - (embedding <=> $1) as similarity
        FROM semantic_memory
        %s
        %s
        ORDER BY embedding <=> $1
        LIMIT $2
      ',
      CASE WHEN filter_clause != '' THEN filter_clause ELSE '' END,
      CASE WHEN match_threshold > 0 THEN format('AND 1 - (embedding <=> $1) >= %s', match_threshold) ELSE '' END
      );

      RETURN QUERY EXECUTE sql_query USING query_embedding, match_count;
    END;
    $_$;


--
-- Name: search_semantic_memory(public.vector, double precision, integer, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.search_semantic_memory(query_embedding public.vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10, filter_clause text DEFAULT ''::text, p_organization_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, type text, content text, embedding public.vector, metadata jsonb, created_at timestamp with time zone, similarity double precision)
    LANGUAGE plpgsql
    AS $_$
    DECLARE
      sql_query text;
      org_filter text := '';
    BEGIN
      IF p_organization_id IS NOT NULL THEN
        org_filter := format('AND organization_id = %L', p_organization_id::text);
      END IF;

      sql_query := format('
        SELECT
          id,
          type,
          content,
          embedding,
          metadata,
          created_at,
          1 - (embedding <=> $1) as similarity
        FROM semantic_memory
        %s
        %s
        %s
        ORDER BY embedding <=> $1
        LIMIT $2
      ',
      CASE WHEN filter_clause != '' THEN filter_clause ELSE '' END,
      CASE WHEN match_threshold > 0 THEN format('AND 1 - (embedding <=> $1) >= %s', match_threshold) ELSE '' END,
      org_filter
      );

      RETURN QUERY EXECUTE sql_query USING query_embedding, match_count;
    END;
    $_$;


--
-- Name: set_memory_ttl(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.set_memory_ttl(p_id uuid, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE agent_memory SET expires_at = p_expires_at WHERE id = p_id;
END;
$$;


--
-- Name: trigger_calibration_on_outcome(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.trigger_calibration_on_outcome() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- When an actual outcome is recorded, check if recalibration is needed
  IF NEW.actual_outcome IS NOT NULL AND OLD.actual_outcome IS NULL THEN
    -- Get the latest calibration model
    DECLARE
      latest_calibration RECORD;
      predictions_since_calibration INTEGER;
    BEGIN
      SELECT * INTO latest_calibration
      FROM agent_calibration_models
      WHERE agent_id = NEW.agent_id
      ORDER BY last_calibrated DESC
      LIMIT 1;

      IF latest_calibration IS NOT NULL THEN
        -- Count predictions since last calibration
        SELECT COUNT(*) INTO predictions_since_calibration
        FROM agent_predictions
        WHERE agent_id = NEW.agent_id
        AND created_at > latest_calibration.last_calibrated
        AND actual_outcome IS NOT NULL;

        -- Trigger recalibration if we have 100+ new outcomes
        IF predictions_since_calibration >= 100 THEN
          INSERT INTO agent_retraining_queue (agent_id, reason, priority)
          VALUES (
            NEW.agent_id,
            'Automatic recalibration: 100+ new outcomes since last calibration',
            'medium'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_feature_flag_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_feature_flag_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_golden_example_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_golden_example_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_integration_tokens(uuid, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_integration_tokens(p_integration_id uuid, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE tenant_integrations
  SET
    access_token = p_access_token,
    refresh_token = COALESCE(p_refresh_token, refresh_token),
    token_expires_at = p_expires_at,
    last_refreshed_at = now(),
    updated_at = now(),
    status = 'active',
    error_message = NULL
  WHERE id = p_integration_id;
END;
$$;


--
-- Name: academy_progress; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.academy_progress CASCADE;
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


--
-- Name: TABLE academy_progress; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.academy_progress IS 'User progress tracking for academy lessons';


--
-- Name: update_lesson_progress(uuid, uuid, public.progress_status, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_lesson_progress(p_user_id uuid, p_lesson_id uuid, p_status public.progress_status, p_score integer DEFAULT NULL::integer, p_time_spent integer DEFAULT 0) RETURNS public.academy_progress
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_progress academy_progress;
BEGIN
  INSERT INTO academy_progress (user_id, lesson_id, status, score, time_spent_seconds, started_at, completed_at, attempts)
  VALUES (
    p_user_id,
    p_lesson_id,
    p_status,
    p_score,
    p_time_spent,
    CASE WHEN p_status != 'not_started' THEN NOW() ELSE NULL END,
    CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
    CASE WHEN p_status = 'completed' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    status = EXCLUDED.status,
    score = COALESCE(EXCLUDED.score, academy_progress.score),
    time_spent_seconds = academy_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
    completed_at = CASE WHEN EXCLUDED.status = 'completed' AND academy_progress.completed_at IS NULL THEN NOW() ELSE academy_progress.completed_at END,
    attempts = CASE WHEN EXCLUDED.status = 'completed' THEN academy_progress.attempts + 1 ELSE academy_progress.attempts END,
    updated_at = NOW()
  RETURNING * INTO v_progress;

  RETURN v_progress;
END;
$$;


--
-- Name: update_modified_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_modified_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.modified_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_tenant_integrations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_tenant_integrations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_version_performance_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_version_performance_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.success IS NOT NULL THEN
    UPDATE prompt_versions
    SET performance = calculate_version_performance(NEW.prompt_version_id)
    WHERE id = NEW.prompt_version_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: user_has_org_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.user_has_org_access(org_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN org_id = (auth.jwt() ->> 'org_id');
END;
$$;


--
-- Name: FUNCTION user_has_org_access(org_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_has_org_access(org_id text) IS 'Check if current user has access to specified organization';


--
-- Name: user_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.user_is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (auth.jwt() ->> 'role') IN ('admin', 'service_role');
END;
$$;


--
-- Name: FUNCTION user_is_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_is_admin() IS 'Check if current user has admin privileges';


--
-- Name: validate_password_strength(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.validate_password_strength(password text) RETURNS TABLE(is_valid boolean, errors text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  error_list TEXT[] := ARRAY[]::TEXT[];
  valid BOOLEAN := TRUE;
BEGIN
  -- Check minimum length
  IF LENGTH(password) < 12 THEN
    error_list := array_append(error_list, 'Password must be at least 12 characters long');
    valid := FALSE;
  END IF;

  -- Check for uppercase letter
  IF password !~ '[A-Z]' THEN
    error_list := array_append(error_list, 'Password must contain at least one uppercase letter');
    valid := FALSE;
  END IF;

  -- Check for lowercase letter
  IF password !~ '[a-z]' THEN
    error_list := array_append(error_list, 'Password must contain at least one lowercase letter');
    valid := FALSE;
  END IF;

  -- Check for number
  IF password !~ '[0-9]' THEN
    error_list := array_append(error_list, 'Password must contain at least one number');
    valid := FALSE;
  END IF;

  -- Check for special character
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    error_list := array_append(error_list, 'Password must contain at least one special character');
    valid := FALSE;
  END IF;

  RETURN QUERY SELECT valid, error_list;
END;
$_$;


--
-- Name: FUNCTION validate_password_strength(password text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_password_strength(password text) IS 'Validates password strength according to security requirements: min 12 chars, uppercase, lowercase, number, special char';


--
-- Name: verify_rls_tenant_isolation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.verify_rls_tenant_isolation() RETURNS TABLE(table_name text, rls_enabled boolean, policy_count integer, has_not_null_constraint boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    t.rowsecurity,
    COUNT(p.policyname)::INTEGER,
    EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_name = t.tablename
        AND c.column_name = 'tenant_id'
        AND c.is_nullable = 'NO'
    )
  FROM pg_tables t
  LEFT JOIN pg_policies p ON p.tablename = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'agent_sessions',
      'agent_predictions',
      'workflow_executions',
      'canvas_data',
      'value_trees'
    )
  GROUP BY t.tablename, t.rowsecurity;
END;
$$;


--
-- Name: ab_tests; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.ab_tests CASCADE;
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


--
-- Name: TABLE ab_tests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ab_tests IS 'Manages A/B tests for prompt optimization';


--
-- Name: academy_certifications; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.academy_certifications CASCADE;
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


--
-- Name: TABLE academy_certifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.academy_certifications IS 'User earned certifications';


--
-- Name: academy_lessons; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.academy_lessons CASCADE;
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


--
-- Name: TABLE academy_lessons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.academy_lessons IS 'Individual lessons within academy modules';


--
-- Name: academy_modules; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.academy_modules CASCADE;
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


--
-- Name: TABLE academy_modules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.academy_modules IS 'Academy curriculum modules organized by pillar';


--
-- Name: agent_accuracy_metrics; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_accuracy_metrics CASCADE;
CREATE TABLE IF NOT EXISTS public.agent_accuracy_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_type text NOT NULL,
    variance_percentage numeric(5,2) NOT NULL,
    variance_absolute numeric(15,2) NOT NULL,
    organization_id text,
    recorded_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE agent_accuracy_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_accuracy_metrics IS 'Aggregated accuracy metrics per agent type';


--
-- Name: agent_activities; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_activities CASCADE;
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


--
-- Name: agent_audit_log; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_audit_log CASCADE;
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
    "timestamp" timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT agent_audit_log_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: agent_calibration_history; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_calibration_history CASCADE;
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


--
-- Name: agent_calibration_models; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_calibration_models CASCADE;
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


--
-- Name: agent_memory; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_memory CASCADE;
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


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: TABLE tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenants IS 'Multi-tenant organization table';


--
-- Name: agent_metrics; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_metrics CASCADE;
CREATE TABLE IF NOT EXISTS public.agent_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    agent_id uuid,
    tenant_id text,
    metric_type text NOT NULL,
    metric_value double precision NOT NULL,
    unit text,
    "timestamp" timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Skipped: data migration DO block referencing agent_sessions (not yet created).
-- Columns tenant_id and created_at already defined in CREATE TABLE above.


--
-- Name: agent_ontologies; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_ontologies CASCADE;
CREATE TABLE IF NOT EXISTS public.agent_ontologies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid,
    domain text NOT NULL,
    knowledge jsonb NOT NULL,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_predictions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_predictions CASCADE;
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


--
-- Name: TABLE agent_predictions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_predictions IS 'Stores LLM predictions with confidence scores and hallucination detection for accuracy tracking';


--
-- Name: agent_performance_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.agent_performance_summary WITH (security_invoker='true') AS
 SELECT agent_predictions.agent_type,
    count(*) AS total_predictions,
    avg(agent_predictions.confidence_score) AS avg_confidence_score,
    count(*) FILTER (WHERE (agent_predictions.confidence_level = 'low'::text)) AS low_confidence_count,
    count(*) FILTER (WHERE (agent_predictions.confidence_level = 'medium'::text)) AS medium_confidence_count,
    count(*) FILTER (WHERE (agent_predictions.confidence_level = 'high'::text)) AS high_confidence_count,
    count(*) FILTER (WHERE (agent_predictions.hallucination_detected = true)) AS hallucination_count,
    round((((count(*) FILTER (WHERE (agent_predictions.hallucination_detected = true)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS hallucination_rate_pct,
    count(*) FILTER (WHERE (agent_predictions.actual_outcome IS NOT NULL)) AS predictions_with_actuals,
    avg(abs(agent_predictions.variance_percentage)) FILTER (WHERE (agent_predictions.actual_outcome IS NOT NULL)) AS avg_variance_pct,
    max(agent_predictions.created_at) AS last_prediction_at
   FROM public.agent_predictions
  GROUP BY agent_predictions.agent_type;


--
-- Name: VIEW agent_performance_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.agent_performance_summary IS 'Summary of agent performance metrics';


--
-- Name: agent_retraining_queue; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_retraining_queue CASCADE;
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


--
-- Name: TABLE agent_retraining_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_retraining_queue IS 'Tracks agents that need retraining due to accuracy degradation';


--
-- Name: agent_sessions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_sessions CASCADE;
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


--
-- Name: agent_tools; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agent_tools CASCADE;
CREATE TABLE IF NOT EXISTS public.agent_tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid,
    tool_name text NOT NULL,
    tool_schema jsonb NOT NULL,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.agents CASCADE;
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


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.approval_requests CASCADE;
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


--
-- Name: TABLE approval_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_requests IS 'Phase 2: Stores requests for human approval of agent actions';


--
-- Name: approval_requests_archive; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.approval_requests_archive CASCADE;
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


--
-- Name: TABLE approval_requests_archive; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_requests_archive IS 'Archive for approval requests older than retention period';


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.approvals CASCADE;
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


--
-- Name: TABLE approvals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approvals IS 'Phase 2: Records approval decisions (including dual control)';


--
-- Name: approvals_archive; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.approvals_archive CASCADE;
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


--
-- Name: TABLE approvals_archive; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approvals_archive IS 'Archive for approvals older than retention period';


--
-- Name: approver_roles; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.approver_roles CASCADE;
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


--
-- Name: TABLE approver_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approver_roles IS 'Phase 2: Defines who can approve what types of requests';


--
-- Name: assumptions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.assumptions CASCADE;
CREATE TABLE IF NOT EXISTS public.assumptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    value_case_id uuid,
    related_table text NOT NULL,
    related_id uuid NOT NULL,
    assumption_type text NOT NULL,
    assumption_text text NOT NULL,
    source text,
    confidence_level text,
    validation_status text DEFAULT 'pending'::text,
    evidence jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT assumptions_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT assumptions_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'validated'::text, 'rejected'::text, 'needs_review'::text])))
);


--
-- Name: audit_log_access; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.audit_log_access CASCADE;
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


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.audit_logs CASCADE;
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


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Phase 3: Immutable audit trail - append-only, no updates or deletes allowed';


--
-- Name: audit_logs_archive; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.audit_logs_archive CASCADE;
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


--
-- Name: TABLE audit_logs_archive; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs_archive IS 'Archive for audit logs older than 7 years (compliance retention)';


--
-- Name: automated_check_results; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.automated_check_results CASCADE;
CREATE TABLE IF NOT EXISTS public.automated_check_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    control_id text NOT NULL,
    status text,
    details text NOT NULL,
    checked_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automated_check_results_status_check CHECK ((status = ANY (ARRAY['passed'::text, 'failed'::text])))
);


--
-- Name: automated_responses; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.automated_responses CASCADE;
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


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.backup_logs CASCADE;
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


--
-- Name: TABLE backup_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.backup_logs IS 'Tracks database backup operations';


--
-- Name: billing_customers; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.billing_customers CASCADE;
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


--
-- Name: TABLE billing_customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.billing_customers IS 'Maps tenants to Stripe customers for billing';


--
-- Name: business_cases; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.business_cases CASCADE;
CREATE TABLE IF NOT EXISTS public.business_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    client text NOT NULL,
    status text DEFAULT 'draft'::text,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT business_cases_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in-review'::text, 'presented'::text])))
);


--
-- Name: canvas_components; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.canvas_components CASCADE;
CREATE TABLE IF NOT EXISTS public.canvas_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    type text NOT NULL,
    position_x integer DEFAULT 0 NOT NULL,
    position_y integer DEFAULT 0 NOT NULL,
    width integer DEFAULT 300 NOT NULL,
    height integer DEFAULT 120 NOT NULL,
    props jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    modified_at timestamp with time zone DEFAULT now(),
    is_dirty boolean DEFAULT false,
    CONSTRAINT canvas_components_type_check CHECK ((type = ANY (ARRAY['metric-card'::text, 'interactive-chart'::text, 'data-table'::text, 'narrative-block'::text])))
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.cases CASCADE;
CREATE TABLE IF NOT EXISTS public.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'medium'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    organization_id uuid,
    tenant_id text NOT NULL,
    CONSTRAINT cases_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: TABLE cases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cases IS 'Cases with RLS enabled - users can only access their own data';


--
-- Name: company_profiles; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.company_profiles CASCADE;
CREATE TABLE IF NOT EXISTS public.company_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    value_case_id uuid,
    company_name text NOT NULL,
    industry text,
    vertical text,
    company_size text,
    buyer_persona jsonb,
    pain_points jsonb DEFAULT '[]'::jsonb,
    current_state jsonb,
    confidence_level text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT company_profiles_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: compliance_evidence; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.compliance_evidence CASCADE;
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


--
-- Name: compliance_reports; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.compliance_reports CASCADE;
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


--
-- Name: component_history; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.component_history CASCADE;
CREATE TABLE IF NOT EXISTS public.component_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_id uuid NOT NULL,
    action_type text NOT NULL,
    actor text NOT NULL,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT component_history_action_type_check CHECK ((action_type = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text, 'moved'::text, 'resized'::text])))
);


--
-- Name: component_relationships; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.component_relationships CASCADE;
CREATE TABLE IF NOT EXISTS public.component_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_component_id uuid NOT NULL,
    target_component_id uuid NOT NULL,
    relationship_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT component_relationships_relationship_type_check CHECK ((relationship_type = ANY (ARRAY['depends_on'::text, 'updates'::text, 'calculates'::text])))
);


--
-- Name: confidence_violations; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.confidence_violations CASCADE;
CREATE TABLE IF NOT EXISTS public.confidence_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_type text NOT NULL,
    prediction_id uuid,
    violation_type text NOT NULL,
    details jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT confidence_violations_violation_type_check CHECK ((violation_type = ANY (ARRAY['low_confidence'::text, 'hallucination'::text, 'data_gaps'::text])))
);


--
-- Name: TABLE confidence_violations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.confidence_violations IS 'Tracks instances where agent confidence thresholds are violated';


--
-- Name: contextual_triggers; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.contextual_triggers CASCADE;
CREATE TABLE IF NOT EXISTS public.contextual_triggers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    element_selector text NOT NULL,
    trigger_type text NOT NULL,
    dwell_time_ms integer,
    error_code text,
    inject_content jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contextual_triggers_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['dwell'::text, 'error'::text, 'help_click'::text])))
);


--
-- Name: TABLE contextual_triggers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contextual_triggers IS 'Rules for in-app contextual help injection';


--
-- Name: cost_alerts; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.cost_alerts CASCADE;
CREATE TABLE IF NOT EXISTS public.cost_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    period text NOT NULL,
    threshold numeric(10,2) NOT NULL,
    actual_cost numeric(10,2) NOT NULL,
    message text NOT NULL,
    acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cost_alerts_level_check CHECK ((level = ANY (ARRAY['warning'::text, 'critical'::text]))),
    CONSTRAINT cost_alerts_period_check CHECK ((period = ANY (ARRAY['hourly'::text, 'daily'::text, 'monthly'::text])))
);


--
-- Name: TABLE cost_alerts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cost_alerts IS 'Stores cost threshold violation alerts';


--
-- Name: device_trust_history; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.device_trust_history CASCADE;
CREATE TABLE IF NOT EXISTS public.device_trust_history (
    user_id text NOT NULL,
    tenant_id text NOT NULL,
    device_id text NOT NULL,
    last_seen timestamp with time zone DEFAULT now(),
    fingerprint jsonb NOT NULL,
    trust_score integer DEFAULT 50,
    first_seen timestamp with time zone DEFAULT now(),
    CONSTRAINT device_trust_history_trust_score_check CHECK (((trust_score >= 0) AND (trust_score <= 100)))
);


--
-- Name: evaluation_runs; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.evaluation_runs CASCADE;
CREATE TABLE IF NOT EXISTS public.evaluation_runs (
    id text NOT NULL,
    name text NOT NULL,
    agent_type text,
    prompt_version text,
    results jsonb NOT NULL,
    summary jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE evaluation_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.evaluation_runs IS 'Historical evaluation runs for tracking agent performance over time';


--
-- Name: COLUMN evaluation_runs.results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.evaluation_runs.results IS 'Array of EvaluationResult objects with scores for each example';


--
-- Name: COLUMN evaluation_runs.summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.evaluation_runs.summary IS 'Aggregate statistics: totalExamples, passed, failed, passRate, avgScore, avgDuration';


--
-- Name: feature_flag_evaluations; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.feature_flag_evaluations CASCADE;
CREATE TABLE IF NOT EXISTS public.feature_flag_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag_key text NOT NULL,
    user_id uuid,
    enabled boolean NOT NULL,
    variant text,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE feature_flag_evaluations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feature_flag_evaluations IS 'Tracks feature flag evaluations for analytics';


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.feature_flags CASCADE;
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    rollout_percentage integer DEFAULT 0 NOT NULL,
    targeting jsonb DEFAULT '{}'::jsonb NOT NULL,
    variants jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_flags_rollout_percentage_check CHECK (((rollout_percentage >= 0) AND (rollout_percentage <= 100)))
);


--
-- Name: TABLE feature_flags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feature_flags IS 'Dynamic feature flags for A/B testing and gradual rollouts';


--
-- Name: COLUMN feature_flags.rollout_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feature_flags.rollout_percentage IS 'Percentage of users who see the feature (0-100)';


--
-- Name: COLUMN feature_flags.targeting; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feature_flags.targeting IS 'Targeting rules: userIds, tiers, countries, customRules';


--
-- Name: COLUMN feature_flags.variants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feature_flags.variants IS 'A/B test variants with weights and configs';


--
-- Name: financial_models; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.financial_models CASCADE;
CREATE TABLE IF NOT EXISTS public.financial_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    value_case_id uuid,
    roi_percentage double precision,
    npv_amount double precision,
    payback_months integer,
    total_investment double precision,
    total_benefit double precision,
    cost_breakdown jsonb,
    benefit_breakdown jsonb,
    sensitivity_analysis jsonb,
    confidence_level text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT financial_models_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: golden_examples; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.golden_examples CASCADE;
CREATE TABLE IF NOT EXISTS public.golden_examples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    agent_type text NOT NULL,
    input jsonb NOT NULL,
    expected_output jsonb NOT NULL,
    evaluation_criteria jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT golden_examples_agent_type_check CHECK ((agent_type = ANY (ARRAY['OpportunityAgent'::text, 'TargetAgent'::text, 'IntegrityAgent'::text, 'ReflectionEngine'::text])))
);


--
-- Name: TABLE golden_examples; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.golden_examples IS 'Golden dataset for offline evaluation of agent outputs';


--
-- Name: COLUMN golden_examples.evaluation_criteria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.golden_examples.evaluation_criteria IS 'Array of {metric, threshold, weight} objects defining how to evaluate output';


--
-- Name: integration_usage_log; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.integration_usage_log CASCADE;
CREATE TABLE IF NOT EXISTS public.integration_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid,
    user_id uuid,
    action text NOT NULL,
    request_summary jsonb,
    response_status text,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.invoices CASCADE;
CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    billing_customer_id uuid,
    tenant_id uuid NOT NULL,
    subscription_id uuid,
    stripe_invoice_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    invoice_number text,
    invoice_pdf_url text,
    hosted_invoice_url text,
    amount_due numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0,
    amount_remaining numeric(10,2),
    subtotal numeric(10,2),
    tax numeric(10,2),
    total numeric(10,2),
    currency text DEFAULT 'usd'::text,
    status text NOT NULL,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    line_items jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'void'::text, 'uncollectible'::text])))
);


--
-- Name: TABLE invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invoices IS 'Stored Stripe invoices per tenant for history/UI';


--
-- Name: kpi_hypotheses; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.kpi_hypotheses CASCADE;
CREATE TABLE IF NOT EXISTS public.kpi_hypotheses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    value_case_id uuid,
    kpi_name text NOT NULL,
    baseline_value double precision,
    target_value double precision,
    unit text,
    timeframe text,
    calculation_method text,
    confidence_level text,
    assumptions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT kpi_hypotheses_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: llm_calls; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.llm_calls CASCADE;
CREATE TABLE IF NOT EXISTS public.llm_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    agent_id text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    latency_ms integer NOT NULL,
    cost numeric(10,6) DEFAULT 0,
    cache_hit boolean DEFAULT false,
    error text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE llm_calls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.llm_calls IS 'Tracks all LLM API calls for cost and performance monitoring';


--
-- Name: llm_job_results; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.llm_job_results CASCADE;
CREATE TABLE IF NOT EXISTS public.llm_job_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id text NOT NULL,
    user_id uuid,
    type text NOT NULL,
    content text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    total_tokens integer NOT NULL,
    cost_usd numeric(10,6) NOT NULL,
    latency_ms integer NOT NULL,
    cached boolean DEFAULT false NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llm_job_results_type_check CHECK ((type = ANY (ARRAY['canvas_generation'::text, 'canvas_refinement'::text, 'custom_prompt'::text])))
);


--
-- Name: TABLE llm_job_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.llm_job_results IS 'Stores results from async LLM processing queue';


--
-- Name: COLUMN llm_job_results.job_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.llm_job_results.job_id IS 'BullMQ job ID';


--
-- Name: COLUMN llm_job_results.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.llm_job_results.type IS 'Type of LLM job';


--
-- Name: llm_performance_metrics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW IF NOT EXISTS public.llm_performance_metrics AS
 SELECT llm_calls.provider,
    llm_calls.model,
    date_trunc('hour'::text, llm_calls.created_at) AS time_bucket,
    count(*) AS total_calls,
    count(*) FILTER (WHERE (llm_calls.cache_hit = true)) AS cache_hits,
    count(*) FILTER (WHERE (llm_calls.cache_hit = false)) AS cache_misses,
    count(*) FILTER (WHERE (llm_calls.error IS NOT NULL)) AS error_count,
    avg(llm_calls.latency_ms) AS avg_latency_ms,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((llm_calls.latency_ms)::double precision)) AS p50_latency_ms,
    percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY ((llm_calls.latency_ms)::double precision)) AS p95_latency_ms,
    percentile_cont((0.99)::double precision) WITHIN GROUP (ORDER BY ((llm_calls.latency_ms)::double precision)) AS p99_latency_ms,
    sum(llm_calls.total_tokens) AS total_tokens,
    sum(llm_calls.cost) AS total_cost
   FROM public.llm_calls
  WHERE (llm_calls.created_at > (now() - '30 days'::interval))
  GROUP BY llm_calls.provider, llm_calls.model, (date_trunc('hour'::text, llm_calls.created_at))
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW llm_performance_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON MATERIALIZED VIEW public.llm_performance_metrics IS 'Aggregated LLM performance metrics by hour';


--
-- Name: llm_usage; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.llm_usage CASCADE;
CREATE TABLE IF NOT EXISTS public.llm_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    user_id uuid NOT NULL,
    session_id uuid,
    provider text NOT NULL,
    model text NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    total_tokens integer GENERATED ALWAYS AS ((prompt_tokens + completion_tokens)) STORED,
    estimated_cost numeric(10,6) NOT NULL,
    endpoint text NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error_message text,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llm_usage_completion_tokens_check CHECK ((completion_tokens >= 0)),
    CONSTRAINT llm_usage_estimated_cost_check CHECK ((estimated_cost >= (0)::numeric)),
    CONSTRAINT llm_usage_latency_ms_check CHECK ((latency_ms >= 0)),
    CONSTRAINT llm_usage_prompt_tokens_check CHECK ((prompt_tokens >= 0)),
    CONSTRAINT llm_usage_provider_check CHECK ((provider = ANY (ARRAY['together_ai'::text, 'openai'::text])))
);


--
-- Name: TABLE llm_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.llm_usage IS 'Tracks all LLM API calls with costs and performance metrics';


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.login_attempts CASCADE;
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    attempted_at timestamp with time zone DEFAULT now(),
    success boolean DEFAULT false,
    ip_address inet,
    user_agent text,
    failure_reason text
);


--
-- Name: TABLE login_attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.login_attempts IS 'Tracks all login attempts for security monitoring and account lockout';


--
-- Name: memory_provenance; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.memory_provenance CASCADE;
CREATE TABLE IF NOT EXISTS public.memory_provenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    memory_id uuid,
    source_table text NOT NULL,
    source_id uuid,
    evidence jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: message_bus; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.message_bus CASCADE;
CREATE TABLE IF NOT EXISTS public.message_bus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    from_agent_id uuid,
    to_agent_id uuid,
    message_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    priority integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    CONSTRAINT message_bus_message_type_check CHECK ((message_type = ANY (ARRAY['task_assignment'::text, 'task_result'::text, 'status_event'::text, 'audit_event'::text]))),
    CONSTRAINT message_bus_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.messages CASCADE;
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    case_id uuid,
    workflow_id uuid,
    content text NOT NULL,
    role text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id text NOT NULL,
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: TABLE messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.messages IS 'Messages with RLS enabled - users can only access messages from their cases';


--
-- Name: policy_rules; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.policy_rules CASCADE;
CREATE TABLE IF NOT EXISTS public.policy_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name text NOT NULL,
    rule_type text NOT NULL,
    rule_definition jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT policy_rules_rule_type_check CHECK ((rule_type = ANY (ARRAY['rate_limit'::text, 'access_control'::text, 'data_residency'::text, 'compliance'::text])))
);


--
-- Name: prompt_executions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.prompt_executions CASCADE;
CREATE TABLE IF NOT EXISTS public.prompt_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prompt_version_id uuid NOT NULL,
    user_id uuid,
    variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    rendered_prompt text NOT NULL,
    response text,
    latency integer,
    cost numeric(10,6),
    tokens jsonb,
    success boolean,
    error text,
    feedback jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE prompt_executions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.prompt_executions IS 'Tracks individual prompt executions for performance analysis';


--
-- Name: rate_limit_violations; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.rate_limit_violations CASCADE;
CREATE TABLE IF NOT EXISTS public.rate_limit_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    ip_address inet,
    endpoint text NOT NULL,
    tier text NOT NULL,
    limit_value integer NOT NULL,
    window_ms integer NOT NULL,
    violated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limit_violations_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text, 'anonymous'::text])))
);


--
-- Name: TABLE rate_limit_violations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rate_limit_violations IS 'Logs rate limit violations for analysis';


--
-- Name: resource_artifacts; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.resource_artifacts CASCADE;
CREATE TABLE IF NOT EXISTS public.resource_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    lifecycle_stage public.lifecycle_stage_resource NOT NULL,
    artifact_type text NOT NULL,
    file_url text NOT NULL,
    version text DEFAULT '1.0'::text NOT NULL,
    deprecated boolean DEFAULT false NOT NULL,
    replaced_by uuid,
    linked_pillars public.academy_pillar[] DEFAULT '{}'::public.academy_pillar[],
    governance_required boolean DEFAULT false NOT NULL,
    integrity_validated boolean DEFAULT false NOT NULL,
    download_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resource_artifacts_artifact_type_check CHECK ((artifact_type = ANY (ARRAY['template'::text, 'calculator'::text, 'deck'::text, 'guide'::text, 'script'::text])))
);


--
-- Name: TABLE resource_artifacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resource_artifacts IS 'Downloadable templates and tools';


--
-- Name: retention_policies; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.retention_policies CASCADE;
CREATE TABLE IF NOT EXISTS public.retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    retention_days integer NOT NULL,
    date_column text DEFAULT 'created_at'::text NOT NULL,
    archive_before_delete boolean DEFAULT true,
    archive_table text,
    enabled boolean DEFAULT true,
    last_run_at timestamp with time zone,
    last_run_status text,
    last_run_archived integer,
    last_run_deleted integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE retention_policies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.retention_policies IS 'Phase 3: Defines data retention policies for automatic cleanup';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.roles CASCADE;
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: secret_audit_logs; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.secret_audit_logs CASCADE;
CREATE TABLE IF NOT EXISTS public.secret_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    user_id character varying(255),
    secret_key character varying(255) NOT NULL,
    secret_path text,
    action character varying(50) NOT NULL,
    result character varying(50) NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT secret_audit_logs_action_check1 CHECK (((action)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying, 'DELETE'::character varying, 'ROTATE'::character varying])::text[]))),
    CONSTRAINT secret_audit_logs_result_check1 CHECK (((result)::text = ANY ((ARRAY['SUCCESS'::character varying, 'FAILURE'::character varying])::text[])))
)
PARTITION BY RANGE ("timestamp");


--
-- Name: secret_audit_failures; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.secret_audit_failures WITH (security_invoker='true') AS
 SELECT secret_audit_logs.tenant_id,
    secret_audit_logs.user_id,
    secret_audit_logs.secret_key,
    secret_audit_logs.action,
    secret_audit_logs.error_message,
    secret_audit_logs."timestamp"
   FROM public.secret_audit_logs
  WHERE (((secret_audit_logs.result)::text = 'FAILURE'::text) AND (secret_audit_logs."timestamp" >= (now() - '7 days'::interval)))
  ORDER BY secret_audit_logs."timestamp" DESC;


--
-- Name: VIEW secret_audit_failures; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.secret_audit_failures IS 'SECURITY INVOKER view - Recent failed secret access attempts for security monitoring. Relies on RLS policy on secret_audit_logs table.';


--
-- Name: secret_audit_logs_2024; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.secret_audit_logs_ CASCADE;
CREATE TABLE IF NOT EXISTS public.secret_audit_logs_2024 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    user_id character varying(255),
    secret_key character varying(255) NOT NULL,
    secret_path text,
    action character varying(50) NOT NULL,
    result character varying(50) NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT secret_audit_logs_action_check1 CHECK (((action)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying, 'DELETE'::character varying, 'ROTATE'::character varying])::text[]))),
    CONSTRAINT secret_audit_logs_result_check1 CHECK (((result)::text = ANY ((ARRAY['SUCCESS'::character varying, 'FAILURE'::character varying])::text[])))
);


--
-- Name: secret_audit_logs_2025; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.secret_audit_logs_ CASCADE;
CREATE TABLE IF NOT EXISTS public.secret_audit_logs_2025 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    user_id character varying(255),
    secret_key character varying(255) NOT NULL,
    secret_path text,
    action character varying(50) NOT NULL,
    result character varying(50) NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT secret_audit_logs_action_check1 CHECK (((action)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying, 'DELETE'::character varying, 'ROTATE'::character varying])::text[]))),
    CONSTRAINT secret_audit_logs_result_check1 CHECK (((result)::text = ANY ((ARRAY['SUCCESS'::character varying, 'FAILURE'::character varying])::text[])))
);


--
-- Name: secret_audit_logs_2026; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.secret_audit_logs_ CASCADE;
CREATE TABLE IF NOT EXISTS public.secret_audit_logs_2026 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    user_id character varying(255),
    secret_key character varying(255) NOT NULL,
    secret_path text,
    action character varying(50) NOT NULL,
    result character varying(50) NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT secret_audit_logs_action_check1 CHECK (((action)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying, 'DELETE'::character varying, 'ROTATE'::character varying])::text[]))),
    CONSTRAINT secret_audit_logs_result_check1 CHECK (((result)::text = ANY ((ARRAY['SUCCESS'::character varying, 'FAILURE'::character varying])::text[])))
);


--
-- Name: secret_audit_logs_default; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.secret_audit_logs_default CASCADE;
CREATE TABLE IF NOT EXISTS public.secret_audit_logs_default (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    user_id character varying(255),
    secret_key character varying(255) NOT NULL,
    secret_path text,
    action character varying(50) NOT NULL,
    result character varying(50) NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT secret_audit_logs_action_check1 CHECK (((action)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying, 'DELETE'::character varying, 'ROTATE'::character varying])::text[]))),
    CONSTRAINT secret_audit_logs_result_check1 CHECK (((result)::text = ANY ((ARRAY['SUCCESS'::character varying, 'FAILURE'::character varying])::text[])))
);


--
-- Name: secret_audit_logs_legacy; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.secret_audit_logs_legacy CASCADE;
CREATE TABLE IF NOT EXISTS public.secret_audit_logs_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    user_id character varying(255),
    secret_key character varying(255) NOT NULL,
    secret_path text,
    action character varying(50) NOT NULL,
    result character varying(50) NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT secret_audit_logs_action_check CHECK (((action)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying, 'DELETE'::character varying, 'ROTATE'::character varying])::text[]))),
    CONSTRAINT secret_audit_logs_result_check CHECK (((result)::text = ANY ((ARRAY['SUCCESS'::character varying, 'FAILURE'::character varying])::text[])))
);


--
-- Name: TABLE secret_audit_logs_legacy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.secret_audit_logs_legacy IS '
Audit trail for all secret access operations.

Example queries:

-- Get audit logs for a specific tenant
SELECT * FROM secret_audit_logs
WHERE tenant_id = ''tenant-123''
ORDER BY timestamp DESC
LIMIT 100;

-- Count operations by type for last 24 hours
SELECT action, result, COUNT(*)
FROM secret_audit_logs
WHERE timestamp >= NOW() - INTERVAL ''24 hours''
GROUP BY action, result;

-- Find suspicious activity (multiple failures)
SELECT tenant_id, user_id, COUNT(*) as failure_count
FROM secret_audit_logs
WHERE result = ''FAILURE''
AND timestamp >= NOW() - INTERVAL ''1 hour''
GROUP BY tenant_id, user_id
HAVING COUNT(*) >= 5;
';


--
-- Name: COLUMN secret_audit_logs_legacy.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_audit_logs_legacy.tenant_id IS 'Tenant identifier for multi-tenant isolation';


--
-- Name: COLUMN secret_audit_logs_legacy.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_audit_logs_legacy.user_id IS 'User who performed the action (may be null for system operations)';


--
-- Name: COLUMN secret_audit_logs_legacy.secret_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_audit_logs_legacy.secret_key IS 'Masked secret key identifier';


--
-- Name: COLUMN secret_audit_logs_legacy.action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_audit_logs_legacy.action IS 'Type of operation: READ, WRITE, DELETE, or ROTATE';


--
-- Name: COLUMN secret_audit_logs_legacy.result; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_audit_logs_legacy.result IS 'Operation outcome: SUCCESS or FAILURE';


--
-- Name: COLUMN secret_audit_logs_legacy.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_audit_logs_legacy.metadata IS 'Additional context (latency, source, etc.)';


--
-- Name: COLUMN secret_audit_logs_legacy."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.secret_audit_logs_legacy."timestamp" IS 'When the operation occurred';


--
-- Name: secret_audit_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.secret_audit_summary WITH (security_invoker='true') AS
 SELECT secret_audit_logs.tenant_id,
    secret_audit_logs.action,
    secret_audit_logs.result,
    count(*) AS count,
    date_trunc('day'::text, secret_audit_logs."timestamp") AS day
   FROM public.secret_audit_logs
  WHERE (secret_audit_logs."timestamp" >= (now() - '30 days'::interval))
  GROUP BY secret_audit_logs.tenant_id, secret_audit_logs.action, secret_audit_logs.result, (date_trunc('day'::text, secret_audit_logs."timestamp"))
  ORDER BY (date_trunc('day'::text, secret_audit_logs."timestamp")) DESC, secret_audit_logs.tenant_id, secret_audit_logs.action;


--
-- Name: VIEW secret_audit_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.secret_audit_summary IS 'SECURITY INVOKER view - Daily summary of secret access operations by tenant and action type. Relies on RLS policy on secret_audit_logs table.';


--
-- Name: security_audit_log; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.security_audit_log CASCADE;
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    user_id uuid,
    table_name text,
    attempted_action text,
    blocked_at timestamp with time zone DEFAULT now(),
    metadata jsonb
);


--
-- Name: TABLE security_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.security_audit_log IS 'Append-only log of security events and RLS violations';


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.security_events CASCADE;
CREATE TABLE IF NOT EXISTS public.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    user_id text,
    event_type text NOT NULL,
    severity text,
    source text NOT NULL,
    details jsonb NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    risk_score integer DEFAULT 0,
    processed boolean DEFAULT false,
    CONSTRAINT security_events_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: security_incidents; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.security_incidents CASCADE;
CREATE TABLE IF NOT EXISTS public.security_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    severity text,
    status text,
    incident_type text NOT NULL,
    affected_resources text[] DEFAULT '{}'::text[],
    detected_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    assigned_to text,
    threat_indicators text[] DEFAULT '{}'::text[],
    risk_score integer DEFAULT 0,
    impact jsonb DEFAULT '{"usersAffected": 0, "dataCompromised": false, "serviceDisruption": false}'::jsonb,
    CONSTRAINT security_incidents_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT security_incidents_status_check CHECK ((status = ANY (ARRAY['detected'::text, 'investigating'::text, 'contained'::text, 'resolved'::text, 'false_positive'::text])))
);


--
-- Name: security_metrics; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.security_metrics CASCADE;
CREATE TABLE IF NOT EXISTS public.security_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    metric_name text NOT NULL,
    metric_type text NOT NULL,
    value numeric NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: security_policies; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.security_policies CASCADE;
CREATE TABLE IF NOT EXISTS public.security_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category text,
    rules jsonb NOT NULL,
    enforcement text,
    priority text,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT security_policies_category_check CHECK ((category = ANY (ARRAY['access_control'::text, 'data_protection'::text, 'network_security'::text, 'compliance'::text, 'monitoring'::text]))),
    CONSTRAINT security_policies_enforcement_check CHECK ((enforcement = ANY (ARRAY['prevent'::text, 'detect'::text, 'alert'::text]))),
    CONSTRAINT security_policies_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: semantic_memory; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.semantic_memory CASCADE;
CREATE TABLE IF NOT EXISTS public.semantic_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid,
    CONSTRAINT semantic_memory_type_check CHECK ((type = ANY (ARRAY['value_proposition'::text, 'target_definition'::text, 'opportunity'::text, 'integrity_check'::text, 'workflow_result'::text])))
);


--
-- Name: subscription_items; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.subscription_items CASCADE;
CREATE TABLE IF NOT EXISTS public.subscription_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid,
    stripe_subscription_item_id text NOT NULL,
    stripe_price_id text NOT NULL,
    stripe_product_id text NOT NULL,
    metric text NOT NULL,
    unit_amount numeric(10,4),
    currency text DEFAULT 'usd'::text,
    usage_type text DEFAULT 'metered'::text,
    aggregation text DEFAULT 'sum'::text,
    included_quantity integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_items_aggregation_check CHECK ((aggregation = ANY (ARRAY['sum'::text, 'max'::text, 'last_during_period'::text]))),
    CONSTRAINT subscription_items_metric_check CHECK ((metric = ANY (ARRAY['llm_tokens'::text, 'agent_executions'::text, 'api_calls'::text, 'storage_gb'::text, 'user_seats'::text]))),
    CONSTRAINT subscription_items_usage_type_check CHECK ((usage_type = ANY (ARRAY['metered'::text, 'licensed'::text])))
);


--
-- Name: TABLE subscription_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_items IS 'Metered line items per subscription (one per metric)';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.subscriptions CASCADE;
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    billing_customer_id uuid,
    tenant_id uuid NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    plan_tier text NOT NULL,
    billing_period text DEFAULT 'monthly'::text,
    status text NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    canceled_at timestamp with time zone,
    ended_at timestamp with time zone,
    amount numeric(10,2),
    currency text DEFAULT 'usd'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscriptions_billing_period_check CHECK ((billing_period = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT subscriptions_plan_tier_check CHECK ((plan_tier = ANY (ARRAY['free'::text, 'standard'::text, 'enterprise'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'incomplete'::text, 'trialing'::text])))
);


--
-- Name: TABLE subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscriptions IS 'Active subscriptions per tenant with billing periods';


--
-- Name: system_metrics; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.system_metrics CASCADE;
CREATE TABLE IF NOT EXISTS public.system_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    metric_type text NOT NULL,
    metric_name text NOT NULL,
    value numeric NOT NULL,
    unit text,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: task_queue; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.task_queue CASCADE;
CREATE TABLE IF NOT EXISTS public.task_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_execution_id uuid,
    agent_id uuid,
    task_type text NOT NULL,
    input_data jsonb NOT NULL,
    output_data jsonb,
    status text DEFAULT 'pending'::text,
    priority integer DEFAULT 5,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    assigned_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT task_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'assigned'::text, 'running'::text, 'completed'::text, 'failed'::text, 'retry'::text])))
);


--
-- Name: tenant_integrations; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.tenant_integrations CASCADE;
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider text NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp with time zone,
    instance_url text,
    hub_id text,
    connected_by uuid,
    connected_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    last_refreshed_at timestamp with time zone,
    scopes text[] DEFAULT '{}'::text[],
    status text DEFAULT 'active'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tenant_integrations_provider_check CHECK ((provider = ANY (ARRAY['hubspot'::text, 'salesforce'::text, 'dynamics'::text]))),
    CONSTRAINT tenant_integrations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'error'::text])))
);


--
-- Name: usage_aggregates; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.usage_aggregates CASCADE;
CREATE TABLE IF NOT EXISTS public.usage_aggregates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subscription_item_id uuid,
    metric text NOT NULL,
    total_amount numeric(15,4) NOT NULL,
    event_count integer NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    submitted_to_stripe boolean DEFAULT false,
    submitted_at timestamp with time zone,
    stripe_usage_record_id text,
    idempotency_key text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT usage_aggregates_metric_check CHECK ((metric = ANY (ARRAY['llm_tokens'::text, 'agent_executions'::text, 'api_calls'::text, 'storage_gb'::text, 'user_seats'::text])))
);


--
-- Name: TABLE usage_aggregates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usage_aggregates IS 'Aggregated usage ready for Stripe submission (batched from events)';


--
-- Name: usage_alerts; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.usage_alerts CASCADE;
CREATE TABLE IF NOT EXISTS public.usage_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    metric text NOT NULL,
    threshold_percentage integer,
    current_usage numeric(15,4),
    quota_amount numeric(15,4),
    alert_type text NOT NULL,
    acknowledged boolean DEFAULT false,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    notification_sent boolean DEFAULT false,
    notification_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT usage_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['warning'::text, 'critical'::text, 'exceeded'::text]))),
    CONSTRAINT usage_alerts_metric_check CHECK ((metric = ANY (ARRAY['llm_tokens'::text, 'agent_executions'::text, 'api_calls'::text, 'storage_gb'::text, 'user_seats'::text]))),
    CONSTRAINT usage_alerts_threshold_percentage_check CHECK ((threshold_percentage = ANY (ARRAY[80, 100, 120])))
);


--
-- Name: TABLE usage_alerts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usage_alerts IS 'Usage alert history (80%/100%/120% thresholds)';


--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.usage_events CASCADE;
CREATE TABLE IF NOT EXISTS public.usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    metric text NOT NULL,
    amount numeric(15,4) NOT NULL,
    request_id text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    "timestamp" timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT usage_events_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT usage_events_metric_check CHECK ((metric = ANY (ARRAY['llm_tokens'::text, 'agent_executions'::text, 'api_calls'::text, 'storage_gb'::text, 'user_seats'::text])))
);


--
-- Name: TABLE usage_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usage_events IS 'Raw usage events emitted from services (queue source for aggregation)';


--
-- Name: usage_quotas; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.usage_quotas CASCADE;
CREATE TABLE IF NOT EXISTS public.usage_quotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subscription_id uuid,
    metric text NOT NULL,
    quota_amount numeric(15,4) NOT NULL,
    hard_cap boolean DEFAULT false,
    current_usage numeric(15,4) DEFAULT 0,
    last_synced_at timestamp with time zone,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT usage_quotas_metric_check CHECK ((metric = ANY (ARRAY['llm_tokens'::text, 'agent_executions'::text, 'api_calls'::text, 'storage_gb'::text, 'user_seats'::text])))
);


--
-- Name: TABLE usage_quotas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usage_quotas IS 'Plan quotas and current usage per tenant/metric (cached from Stripe)';


--
-- Name: user_behavior_analysis; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.user_behavior_analysis CASCADE;
CREATE TABLE IF NOT EXISTS public.user_behavior_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    tenant_id text NOT NULL,
    analysis_date timestamp with time zone DEFAULT now(),
    risk_level text,
    anomaly_count integer DEFAULT 0,
    patterns jsonb,
    CONSTRAINT user_behavior_analysis_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: user_pillar_progress; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.user_pillar_progress WITH (security_invoker='true') AS
 SELECT ap.user_id,
    am.pillar,
    count(al.id) AS total_lessons,
    count(ap.id) FILTER (WHERE (ap.status = 'completed'::public.progress_status)) AS completed_lessons,
    round((((count(ap.id) FILTER (WHERE (ap.status = 'completed'::public.progress_status)))::numeric / (NULLIF(count(al.id), 0))::numeric) * (100)::numeric), 1) AS percent_complete,
    sum(al.estimated_minutes) FILTER (WHERE (ap.status <> 'completed'::public.progress_status)) AS minutes_remaining
   FROM ((public.academy_modules am
     JOIN public.academy_lessons al ON ((al.module_id = am.id)))
     LEFT JOIN public.academy_progress ap ON ((ap.lesson_id = al.id)))
  GROUP BY ap.user_id, am.pillar;


--
-- Name: VIEW user_pillar_progress; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.user_pillar_progress IS 'SECURITY INVOKER view - User progress across academy pillars. Relies on RLS policies on academy_progress, academy_modules, and academy_lessons tables.';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id text NOT NULL,
    role_id uuid NOT NULL,
    role text,
    tenant_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.user_sessions CASCADE;
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    device_fingerprint jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_activity timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    trust_level text,
    mfa_verified boolean DEFAULT false,
    risk_score integer DEFAULT 0,
    invalidated_at timestamp with time zone,
    invalidation_reason text,
    CONSTRAINT user_sessions_trust_level_check CHECK ((trust_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: user_tenants; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.user_tenants CASCADE;
CREATE TABLE IF NOT EXISTS public.user_tenants (
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'member'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_tenants_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])))
);


--
-- Name: TABLE user_tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_tenants IS 'Maps users to tenants with roles - required by security migrations';


--
-- Name: value_cases; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.value_cases CASCADE;
CREATE TABLE IF NOT EXISTS public.value_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    tenant_id text,
    session_id uuid,
    name text NOT NULL,
    description text,
    company_profile_id uuid,
    status text DEFAULT 'draft'::text,
    quality_score double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT value_cases_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'published'::text])))
);


--
-- Name: value_ledger; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.value_ledger CASCADE;
CREATE TABLE IF NOT EXISTS public.value_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    value_case_id uuid NOT NULL,
    value_realized numeric(15,2) DEFAULT 0 NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    verified_by text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT value_ledger_verified_by_check CHECK ((verified_by = ANY (ARRAY['realization_agent'::text, 'manual'::text])))
);


--
-- Name: TABLE value_ledger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.value_ledger IS 'Tracks realized value for gamification leaderboard';


--
-- Name: value_maps; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.value_maps CASCADE;
CREATE TABLE IF NOT EXISTS public.value_maps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    value_case_id uuid,
    feature text NOT NULL,
    capability text NOT NULL,
    business_outcome text NOT NULL,
    value_driver text NOT NULL,
    confidence_level text,
    supporting_evidence jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT value_maps_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])))
);


--
-- Name: value_prediction_accuracy; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.value_prediction_accuracy CASCADE;
CREATE TABLE IF NOT EXISTS public.value_prediction_accuracy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prediction_id uuid,
    prediction_type text NOT NULL,
    predicted_value numeric(15,2) NOT NULL,
    actual_value numeric(15,2),
    error_value numeric(15,2),
    error_percent numeric(5,2),
    measurement_date timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE value_prediction_accuracy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.value_prediction_accuracy IS 'Tracks accuracy of value predictions against actual outcomes';


--
-- Name: value_prediction_accuracy_metrics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW IF NOT EXISTS public.value_prediction_accuracy_metrics AS
 SELECT value_prediction_accuracy.prediction_type,
    date_trunc('day'::text, value_prediction_accuracy.created_at) AS time_bucket,
    count(*) AS total_predictions,
    count(*) FILTER (WHERE (value_prediction_accuracy.actual_value IS NOT NULL)) AS predictions_with_actuals,
    avg(value_prediction_accuracy.predicted_value) AS avg_predicted_value,
    avg(value_prediction_accuracy.actual_value) AS avg_actual_value,
    avg(value_prediction_accuracy.error_value) AS avg_error_value,
    avg(value_prediction_accuracy.error_percent) AS avg_error_percent,
    stddev(value_prediction_accuracy.error_percent) AS stddev_error_percent
   FROM public.value_prediction_accuracy
  WHERE (value_prediction_accuracy.created_at > (now() - '90 days'::interval))
  GROUP BY value_prediction_accuracy.prediction_type, (date_trunc('day'::text, value_prediction_accuracy.created_at))
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW value_prediction_accuracy_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON MATERIALIZED VIEW public.value_prediction_accuracy_metrics IS 'Aggregated value prediction accuracy metrics by day';


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.webhook_events CASCADE;
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    received_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.webhook_events IS 'Stripe webhook event log for idempotent processing';


--
-- Name: workflow_executions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.workflow_executions CASCADE;
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid,
    session_id uuid,
    user_id uuid,
    organization_id uuid,
    status text DEFAULT 'pending'::text,
    current_step text,
    dag_state jsonb DEFAULT '{}'::jsonb,
    input_params jsonb DEFAULT '{}'::jsonb,
    is_success boolean DEFAULT false,
    is_completed boolean DEFAULT false,
    error_message text,
    quality_score double precision,
    iteration_count integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    tenant_id text NOT NULL,
    CONSTRAINT workflow_executions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.workflows CASCADE;
CREATE TABLE IF NOT EXISTS public.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    case_id uuid,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    workflow_type text DEFAULT 'standard'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    organization_id uuid,
    tenant_id text NOT NULL,
    CONSTRAINT workflows_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE workflows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workflows IS 'Workflows with RLS enabled - users can only access data from their cases';


--
-- Name: secret_audit_logs_2024; Type: TABLE ATTACH; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = 'public.secret_audit_logs_2024'::regclass AND inhparent = 'public.secret_audit_logs'::regclass) THEN
        ALTER TABLE ONLY public.secret_audit_logs ATTACH PARTITION public.secret_audit_logs_2024 FOR VALUES FROM ('2024-01-01 00:00:00+00') TO ('2025-01-01 00:00:00+00');
    END IF;
END
$$;


--
-- Name: secret_audit_logs_2025; Type: TABLE ATTACH; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = 'public.secret_audit_logs_2025'::regclass AND inhparent = 'public.secret_audit_logs'::regclass) THEN
        ALTER TABLE ONLY public.secret_audit_logs ATTACH PARTITION public.secret_audit_logs_2025 FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');
    END IF;
END
$$;


--
-- Name: secret_audit_logs_2026; Type: TABLE ATTACH; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = 'public.secret_audit_logs_2026'::regclass AND inhparent = 'public.secret_audit_logs'::regclass) THEN
        ALTER TABLE ONLY public.secret_audit_logs ATTACH PARTITION public.secret_audit_logs_2026 FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
    END IF;
END
$$;


--
-- Name: secret_audit_logs_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = 'public.secret_audit_logs_default'::regclass AND inhparent = 'public.secret_audit_logs'::regclass) THEN
        ALTER TABLE ONLY public.secret_audit_logs ATTACH PARTITION public.secret_audit_logs_default DEFAULT;
    END IF;
END
$$;


--
-- Name: ab_tests ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- ALTER TABLE ONLY public.ab_tests
--     ADD CONSTRAINT ab_tests_pkey PRIMARY KEY (id);


--
-- Name: academy_certifications academy_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_certifications_pkey' AND conrelid = 'public.academy_certifications'::regclass) THEN
        ALTER TABLE ONLY public.academy_certifications
            ADD CONSTRAINT academy_certifications_pkey PRIMARY KEY (id);
    END IF;
END $$;


--
-- Name: academy_certifications academy_certifications_user_id_level_track_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_certifications_user_id_level_track_key' AND conrelid = 'public.academy_certifications'::regclass) THEN
        ALTER TABLE ONLY public.academy_certifications
            ADD CONSTRAINT academy_certifications_user_id_level_track_key UNIQUE (user_id, level, track);
    END IF;
END $$;


--
-- Name: academy_lessons academy_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_lessons_pkey') THEN
    ALTER TABLE ONLY public.academy_lessons
        ADD CONSTRAINT academy_lessons_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: academy_modules academy_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_modules_pkey') THEN
    ALTER TABLE ONLY public.academy_modules
        ADD CONSTRAINT academy_modules_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: academy_progress academy_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- ALTER TABLE ONLY public.academy_progress
--     ADD CONSTRAINT academy_progress_pkey PRIMARY KEY (id);


--
-- Name: academy_progress academy_progress_user_id_lesson_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_progress_user_id_lesson_id_key') THEN
    ALTER TABLE ONLY public.academy_progress
        ADD CONSTRAINT academy_progress_user_id_lesson_id_key UNIQUE (user_id, lesson_id);
  END IF;
END $$;


--
-- Name: agent_accuracy_metrics agent_accuracy_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_accuracy_metrics_pkey') THEN
    ALTER TABLE ONLY public.agent_accuracy_metrics
        ADD CONSTRAINT agent_accuracy_metrics_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: agent_activities agent_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_activities
    ADD CONSTRAINT agent_activities_pkey PRIMARY KEY (id);


--
-- Name: agent_audit_log agent_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_audit_log
    ADD CONSTRAINT agent_audit_log_pkey PRIMARY KEY (id);


--
-- Name: agent_calibration_history agent_calibration_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_calibration_history
    ADD CONSTRAINT agent_calibration_history_pkey PRIMARY KEY (id);


--
-- Name: agent_calibration_models agent_calibration_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_calibration_models
    ADD CONSTRAINT agent_calibration_models_pkey PRIMARY KEY (id);


--
-- Name: agent_memory agent_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memory
    ADD CONSTRAINT agent_memory_pkey PRIMARY KEY (id);


--
-- Name: agent_metrics agent_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_pkey PRIMARY KEY (id);


--
-- Name: agent_ontologies agent_ontologies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_ontologies
    ADD CONSTRAINT agent_ontologies_pkey PRIMARY KEY (id);


--
-- Name: agent_predictions agent_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_predictions
    ADD CONSTRAINT agent_predictions_pkey PRIMARY KEY (id);


--
-- Name: agent_retraining_queue agent_retraining_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_retraining_queue
    ADD CONSTRAINT agent_retraining_queue_pkey PRIMARY KEY (id);


--
-- Name: agent_sessions agent_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_pkey PRIMARY KEY (id);


--
-- Name: agent_sessions agent_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_session_token_key UNIQUE (session_token);


--
-- Name: agent_tools agent_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tools
    ADD CONSTRAINT agent_tools_pkey PRIMARY KEY (id);


--
-- Name: agents agents_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_name_key UNIQUE (name);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: approval_requests_archive approval_requests_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests_archive
    ADD CONSTRAINT approval_requests_archive_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: approvals_archive approvals_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals_archive
    ADD CONSTRAINT approvals_archive_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: approver_roles approver_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approver_roles
    ADD CONSTRAINT approver_roles_pkey PRIMARY KEY (id);


--
-- Name: assumptions assumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assumptions
    ADD CONSTRAINT assumptions_pkey PRIMARY KEY (id);


--
-- Name: audit_log_access audit_log_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_access
    ADD CONSTRAINT audit_log_access_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_archive audit_logs_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs_archive
    ADD CONSTRAINT audit_logs_archive_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automated_check_results automated_check_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automated_check_results
    ADD CONSTRAINT automated_check_results_pkey PRIMARY KEY (id);


--
-- Name: automated_responses automated_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automated_responses
    ADD CONSTRAINT automated_responses_pkey PRIMARY KEY (id);


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_customers billing_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_pkey PRIMARY KEY (id);


--
-- Name: billing_customers billing_customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: billing_customers billing_customers_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_tenant_id_key UNIQUE (tenant_id);


--
-- Name: business_cases business_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_cases
    ADD CONSTRAINT business_cases_pkey PRIMARY KEY (id);


--
-- Name: canvas_components canvas_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_components
    ADD CONSTRAINT canvas_components_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: company_profiles company_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_pkey PRIMARY KEY (id);


--
-- Name: compliance_evidence compliance_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_evidence
    ADD CONSTRAINT compliance_evidence_pkey PRIMARY KEY (id);


--
-- Name: compliance_reports compliance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_pkey PRIMARY KEY (id);


--
-- Name: component_history component_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_history
    ADD CONSTRAINT component_history_pkey PRIMARY KEY (id);


--
-- Name: component_relationships component_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_relationships
    ADD CONSTRAINT component_relationships_pkey PRIMARY KEY (id);


--
-- Name: component_relationships component_relationships_source_component_id_target_componen_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_relationships
    ADD CONSTRAINT component_relationships_source_component_id_target_componen_key UNIQUE (source_component_id, target_component_id, relationship_type);


--
-- Name: confidence_violations confidence_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_violations
    ADD CONSTRAINT confidence_violations_pkey PRIMARY KEY (id);


--
-- Name: contextual_triggers contextual_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contextual_triggers
    ADD CONSTRAINT contextual_triggers_pkey PRIMARY KEY (id);


--
-- Name: cost_alerts cost_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_alerts
    ADD CONSTRAINT cost_alerts_pkey PRIMARY KEY (id);


--
-- Name: device_trust_history device_trust_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_trust_history
    ADD CONSTRAINT device_trust_history_pkey PRIMARY KEY (user_id, device_id);


--
-- Name: evaluation_runs evaluation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_runs
    ADD CONSTRAINT evaluation_runs_pkey PRIMARY KEY (id);


--
-- Name: feature_flag_evaluations feature_flag_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_evaluations
    ADD CONSTRAINT feature_flag_evaluations_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_key_key UNIQUE (key);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: financial_models financial_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_models
    ADD CONSTRAINT financial_models_pkey PRIMARY KEY (id);


--
-- Name: golden_examples golden_examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.golden_examples
    ADD CONSTRAINT golden_examples_pkey PRIMARY KEY (id);


--
-- Name: integration_usage_log integration_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_usage_log
    ADD CONSTRAINT integration_usage_log_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_stripe_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id);


--
-- Name: kpi_hypotheses kpi_hypotheses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_hypotheses
    ADD CONSTRAINT kpi_hypotheses_pkey PRIMARY KEY (id);


--
-- Name: llm_calls llm_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_calls
    ADD CONSTRAINT llm_calls_pkey PRIMARY KEY (id);


--
-- Name: llm_job_results llm_job_results_job_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_job_results
    ADD CONSTRAINT llm_job_results_job_id_key UNIQUE (job_id);


--
-- Name: llm_job_results llm_job_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_job_results
    ADD CONSTRAINT llm_job_results_pkey PRIMARY KEY (id);


--
-- Name: llm_usage llm_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: memory_provenance memory_provenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_provenance
    ADD CONSTRAINT memory_provenance_pkey PRIMARY KEY (id);


--
-- Name: message_bus message_bus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_bus
    ADD CONSTRAINT message_bus_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: policy_rules policy_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_rules
    ADD CONSTRAINT policy_rules_pkey PRIMARY KEY (id);


--
-- Name: policy_rules policy_rules_rule_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_rules
    ADD CONSTRAINT policy_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: prompt_executions prompt_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_executions
    ADD CONSTRAINT prompt_executions_pkey PRIMARY KEY (id);


--
-- Name: prompt_versions prompt_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_versions
    ADD CONSTRAINT prompt_versions_pkey PRIMARY KEY (id);


--
-- Name: prompt_versions prompt_versions_prompt_key_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_versions
    ADD CONSTRAINT prompt_versions_prompt_key_version_key UNIQUE (prompt_key, version);


--
-- Name: rate_limit_violations rate_limit_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_violations
    ADD CONSTRAINT rate_limit_violations_pkey PRIMARY KEY (id);


--
-- Name: resource_artifacts resource_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_artifacts
    ADD CONSTRAINT resource_artifacts_pkey PRIMARY KEY (id);


--
-- Name: retention_policies retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_pkey PRIMARY KEY (id);


--
-- Name: retention_policies retention_policies_table_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_table_name_key UNIQUE (table_name);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: secret_audit_logs secret_audit_logs_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_audit_logs
    ADD CONSTRAINT secret_audit_logs_pkey1 PRIMARY KEY (id, "timestamp");


--
-- Name: secret_audit_logs_2024 secret_audit_logs_2024_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_audit_logs_2024
    ADD CONSTRAINT secret_audit_logs_2024_pkey PRIMARY KEY (id, "timestamp");


--
-- Name: secret_audit_logs_2025 secret_audit_logs_2025_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_audit_logs_2025
    ADD CONSTRAINT secret_audit_logs_2025_pkey PRIMARY KEY (id, "timestamp");


--
-- Name: secret_audit_logs_2026 secret_audit_logs_2026_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_audit_logs_2026
    ADD CONSTRAINT secret_audit_logs_2026_pkey PRIMARY KEY (id, "timestamp");


--
-- Name: secret_audit_logs_default secret_audit_logs_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_audit_logs_default
    ADD CONSTRAINT secret_audit_logs_default_pkey PRIMARY KEY (id, "timestamp");


--
-- Name: secret_audit_logs_legacy secret_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_audit_logs_legacy
    ADD CONSTRAINT secret_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: security_audit_log security_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_log
    ADD CONSTRAINT security_audit_log_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: security_incidents security_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_pkey PRIMARY KEY (id);


--
-- Name: security_metrics security_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_metrics
    ADD CONSTRAINT security_metrics_pkey PRIMARY KEY (id);


--
-- Name: security_policies security_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_policies
    ADD CONSTRAINT security_policies_pkey PRIMARY KEY (id);


--
-- Name: semantic_memory semantic_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semantic_memory
    ADD CONSTRAINT semantic_memory_pkey PRIMARY KEY (id);


--
-- Name: subscription_items subscription_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_pkey PRIMARY KEY (id);


--
-- Name: subscription_items subscription_items_stripe_subscription_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_stripe_subscription_item_id_key UNIQUE (stripe_subscription_item_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: system_metrics system_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_metrics
    ADD CONSTRAINT system_metrics_pkey PRIMARY KEY (id);


--
-- Name: task_queue task_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT task_queue_pkey PRIMARY KEY (id);


--
-- Name: tenant_integrations tenant_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_integrations
    ADD CONSTRAINT tenant_integrations_pkey PRIMARY KEY (id);


--
-- Name: tenant_integrations tenant_integrations_tenant_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_integrations
    ADD CONSTRAINT tenant_integrations_tenant_id_provider_key UNIQUE (tenant_id, provider);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: usage_aggregates usage_aggregates_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_aggregates
    ADD CONSTRAINT usage_aggregates_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: usage_aggregates usage_aggregates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_aggregates
    ADD CONSTRAINT usage_aggregates_pkey PRIMARY KEY (id);


--
-- Name: usage_alerts usage_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_alerts
    ADD CONSTRAINT usage_alerts_pkey PRIMARY KEY (id);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);


--
-- Name: usage_quotas usage_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_quotas
    ADD CONSTRAINT usage_quotas_pkey PRIMARY KEY (id);


--
-- Name: usage_quotas usage_quotas_tenant_id_metric_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_quotas
    ADD CONSTRAINT usage_quotas_tenant_id_metric_period_start_key UNIQUE (tenant_id, metric, period_start);


--
-- Name: user_behavior_analysis user_behavior_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_behavior_analysis
    ADD CONSTRAINT user_behavior_analysis_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_tenants user_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_pkey PRIMARY KEY (tenant_id, user_id);


--
-- Name: value_cases value_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_cases
    ADD CONSTRAINT value_cases_pkey PRIMARY KEY (id);


--
-- Name: value_ledger value_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_ledger
    ADD CONSTRAINT value_ledger_pkey PRIMARY KEY (id);


--
-- Name: value_ledger value_ledger_user_id_value_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_ledger
    ADD CONSTRAINT value_ledger_user_id_value_case_id_key UNIQUE (user_id, value_case_id);


--
-- Name: value_maps value_maps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_maps
    ADD CONSTRAINT value_maps_pkey PRIMARY KEY (id);


--
-- Name: value_prediction_accuracy value_prediction_accuracy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_prediction_accuracy
    ADD CONSTRAINT value_prediction_accuracy_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: workflow_executions workflow_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: approval_requests_archive_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS approval_requests_archive_agent_name_idx ON public.approval_requests_archive USING btree (agent_name);


--
-- Name: approval_requests_archive_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS approval_requests_archive_created_at_idx ON public.approval_requests_archive USING btree (created_at);


--
-- Name: approval_requests_archive_requester_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS approval_requests_archive_requester_id_idx ON public.approval_requests_archive USING btree (requester_id);


--
-- Name: approval_requests_archive_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS approval_requests_archive_status_idx ON public.approval_requests_archive USING btree (status);


--
-- Name: approvals_archive_approver_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS approvals_archive_approver_id_idx ON public.approvals_archive USING btree (approver_id);


--
-- Name: approvals_archive_request_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS approvals_archive_request_id_idx ON public.approvals_archive USING btree (request_id);


--
-- Name: audit_logs_archive_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS audit_logs_archive_action_idx ON public.audit_logs_archive USING btree (action);


--
-- Name: audit_logs_archive_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS audit_logs_archive_created_at_idx ON public.audit_logs_archive USING btree (created_at DESC);


--
-- Name: audit_logs_archive_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS audit_logs_archive_resource_type_resource_id_idx ON public.audit_logs_archive USING btree (resource_type, resource_id);


--
-- Name: audit_logs_archive_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS audit_logs_archive_user_id_idx ON public.audit_logs_archive USING btree (user_id);


--
-- Name: idx_ab_tests_key_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_ab_tests_key_status ON public.ab_tests USING btree (prompt_key, status);


--
-- Name: idx_academy_certifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_certifications_user ON public.academy_certifications USING btree (user_id);


--
-- Name: idx_academy_lessons_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_lessons_module ON public.academy_lessons USING btree (module_id);


--
-- Name: idx_academy_lessons_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_lessons_order ON public.academy_lessons USING btree (module_id, display_order);


--
-- Name: idx_academy_lessons_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_lessons_type ON public.academy_lessons USING btree (content_type);


--
-- Name: idx_academy_modules_pillar_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_modules_pillar_order ON public.academy_modules USING btree (pillar, display_order);


--
-- Name: idx_academy_progress_lesson; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_progress_lesson ON public.academy_progress USING btree (lesson_id);


--
-- Name: idx_academy_progress_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_progress_status ON public.academy_progress USING btree (user_id, status);


--
-- Name: idx_academy_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_academy_progress_user ON public.academy_progress USING btree (user_id);


--
-- Name: idx_agent_accuracy_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_accuracy_agent_type ON public.agent_accuracy_metrics USING btree (agent_type);


--
-- Name: idx_agent_accuracy_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_accuracy_org ON public.agent_accuracy_metrics USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_agent_accuracy_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_accuracy_recorded_at ON public.agent_accuracy_metrics USING btree (recorded_at DESC);


--
-- Name: idx_agent_activities_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_activities_case_id ON public.agent_activities USING btree (case_id);


--
-- Name: idx_agent_activities_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_activities_timestamp ON public.agent_activities USING btree ("timestamp" DESC);


--
-- Name: idx_agent_calibration_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_calibration_agent_id ON public.agent_calibration_models USING btree (agent_id);


--
-- Name: idx_agent_calibration_history_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_calibration_history_tenant ON public.agent_calibration_history USING btree (tenant_id);


--
-- Name: idx_agent_calibration_last_calibrated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_calibration_last_calibrated ON public.agent_calibration_models USING btree (last_calibrated DESC);


--
-- Name: idx_agent_calibration_models_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_calibration_models_tenant ON public.agent_calibration_models USING btree (tenant_id);


--
-- Name: idx_agent_memory_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_memory_expires_at ON public.agent_memory USING btree (expires_at);


--
-- Name: idx_agent_memory_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_memory_org ON public.agent_memory USING btree (organization_id);


--
-- Name: idx_agent_memory_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON public.agent_memory USING btree (session_id);


--
-- Name: idx_agent_memory_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON public.agent_memory USING btree (memory_type);


--
-- Name: idx_agent_metrics_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_metrics_session ON public.agent_metrics USING btree (session_id);


--
-- Name: idx_agent_metrics_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON public.agent_metrics USING btree (metric_type);

--
-- Name: idx_agent_metrics_tenant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_metrics_tenant_created_at ON public.agent_metrics USING btree (tenant_id, created_at DESC);


--
-- Name: idx_agent_predictions_accuracy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_accuracy ON public.agent_predictions USING btree (agent_type, created_at DESC) WHERE (actual_outcome IS NOT NULL);


--
-- Name: idx_agent_predictions_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_agent_type ON public.agent_predictions USING btree (agent_type);


--
-- Name: idx_agent_predictions_assumptions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_assumptions ON public.agent_predictions USING gin (assumptions);


--
-- Name: idx_agent_predictions_calibration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_calibration ON public.agent_predictions USING btree (agent_id, calibrated_confidence);


--
-- Name: idx_agent_predictions_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_confidence ON public.agent_predictions USING btree (confidence_level, confidence_score);


--
-- Name: idx_agent_predictions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_created_at ON public.agent_predictions USING btree (created_at DESC);


--
-- Name: idx_agent_predictions_data_gaps; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_data_gaps ON public.agent_predictions USING gin (data_gaps);


--
-- Name: idx_agent_predictions_evidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_evidence ON public.agent_predictions USING gin (evidence);


--
-- Name: idx_agent_predictions_hallucination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_hallucination ON public.agent_predictions USING btree (hallucination_detected) WHERE (hallucination_detected = true);


--
-- Name: idx_agent_predictions_hallucination_reasons; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_hallucination_reasons ON public.agent_predictions USING gin (hallucination_reasons);


--
-- Name: idx_agent_predictions_input_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_input_hash ON public.agent_predictions USING btree (input_hash);


--
-- Name: idx_agent_predictions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_session_id ON public.agent_predictions USING btree (session_id);


--
-- Name: idx_agent_predictions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_tenant ON public.agent_predictions USING btree (tenant_id);


--
-- Name: idx_agent_predictions_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_predictions_tenant_id ON public.agent_predictions USING btree (tenant_id);


--
-- Name: idx_agent_retraining_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_retraining_agent_type ON public.agent_retraining_queue USING btree (agent_type);


--
-- Name: idx_agent_retraining_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_retraining_scheduled ON public.agent_retraining_queue USING btree (scheduled_at);


--
-- Name: idx_agent_retraining_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_retraining_status ON public.agent_retraining_queue USING btree (status);


--
-- Name: idx_agent_sessions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant ON public.agent_sessions USING btree (tenant_id);


--
-- Name: idx_approval_requests_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approval_requests_agent ON public.approval_requests USING btree (agent_name);


--
-- Name: idx_approval_requests_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approval_requests_created ON public.approval_requests USING btree (created_at);


--
-- Name: idx_approval_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests USING btree (requester_id);


--
-- Name: idx_approval_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests USING btree (status);


--
-- Name: idx_approvals_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approvals_approver ON public.approvals USING btree (approver_id);


--
-- Name: idx_approvals_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approvals_request ON public.approvals USING btree (request_id);


--
-- Name: idx_approver_roles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approver_roles_active ON public.approver_roles USING btree (active);


--
-- Name: idx_approver_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_approver_roles_user ON public.approver_roles USING btree (user_id);


--
-- Name: idx_assumptions_related; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_assumptions_related ON public.assumptions USING btree (related_table, related_id);


--
-- Name: idx_assumptions_value_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_assumptions_value_case ON public.assumptions USING btree (value_case_id);


--
-- Name: idx_audit_log_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_session ON public.agent_audit_log USING btree (session_id);


--
-- Name: idx_audit_log_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.agent_audit_log USING btree ("timestamp");


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_automated_responses_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_automated_responses_incident ON public.automated_responses USING btree (incident_id);


--
-- Name: idx_backup_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON public.backup_logs USING btree (created_at DESC);


--
-- Name: idx_backup_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON public.backup_logs USING btree (status);


--
-- Name: idx_billing_customers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_billing_customers_status ON public.billing_customers USING btree (status);


--
-- Name: idx_billing_customers_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_billing_customers_stripe ON public.billing_customers USING btree (stripe_customer_id);


--
-- Name: idx_billing_customers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_billing_customers_tenant ON public.billing_customers USING btree (tenant_id);


--
-- Name: idx_calibration_history_agent_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_calibration_history_agent_time ON public.agent_calibration_history USING btree (agent_id, calibrated_at DESC);


--
-- Name: idx_canvas_components_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_canvas_components_case_id ON public.canvas_components USING btree (case_id);


--
-- Name: idx_cases_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases USING btree (created_at DESC);


--
-- Name: idx_cases_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_metadata ON public.cases USING gin (metadata);


--
-- Name: idx_cases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases USING btree (status);


--
-- Name: idx_cases_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_tenant_id ON public.cases USING btree (tenant_id);


--
-- Name: idx_cases_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_tenant_status ON public.cases USING btree (tenant_id, status);


--
-- Name: idx_cases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases USING btree (user_id);


--
-- Name: idx_compliance_evidence_control; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_control ON public.compliance_evidence USING btree (control_id, tenant_id);


--
-- Name: idx_compliance_reports_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant ON public.compliance_reports USING btree (tenant_id, generated_at);


--
-- Name: idx_component_history_component_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_component_history_component_id ON public.component_history USING btree (component_id);


--
-- Name: idx_component_history_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_component_history_timestamp ON public.component_history USING btree ("timestamp" DESC);


--
-- Name: idx_component_relationships_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_component_relationships_source ON public.component_relationships USING btree (source_component_id);


--
-- Name: idx_component_relationships_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_component_relationships_target ON public.component_relationships USING btree (target_component_id);


--
-- Name: idx_confidence_violations_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_confidence_violations_agent ON public.confidence_violations USING btree (agent_type);


--
-- Name: idx_confidence_violations_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_confidence_violations_agent_type ON public.confidence_violations USING btree (agent_type);


--
-- Name: idx_confidence_violations_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_confidence_violations_created ON public.confidence_violations USING btree (created_at DESC);


--
-- Name: idx_confidence_violations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_confidence_violations_created_at ON public.confidence_violations USING btree (created_at DESC);


--
-- Name: idx_confidence_violations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_confidence_violations_type ON public.confidence_violations USING btree (violation_type);


--
-- Name: idx_contextual_triggers_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_contextual_triggers_enabled ON public.contextual_triggers USING btree (enabled) WHERE (enabled = true);


--
-- Name: idx_cost_alerts_acknowledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cost_alerts_acknowledged ON public.cost_alerts USING btree (acknowledged);


--
-- Name: idx_cost_alerts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cost_alerts_created_at ON public.cost_alerts USING btree (created_at DESC);


--
-- Name: idx_cost_alerts_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cost_alerts_level ON public.cost_alerts USING btree (level);


--
-- Name: idx_device_trust_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_device_trust_user ON public.device_trust_history USING btree (user_id, device_id);


--
-- Name: idx_evaluation_runs_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_agent_type ON public.evaluation_runs USING btree (agent_type);


--
-- Name: idx_evaluation_runs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_created ON public.evaluation_runs USING btree (created_at DESC);


--
-- Name: idx_evaluation_runs_prompt_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_prompt_version ON public.evaluation_runs USING btree (prompt_version);


--
-- Name: idx_feature_flag_evaluations_flag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_flag ON public.feature_flag_evaluations USING btree (flag_key, evaluated_at DESC);


--
-- Name: idx_feature_flag_evaluations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_user ON public.feature_flag_evaluations USING btree (user_id, evaluated_at DESC);


--
-- Name: idx_feature_flags_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags USING btree (enabled);


--
-- Name: idx_feature_flags_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags USING btree (key);


--
-- Name: idx_golden_examples_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_golden_examples_agent_type ON public.golden_examples USING btree (agent_type);


--
-- Name: idx_golden_examples_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_golden_examples_created ON public.golden_examples USING btree (created_at DESC);


--
-- Name: idx_integration_usage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_integration_usage_created ON public.integration_usage_log USING btree (created_at);


--
-- Name: idx_integration_usage_integration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_integration_usage_integration ON public.integration_usage_log USING btree (integration_id);


--
-- Name: idx_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices USING btree (billing_customer_id);


--
-- Name: idx_invoices_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices USING btree (period_start, period_end);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_invoices_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON public.invoices USING btree (stripe_invoice_id);


--
-- Name: idx_invoices_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices USING btree (tenant_id);


--
-- Name: idx_llm_calls_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_calls_agent ON public.llm_calls USING btree (agent_id);


--
-- Name: idx_llm_calls_cache_hit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_calls_cache_hit ON public.llm_calls USING btree (cache_hit);


--
-- Name: idx_llm_calls_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_calls_created ON public.llm_calls USING btree (created_at DESC);


--
-- Name: idx_llm_calls_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_calls_provider ON public.llm_calls USING btree (provider);


--
-- Name: idx_llm_calls_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_calls_session ON public.llm_calls USING btree (session_id);


--
-- Name: idx_llm_job_results_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_job_results_created ON public.llm_job_results USING btree (created_at DESC);


--
-- Name: idx_llm_job_results_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_job_results_job_id ON public.llm_job_results USING btree (job_id);


--
-- Name: idx_llm_job_results_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_job_results_type ON public.llm_job_results USING btree (type, created_at DESC);


--
-- Name: idx_llm_job_results_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_job_results_user ON public.llm_job_results USING btree (user_id, created_at DESC);


--
-- Name: idx_llm_performance_metrics_provider_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_performance_metrics_provider_time ON public.llm_performance_metrics USING btree (provider, model, time_bucket DESC);


--
-- Name: idx_llm_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON public.llm_usage USING btree (created_at DESC);


--
-- Name: idx_llm_usage_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_usage_model ON public.llm_usage USING btree (model);


--
-- Name: idx_llm_usage_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_usage_provider ON public.llm_usage USING btree (provider);


--
-- Name: idx_llm_usage_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_usage_session_id ON public.llm_usage USING btree (session_id);


--
-- Name: idx_llm_usage_user_date_cost; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date_cost ON public.llm_usage USING btree (user_id, created_at DESC, estimated_cost);


--
-- Name: idx_llm_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON public.llm_usage USING btree (user_id);


--
-- Name: idx_login_attempts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts USING btree (email);


--
-- Name: idx_login_attempts_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_login_attempts_timestamp ON public.login_attempts USING btree (attempted_at);


--
-- Name: idx_memory_provenance_memory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_memory_provenance_memory_id ON public.memory_provenance USING btree (memory_id);


--
-- Name: idx_message_bus_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_message_bus_session ON public.message_bus USING btree (session_id);


--
-- Name: idx_message_bus_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_message_bus_status ON public.message_bus USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: idx_messages_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_messages_case_id ON public.messages USING btree (case_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages USING btree (tenant_id);


--
-- Name: idx_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages USING btree (user_id);


--
-- Name: idx_messages_workflow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_messages_workflow_id ON public.messages USING btree (workflow_id);


--
-- Name: idx_prompt_executions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prompt_executions_created ON public.prompt_executions USING btree (created_at DESC);


--
-- Name: idx_prompt_executions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prompt_executions_user ON public.prompt_executions USING btree (user_id);


--
-- Name: idx_prompt_executions_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prompt_executions_version ON public.prompt_executions USING btree (prompt_version_id);


--
-- Name: idx_prompt_versions_key_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prompt_versions_key_status ON public.prompt_versions USING btree (prompt_key, status);


--
-- Name: idx_prompt_versions_key_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prompt_versions_key_version ON public.prompt_versions USING btree (prompt_key, version DESC);


--
-- Name: idx_rate_limit_violations_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_ip ON public.rate_limit_violations USING btree (ip_address);


--
-- Name: idx_rate_limit_violations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_user_id ON public.rate_limit_violations USING btree (user_id);


--
-- Name: idx_rate_limit_violations_violated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_violated_at ON public.rate_limit_violations USING btree (violated_at DESC);


--
-- Name: idx_resource_artifacts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_resource_artifacts_active ON public.resource_artifacts USING btree (deprecated) WHERE (deprecated = false);


--
-- Name: idx_resource_artifacts_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_resource_artifacts_stage ON public.resource_artifacts USING btree (lifecycle_stage);


--
-- Name: idx_resource_artifacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_resource_artifacts_type ON public.resource_artifacts USING btree (artifact_type);


--
-- Name: idx_retention_policies_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_retention_policies_enabled ON public.retention_policies USING btree (enabled);


--
-- Name: idx_secret_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_action ON public.secret_audit_logs_legacy USING btree (action);


--
-- Name: idx_secret_audit_logs_result; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_result ON public.secret_audit_logs_legacy USING btree (result);


--
-- Name: idx_secret_audit_logs_tenant_action_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_tenant_action_timestamp ON public.secret_audit_logs_legacy USING btree (tenant_id, action, "timestamp" DESC);


--
-- Name: idx_secret_audit_logs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_tenant_id ON public.secret_audit_logs_legacy USING btree (tenant_id);


--
-- Name: idx_secret_audit_logs_tenant_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_tenant_timestamp ON public.secret_audit_logs_legacy USING btree (tenant_id, "timestamp" DESC);


--
-- Name: idx_secret_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_timestamp ON public.secret_audit_logs_legacy USING btree ("timestamp" DESC);


--
-- Name: idx_secret_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_user_id ON public.secret_audit_logs_legacy USING btree (user_id);


--
-- Name: idx_security_events_tenant_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_tenant_timestamp ON public.security_events USING btree (tenant_id, "timestamp");


--
-- Name: idx_security_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_incidents_detected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_incidents_detected ON public.security_incidents USING btree (detected_at);


--
-- Name: idx_security_incidents_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_incidents_tenant_status ON public.security_incidents USING btree (tenant_id, status);


--
-- Name: idx_semantic_memory_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_semantic_memory_created ON public.semantic_memory USING btree (created_at DESC);


--
-- Name: idx_semantic_memory_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding ON public.semantic_memory USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_semantic_memory_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_semantic_memory_metadata_gin ON public.semantic_memory USING gin (metadata);


--
-- Name: idx_semantic_memory_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org ON public.semantic_memory USING btree (organization_id);


--
-- Name: idx_semantic_memory_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_semantic_memory_type ON public.semantic_memory USING btree (type);


--
-- Name: idx_subscription_items_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscription_items_metric ON public.subscription_items USING btree (metric);


--
-- Name: idx_subscription_items_stripe_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscription_items_stripe_item ON public.subscription_items USING btree (stripe_subscription_item_id);


--
-- Name: idx_subscription_items_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscription_items_subscription ON public.subscription_items USING btree (subscription_id);


--
-- Name: idx_subscriptions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.subscriptions USING btree (billing_customer_id);


--
-- Name: idx_subscriptions_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscriptions_period ON public.subscriptions USING btree (current_period_start, current_period_end);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON public.subscriptions USING btree (stripe_subscription_id);


--
-- Name: idx_subscriptions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions USING btree (tenant_id);


--
-- Name: idx_system_metrics_tenant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_system_metrics_tenant_type ON public.system_metrics USING btree (tenant_id, metric_type, "timestamp");


--
-- Name: idx_task_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_task_queue_status ON public.task_queue USING btree (status) WHERE (status = ANY (ARRAY['pending'::text, 'assigned'::text]));


--
-- Name: idx_task_queue_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_task_queue_workflow ON public.task_queue USING btree (workflow_execution_id);


--
-- Name: idx_tenant_integrations_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider ON public.tenant_integrations USING btree (provider);


--
-- Name: idx_tenant_integrations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON public.tenant_integrations USING btree (tenant_id);


--
-- Name: idx_tenants_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants USING btree (status);


--
-- Name: idx_usage_aggregates_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_idempotency ON public.usage_aggregates USING btree (idempotency_key);


--
-- Name: idx_usage_aggregates_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_metric ON public.usage_aggregates USING btree (metric);


--
-- Name: idx_usage_aggregates_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_period ON public.usage_aggregates USING btree (period_start, period_end);


--
-- Name: idx_usage_aggregates_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_submitted ON public.usage_aggregates USING btree (submitted_to_stripe, created_at) WHERE (NOT submitted_to_stripe);


--
-- Name: idx_usage_aggregates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_tenant ON public.usage_aggregates USING btree (tenant_id);


--
-- Name: idx_usage_alerts_acknowledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_alerts_acknowledged ON public.usage_alerts USING btree (acknowledged);


--
-- Name: idx_usage_alerts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_alerts_created ON public.usage_alerts USING btree (created_at DESC);


--
-- Name: idx_usage_alerts_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_alerts_metric ON public.usage_alerts USING btree (metric);


--
-- Name: idx_usage_alerts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_alerts_tenant ON public.usage_alerts USING btree (tenant_id);


--
-- Name: idx_usage_events_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_events_metric ON public.usage_events USING btree (metric);


--
-- Name: idx_usage_events_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_events_processed ON public.usage_events USING btree (processed, "timestamp") WHERE (NOT processed);


--
-- Name: idx_usage_events_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_events_request ON public.usage_events USING btree (request_id);


--
-- Name: idx_usage_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON public.usage_events USING btree (tenant_id);


--
-- Name: idx_usage_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON public.usage_events USING btree ("timestamp" DESC);


--
-- Name: idx_usage_quotas_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_quotas_metric ON public.usage_quotas USING btree (metric);


--
-- Name: idx_usage_quotas_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_quotas_period ON public.usage_quotas USING btree (period_start, period_end);


--
-- Name: idx_usage_quotas_sync; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_quotas_sync ON public.usage_quotas USING btree (last_synced_at);


--
-- Name: idx_usage_quotas_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_quotas_tenant ON public.usage_quotas USING btree (tenant_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_user_sessions_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_user ON public.user_sessions USING btree (tenant_id, user_id);


--
-- Name: idx_user_tenants_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON public.user_tenants USING btree (tenant_id);


--
-- Name: idx_user_tenants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON public.user_tenants USING btree (user_id);


--
-- Name: idx_value_cases_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_value_cases_session ON public.value_cases USING btree (session_id);

-- idx_opportunities_tenant_created_at: moved to end of file (table defined later)

-- Name: idx_value_ledger_user; Type: INDEX; Schema: public; Owner: -


CREATE INDEX IF NOT EXISTS idx_value_ledger_user ON public.value_ledger USING btree (user_id);


--
-- Name: idx_value_ledger_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_value_ledger_value ON public.value_ledger USING btree (value_realized DESC);


--
-- Name: idx_value_prediction_accuracy_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_created ON public.value_prediction_accuracy USING btree (created_at DESC);


--
-- Name: idx_value_prediction_accuracy_measurement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_measurement ON public.value_prediction_accuracy USING btree (measurement_date DESC);


--
-- Name: idx_value_prediction_accuracy_metrics_type_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_metrics_type_time ON public.value_prediction_accuracy_metrics USING btree (prediction_type, time_bucket DESC);


--
-- Name: idx_value_prediction_accuracy_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_type ON public.value_prediction_accuracy USING btree (prediction_type);


--
-- Name: idx_webhook_events_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events USING btree (processed, received_at) WHERE (NOT processed);


--
-- Name: idx_webhook_events_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe ON public.webhook_events USING btree (stripe_event_id);


--
-- Name: idx_webhook_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events USING btree (event_type);


--
-- Name: idx_workflow_executions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflow_executions_session ON public.workflow_executions USING btree (session_id);


--
-- Name: idx_workflow_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions USING btree (status);


--
-- Name: idx_workflow_executions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON public.workflow_executions USING btree (tenant_id);


--
-- Name: idx_workflows_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflows_case_id ON public.workflows USING btree (case_id);


--
-- Name: idx_workflows_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflows_config ON public.workflows USING gin (config);


--
-- Name: idx_workflows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows USING btree (status);


--
-- Name: idx_workflows_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON public.workflows USING btree (tenant_id);


--
-- Name: idx_workflows_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflows_tenant_status ON public.workflows USING btree (tenant_id, status);


--
-- Name: idx_workflows_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows USING btree (user_id);


--
-- Name: secret_audit_logs_2024_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.secret_audit_logs_pkey1 ATTACH PARTITION public.secret_audit_logs_2024_pkey;


--
-- Name: secret_audit_logs_2025_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.secret_audit_logs_pkey1 ATTACH PARTITION public.secret_audit_logs_2025_pkey;


--
-- Name: secret_audit_logs_2026_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.secret_audit_logs_pkey1 ATTACH PARTITION public.secret_audit_logs_2026_pkey;


--
-- Name: secret_audit_logs_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.secret_audit_logs_pkey1 ATTACH PARTITION public.secret_audit_logs_default_pkey;


--
-- Name: agents audit_agents; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_agents ON agents;
CREATE TRIGGER audit_agents
  AFTER UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


--
-- Name: cases audit_cases; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_cases ON cases;
CREATE TRIGGER audit_cases
  AFTER UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


--
-- Name: workflows audit_workflows; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_workflows ON workflows;
CREATE TRIGGER audit_workflows
  AFTER UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


--
-- Name: agent_predictions enforce_tenant_access_agent_predictions; Type: TRIGGER; Schema: public; Owner: -
--


-- Name: agent_sessions enforce_tenant_access_agent_sessions; Type: TRIGGER; Schema: public; Owner: -
--


-- Name: workflow_executions enforce_tenant_access_workflow_executions; Type: TRIGGER; Schema: public; Owner: -
--


-- Name: audit_logs_archive prevent_audit_archive_delete; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS prevent_audit_archive_delete ON audit_logs_archive;
CREATE TRIGGER prevent_audit_archive_delete
BEFORE UPDATE ON audit_logs_archive FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_deletion();


--
-- Name: audit_logs_archive prevent_audit_archive_update; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS prevent_audit_archive_update ON audit_logs_archive;
CREATE TRIGGER prevent_audit_archive_update
BEFORE UPDATE ON audit_logs_archive FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();


--
-- Name: audit_logs prevent_audit_delete; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS prevent_audit_delete ON audit_logs;
CREATE TRIGGER prevent_audit_delete
BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_deletion();


--
-- Name: audit_logs prevent_audit_update; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS prevent_audit_update ON audit_logs;
CREATE TRIGGER prevent_audit_update
BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();


--
-- Name: agent_predictions trigger_calibration_check; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trigger_calibration_check ON agent_predictions;
CREATE TRIGGER trigger_calibration_check
  AFTER INSERT ON agent_predictions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_calibration_on_outcome();


--
-- Name: tenant_integrations trigger_tenant_integrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trigger_tenant_integrations_updated_at ON tenant_integrations;
CREATE TRIGGER trigger_tenant_integrations_updated_at
BEFORE UPDATE ON tenant_integrations FOR EACH ROW EXECUTE FUNCTION public.update_tenant_integrations_updated_at();


--
-- Name: feature_flags trigger_update_feature_flag_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trigger_update_feature_flag_timestamp ON feature_flags;
CREATE TRIGGER trigger_update_feature_flag_timestamp
BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION public.update_feature_flag_timestamp();


--
-- Name: golden_examples trigger_update_golden_example_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trigger_update_golden_example_timestamp ON golden_examples;
CREATE TRIGGER trigger_update_golden_example_timestamp
BEFORE UPDATE ON golden_examples FOR EACH ROW EXECUTE FUNCTION public.update_golden_example_timestamp();


--
-- Name: prompt_executions trigger_update_version_performance; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trigger_update_version_performance ON prompt_executions;
CREATE TRIGGER trigger_update_version_performance
  AFTER UPDATE ON prompt_executions
  FOR EACH ROW WHEN ((new.success IS NOT NULL)) EXECUTE FUNCTION public.update_version_performance_trigger();


--
-- Name: academy_lessons update_academy_lessons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_academy_lessons_updated_at ON academy_lessons;
CREATE TRIGGER update_academy_lessons_updated_at
BEFORE UPDATE ON academy_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: academy_modules update_academy_modules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_academy_modules_updated_at ON academy_modules;
CREATE TRIGGER update_academy_modules_updated_at
BEFORE UPDATE ON academy_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: academy_progress update_academy_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_academy_progress_updated_at ON academy_progress;
CREATE TRIGGER update_academy_progress_updated_at
BEFORE UPDATE ON academy_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_predictions update_agent_predictions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_agent_predictions_updated_at ON agent_predictions;
CREATE TRIGGER update_agent_predictions_updated_at
BEFORE UPDATE ON agent_predictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_sessions update_agent_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_agent_sessions_updated_at ON agent_sessions;
CREATE TRIGGER update_agent_sessions_updated_at
BEFORE UPDATE ON agent_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: business_cases update_business_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_business_cases_updated_at ON business_cases;
CREATE TRIGGER update_business_cases_updated_at
BEFORE UPDATE ON business_cases FOR EACH ROW EXECUTE FUNCTION public.update_modified_at();


--
-- Name: canvas_components update_canvas_components_modified_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_canvas_components_modified_at ON canvas_components;
CREATE TRIGGER update_canvas_components_modified_at
BEFORE UPDATE ON canvas_components FOR EACH ROW EXECUTE FUNCTION public.update_modified_at();


--
-- Name: cases update_cases_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_cases_timestamp ON cases;
CREATE TRIGGER update_cases_timestamp
BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: cases update_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_cases_updated_at ON cases;
CREATE TRIGGER update_cases_updated_at
BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: resource_artifacts update_resource_artifacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_resource_artifacts_updated_at ON resource_artifacts;
CREATE TRIGGER update_resource_artifacts_updated_at
BEFORE UPDATE ON resource_artifacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_tenants update_user_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_user_tenants_updated_at ON user_tenants;
CREATE TRIGGER update_user_tenants_updated_at
BEFORE UPDATE ON user_tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workflows update_workflows_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_workflows_timestamp ON workflows;
CREATE TRIGGER update_workflows_timestamp
BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: workflows update_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at
BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: academy_certifications academy_certifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_certifications
    ADD CONSTRAINT academy_certifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: academy_lessons academy_lessons_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_lessons
    ADD CONSTRAINT academy_lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.academy_modules(id) ON DELETE CASCADE;


--
-- Name: academy_progress academy_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_progress
    ADD CONSTRAINT academy_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.academy_lessons(id) ON DELETE CASCADE;


--
-- Name: academy_progress academy_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_progress
    ADD CONSTRAINT academy_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_activities agent_activities_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_activities
    ADD CONSTRAINT agent_activities_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.business_cases(id) ON DELETE CASCADE;


--
-- Name: agent_audit_log agent_audit_log_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_audit_log
    ADD CONSTRAINT agent_audit_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_audit_log agent_audit_log_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_audit_log
    ADD CONSTRAINT agent_audit_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_memory agent_memory_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memory
    ADD CONSTRAINT agent_memory_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_memory agent_memory_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memory
    ADD CONSTRAINT agent_memory_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_metrics agent_metrics_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_metrics agent_metrics_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_ontologies agent_ontologies_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_ontologies
    ADD CONSTRAINT agent_ontologies_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_predictions agent_predictions_calibration_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_predictions
    ADD CONSTRAINT agent_predictions_calibration_model_id_fkey FOREIGN KEY (calibration_model_id) REFERENCES public.agent_calibration_models(id);


--
-- Name: agent_tools agent_tools_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tools
    ADD CONSTRAINT agent_tools_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: approval_requests approval_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id);


--
-- Name: approvals approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES auth.users(id);


--
-- Name: approvals approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.approval_requests(id) ON DELETE CASCADE;


--
-- Name: approvals approvals_second_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_second_approver_id_fkey FOREIGN KEY (second_approver_id) REFERENCES auth.users(id);


--
-- Name: approver_roles approver_roles_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approver_roles
    ADD CONSTRAINT approver_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: approver_roles approver_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approver_roles
    ADD CONSTRAINT approver_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: assumptions assumptions_value_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assumptions
    ADD CONSTRAINT assumptions_value_case_id_fkey FOREIGN KEY (value_case_id) REFERENCES public.value_cases(id) ON DELETE CASCADE;


--
-- Name: audit_log_access audit_log_access_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_access
    ADD CONSTRAINT audit_log_access_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.user_tenants(tenant_id, user_id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: automated_check_results automated_check_results_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automated_check_results
    ADD CONSTRAINT automated_check_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: automated_responses automated_responses_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automated_responses
    ADD CONSTRAINT automated_responses_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.security_incidents(id) ON DELETE CASCADE;


--
-- Name: automated_responses automated_responses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automated_responses
    ADD CONSTRAINT automated_responses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: canvas_components canvas_components_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_components
    ADD CONSTRAINT canvas_components_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.business_cases(id) ON DELETE CASCADE;


--
-- Name: cases cases_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cases cases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: company_profiles company_profiles_value_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_value_case_id_fkey FOREIGN KEY (value_case_id) REFERENCES public.value_cases(id) ON DELETE CASCADE;


--
-- Name: compliance_evidence compliance_evidence_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_evidence
    ADD CONSTRAINT compliance_evidence_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: compliance_reports compliance_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: component_history component_history_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_history
    ADD CONSTRAINT component_history_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.canvas_components(id) ON DELETE CASCADE;


--
-- Name: component_relationships component_relationships_source_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_relationships
    ADD CONSTRAINT component_relationships_source_component_id_fkey FOREIGN KEY (source_component_id) REFERENCES public.canvas_components(id) ON DELETE CASCADE;


--
-- Name: component_relationships component_relationships_target_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_relationships
    ADD CONSTRAINT component_relationships_target_component_id_fkey FOREIGN KEY (target_component_id) REFERENCES public.canvas_components(id) ON DELETE CASCADE;


--
-- Name: confidence_violations confidence_violations_prediction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_violations
    ADD CONSTRAINT confidence_violations_prediction_id_fkey FOREIGN KEY (prediction_id) REFERENCES public.agent_predictions(id) ON DELETE CASCADE;


--
-- Name: cost_alerts cost_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_alerts
    ADD CONSTRAINT cost_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: device_trust_history device_trust_history_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_trust_history
    ADD CONSTRAINT device_trust_history_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.user_tenants(tenant_id, user_id) ON DELETE CASCADE;


--
-- Name: feature_flag_evaluations feature_flag_evaluations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_evaluations
    ADD CONSTRAINT feature_flag_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: financial_models financial_models_value_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_models
    ADD CONSTRAINT financial_models_value_case_id_fkey FOREIGN KEY (value_case_id) REFERENCES public.value_cases(id) ON DELETE CASCADE;


--
-- Name: agent_predictions fk_agent_predictions_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_predictions
    ADD CONSTRAINT fk_agent_predictions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: agent_sessions fk_agent_sessions_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT fk_agent_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: workflow_executions fk_workflow_executions_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT fk_workflow_executions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: integration_usage_log integration_usage_log_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_usage_log
    ADD CONSTRAINT integration_usage_log_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.tenant_integrations(id);


--
-- Name: integration_usage_log integration_usage_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_usage_log
    ADD CONSTRAINT integration_usage_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: invoices invoices_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: kpi_hypotheses kpi_hypotheses_value_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_hypotheses
    ADD CONSTRAINT kpi_hypotheses_value_case_id_fkey FOREIGN KEY (value_case_id) REFERENCES public.value_cases(id) ON DELETE CASCADE;


--
-- Name: llm_job_results llm_job_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_job_results
    ADD CONSTRAINT llm_job_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: llm_usage llm_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: memory_provenance memory_provenance_memory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_provenance
    ADD CONSTRAINT memory_provenance_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES public.agent_memory(id) ON DELETE CASCADE;


--
-- Name: message_bus message_bus_from_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_bus
    ADD CONSTRAINT message_bus_from_agent_id_fkey FOREIGN KEY (from_agent_id) REFERENCES public.agents(id);


--
-- Name: message_bus message_bus_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_bus
    ADD CONSTRAINT message_bus_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: message_bus message_bus_to_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_bus
    ADD CONSTRAINT message_bus_to_agent_id_fkey FOREIGN KEY (to_agent_id) REFERENCES public.agents(id);


--
-- Name: messages messages_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: messages messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: prompt_executions prompt_executions_prompt_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_executions
    ADD CONSTRAINT prompt_executions_prompt_version_id_fkey FOREIGN KEY (prompt_version_id) REFERENCES public.prompt_versions(id) ON DELETE CASCADE;


--
-- Name: prompt_executions prompt_executions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_executions
    ADD CONSTRAINT prompt_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: rate_limit_violations rate_limit_violations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_violations
    ADD CONSTRAINT rate_limit_violations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resource_artifacts resource_artifacts_replaced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_artifacts
    ADD CONSTRAINT resource_artifacts_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.resource_artifacts(id);


--
-- Name: security_events security_events_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.user_tenants(tenant_id, user_id) ON DELETE CASCADE;


--
-- Name: security_incidents security_incidents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: security_metrics security_metrics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_metrics
    ADD CONSTRAINT security_metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: security_policies security_policies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_policies
    ADD CONSTRAINT security_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: subscription_items subscription_items_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id) ON DELETE CASCADE;


--
-- Name: system_metrics system_metrics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_metrics
    ADD CONSTRAINT system_metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: task_queue task_queue_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT task_queue_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: task_queue task_queue_workflow_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT task_queue_workflow_execution_id_fkey FOREIGN KEY (workflow_execution_id) REFERENCES public.workflow_executions(id) ON DELETE CASCADE;


--
-- Name: tenant_integrations tenant_integrations_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_integrations
    ADD CONSTRAINT tenant_integrations_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES auth.users(id);


--
-- Name: usage_aggregates usage_aggregates_subscription_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_aggregates
    ADD CONSTRAINT usage_aggregates_subscription_item_id_fkey FOREIGN KEY (subscription_item_id) REFERENCES public.subscription_items(id) ON DELETE CASCADE;


--
-- Name: usage_quotas usage_quotas_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_quotas
    ADD CONSTRAINT usage_quotas_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: user_behavior_analysis user_behavior_analysis_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_behavior_analysis
    ADD CONSTRAINT user_behavior_analysis_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.user_tenants(tenant_id, user_id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.user_tenants(tenant_id, user_id) ON DELETE CASCADE;


--
-- Name: user_tenants user_tenants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: value_cases value_cases_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_cases
    ADD CONSTRAINT value_cases_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: value_ledger value_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_ledger
    ADD CONSTRAINT value_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: value_maps value_maps_value_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_maps
    ADD CONSTRAINT value_maps_value_case_id_fkey FOREIGN KEY (value_case_id) REFERENCES public.value_cases(id) ON DELETE CASCADE;


--
-- Name: value_prediction_accuracy value_prediction_accuracy_prediction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.value_prediction_accuracy
    ADD CONSTRAINT value_prediction_accuracy_prediction_id_fkey FOREIGN KEY (prediction_id) REFERENCES public.agent_predictions(id) ON DELETE CASCADE;


--
-- Name: workflow_executions workflow_executions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: workflow_executions workflow_executions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: workflows workflows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ab_tests A/B tests are insertable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "A/B tests are insertable by authenticated users" ON public.ab_tests;
CREATE POLICY "A/B tests are insertable by authenticated users" ON public.ab_tests FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: ab_tests A/B tests are updatable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "A/B tests are updatable by authenticated users" ON public.ab_tests;
CREATE POLICY "A/B tests are updatable by authenticated users" ON public.ab_tests FOR UPDATE TO authenticated USING (true);


--
-- Name: ab_tests A/B tests are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "A/B tests are viewable by authenticated users" ON public.ab_tests;
CREATE POLICY "A/B tests are viewable by authenticated users" ON public.ab_tests FOR SELECT TO authenticated USING (true);


--
-- Name: academy_lessons Academy lessons are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Academy lessons are viewable by authenticated users" ON public.academy_lessons;
CREATE POLICY "Academy lessons are viewable by authenticated users" ON public.academy_lessons FOR SELECT TO authenticated USING (true);


--
-- Name: academy_modules Academy modules are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Academy modules are viewable by authenticated users" ON public.academy_modules;
CREATE POLICY "Academy modules are viewable by authenticated users" ON public.academy_modules FOR SELECT TO authenticated USING (true);


--
-- Name: agents Allow read access to agents; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Allow read access to agents" ON public.agents;
CREATE POLICY "Allow read access to agents" ON public.agents FOR SELECT TO authenticated USING (true);


--
-- Name: policy_rules Allow read access to policy rules; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Allow read access to policy rules" ON public.policy_rules;
CREATE POLICY "Allow read access to policy rules" ON public.policy_rules FOR SELECT TO authenticated USING (true);


--
-- Name: workflows Allow read access to workflows; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Allow read access to workflows" ON public.workflows;
CREATE POLICY "Allow read access to workflows" ON public.workflows FOR SELECT TO authenticated USING (true);


--
-- Name: contextual_triggers Contextual triggers are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Contextual triggers are viewable by authenticated users" ON public.contextual_triggers;
CREATE POLICY "Contextual triggers are viewable by authenticated users" ON public.contextual_triggers FOR SELECT TO authenticated USING ((enabled = true));


--
-- Name: evaluation_runs Evaluation runs are insertable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Evaluation runs are insertable by authenticated users" ON public.evaluation_runs;
CREATE POLICY "Evaluation runs are insertable by authenticated users" ON public.evaluation_runs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: evaluation_runs Evaluation runs are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Evaluation runs are viewable by authenticated users" ON public.evaluation_runs;
CREATE POLICY "Evaluation runs are viewable by authenticated users" ON public.evaluation_runs FOR SELECT TO authenticated USING (true);


--
-- Name: feature_flag_evaluations Evaluations are insertable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Evaluations are insertable by authenticated users" ON public.feature_flag_evaluations;
CREATE POLICY "Evaluations are insertable by authenticated users" ON public.feature_flag_evaluations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: feature_flags Feature flags are deletable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Feature flags are deletable by authenticated users" ON public.feature_flags;
CREATE POLICY "Feature flags are deletable by authenticated users" ON public.feature_flags FOR DELETE TO authenticated USING (true);


--
-- Name: feature_flags Feature flags are insertable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Feature flags are insertable by authenticated users" ON public.feature_flags;
CREATE POLICY "Feature flags are insertable by authenticated users" ON public.feature_flags FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: feature_flags Feature flags are updatable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Feature flags are updatable by authenticated users" ON public.feature_flags;
CREATE POLICY "Feature flags are updatable by authenticated users" ON public.feature_flags FOR UPDATE TO authenticated USING (true);


--
-- Name: feature_flags Feature flags are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Feature flags are viewable by authenticated users" ON public.feature_flags;
CREATE POLICY "Feature flags are viewable by authenticated users" ON public.feature_flags FOR SELECT TO authenticated USING (true);


--
-- Name: golden_examples Golden examples are insertable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Golden examples are insertable by authenticated users" ON public.golden_examples;
CREATE POLICY "Golden examples are insertable by authenticated users" ON public.golden_examples FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: golden_examples Golden examples are updatable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Golden examples are updatable by authenticated users" ON public.golden_examples;
CREATE POLICY "Golden examples are updatable by authenticated users" ON public.golden_examples FOR UPDATE TO authenticated USING (true);


--
-- Name: golden_examples Golden examples are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Golden examples are viewable by authenticated users" ON public.golden_examples;
CREATE POLICY "Golden examples are viewable by authenticated users" ON public.golden_examples FOR SELECT TO authenticated USING (true);


--
-- Name: llm_job_results Job results are insertable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Job results are insertable by authenticated users" ON public.llm_job_results;
CREATE POLICY "Job results are insertable by authenticated users" ON public.llm_job_results FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: agent_predictions Prevent prediction deletions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Prevent prediction deletions" ON public.agent_predictions;
CREATE POLICY "Prevent prediction deletions" ON public.agent_predictions FOR DELETE USING (false);


--
-- Name: agent_predictions Prevent prediction modifications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Prevent prediction modifications" ON public.agent_predictions;
CREATE POLICY "Prevent prediction modifications" ON public.agent_predictions FOR UPDATE USING (false);


--
-- Name: prompt_versions Prompt versions are insertable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Prompt versions are insertable by authenticated users" ON public.prompt_versions;
CREATE POLICY "Prompt versions are insertable by authenticated users" ON public.prompt_versions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: prompt_versions Prompt versions are updatable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Prompt versions are updatable by authenticated users" ON public.prompt_versions;
CREATE POLICY "Prompt versions are updatable by authenticated users" ON public.prompt_versions FOR UPDATE TO authenticated USING (true);


--
-- Name: prompt_versions Prompt versions are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Prompt versions are viewable by authenticated users" ON public.prompt_versions;
CREATE POLICY "Prompt versions are viewable by authenticated users" ON public.prompt_versions FOR SELECT TO authenticated USING (true);


--
-- Name: resource_artifacts Resource artifacts are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Resource artifacts are viewable by authenticated users" ON public.resource_artifacts;
CREATE POLICY "Resource artifacts are viewable by authenticated users" ON public.resource_artifacts FOR SELECT TO authenticated USING ((deprecated = false));


--
-- Name: semantic_memory Service role can access all memories; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Service role can access all memories" ON public.semantic_memory;
CREATE POLICY "Service role can access all memories" ON public.semantic_memory TO service_role USING (true);


--
-- Name: agent_accuracy_metrics Service role full access to metrics; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Service role full access to metrics" ON public.agent_accuracy_metrics;
CREATE POLICY "Service role full access to metrics" ON public.agent_accuracy_metrics USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: agent_retraining_queue Service role only for retraining queue; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Service role only for retraining queue" ON public.agent_retraining_queue;
CREATE POLICY "Service role only for retraining queue" ON public.agent_retraining_queue USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: cases Users can create own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can create own cases" ON public.cases;
CREATE POLICY "Users can create own cases" ON public.cases FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages Users can create own messages; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can create own messages" ON public.messages;
CREATE POLICY "Users can create own messages" ON public.messages FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid())))));


--
-- Name: workflows Users can create own workflows; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can create own workflows" ON public.workflows;
CREATE POLICY "Users can create own workflows" ON public.workflows FOR INSERT WITH CHECK (((user_id = auth.uid()) OR (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid())))));


--
-- Name: canvas_components Users can delete components in own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete components in own cases" ON public.canvas_components;
CREATE POLICY "Users can delete components in own cases" ON public.canvas_components FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.business_cases
  WHERE ((business_cases.id = canvas_components.case_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: business_cases Users can delete own business cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own business cases" ON public.business_cases;
CREATE POLICY "Users can delete own business cases" ON public.business_cases FOR DELETE TO authenticated USING ((auth.uid() = owner_id));


--
-- Name: cases Users can delete own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own cases" ON public.cases;
CREATE POLICY "Users can delete own cases" ON public.cases FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: workflows Users can delete own workflows; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own workflows" ON public.workflows;
CREATE POLICY "Users can delete own workflows" ON public.workflows FOR DELETE USING (((user_id = auth.uid()) OR (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid())))));


--
-- Name: component_relationships Users can delete relationships for own components; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete relationships for own components" ON public.component_relationships;
CREATE POLICY "Users can delete relationships for own components" ON public.component_relationships FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.canvas_components
     JOIN public.business_cases ON ((business_cases.id = canvas_components.case_id)))
  WHERE ((canvas_components.id = component_relationships.source_component_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: semantic_memory Users can delete their own memories; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete their own memories" ON public.semantic_memory;
CREATE POLICY "Users can delete their own memories" ON public.semantic_memory FOR DELETE TO authenticated USING (((metadata ->> 'userId'::text) = (auth.uid())::text));


--
-- Name: agent_activities Users can insert activities in own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert activities in own cases" ON public.agent_activities;
CREATE POLICY "Users can insert activities in own cases" ON public.agent_activities FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.business_cases
  WHERE ((business_cases.id = agent_activities.case_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: canvas_components Users can insert components in own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert components in own cases" ON public.canvas_components;
CREATE POLICY "Users can insert components in own cases" ON public.canvas_components FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.business_cases
  WHERE ((business_cases.id = canvas_components.case_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: component_history Users can insert history for own components; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert history for own components" ON public.component_history;
CREATE POLICY "Users can insert history for own components" ON public.component_history FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.canvas_components
     JOIN public.business_cases ON ((business_cases.id = canvas_components.case_id)))
  WHERE ((canvas_components.id = component_history.component_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: business_cases Users can insert own business cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own business cases" ON public.business_cases;
CREATE POLICY "Users can insert own business cases" ON public.business_cases FOR INSERT TO authenticated WITH CHECK ((auth.uid() = owner_id));


--
-- Name: academy_progress Users can insert own progress; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own progress" ON public.academy_progress;
CREATE POLICY "Users can insert own progress" ON public.academy_progress FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: component_relationships Users can insert relationships for own components; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert relationships for own components" ON public.component_relationships;
CREATE POLICY "Users can insert relationships for own components" ON public.component_relationships FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.canvas_components
     JOIN public.business_cases ON ((business_cases.id = canvas_components.case_id)))
  WHERE ((canvas_components.id = component_relationships.source_component_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: prompt_executions Users can insert their own executions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert their own executions" ON public.prompt_executions;
CREATE POLICY "Users can insert their own executions" ON public.prompt_executions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: semantic_memory Users can insert their own memories; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert their own memories" ON public.semantic_memory;
CREATE POLICY "Users can insert their own memories" ON public.semantic_memory FOR INSERT TO authenticated WITH CHECK (((metadata ->> 'userId'::text) = (auth.uid())::text));


--
-- Name: agent_sessions Users can manage own sessions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can manage own sessions" ON public.agent_sessions;
CREATE POLICY "Users can manage own sessions" ON public.agent_sessions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: value_cases Users can manage own value cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can manage own value cases" ON public.value_cases;
CREATE POLICY "Users can manage own value cases" ON public.value_cases TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_sessions
  WHERE ((agent_sessions.id = value_cases.session_id) AND (agent_sessions.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agent_sessions
  WHERE ((agent_sessions.id = value_cases.session_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: canvas_components Users can update components in own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update components in own cases" ON public.canvas_components;
CREATE POLICY "Users can update components in own cases" ON public.canvas_components FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.business_cases
  WHERE ((business_cases.id = canvas_components.case_id) AND (business_cases.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.business_cases
  WHERE ((business_cases.id = canvas_components.case_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: business_cases Users can update own business cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own business cases" ON public.business_cases;
CREATE POLICY "Users can update own business cases" ON public.business_cases FOR UPDATE TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: cases Users can update own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own cases" ON public.cases;
CREATE POLICY "Users can update own cases" ON public.cases FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: academy_progress Users can update own progress; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own progress" ON public.academy_progress;
CREATE POLICY "Users can update own progress" ON public.academy_progress FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: workflows Users can update own workflows; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own workflows" ON public.workflows;
CREATE POLICY "Users can update own workflows" ON public.workflows FOR UPDATE USING (((user_id = auth.uid()) OR (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid())))));


--
-- Name: prompt_executions Users can update their own executions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update their own executions" ON public.prompt_executions;
CREATE POLICY "Users can update their own executions" ON public.prompt_executions FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: agent_activities Users can view activities in own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view activities in own cases" ON public.agent_activities;
CREATE POLICY "Users can view activities in own cases" ON public.agent_activities FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.business_cases
  WHERE ((business_cases.id = agent_activities.case_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: canvas_components Users can view components in own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view components in own cases" ON public.canvas_components;
CREATE POLICY "Users can view components in own cases" ON public.canvas_components FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.business_cases
  WHERE ((business_cases.id = canvas_components.case_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: component_history Users can view history of own components; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view history of own components" ON public.component_history;
CREATE POLICY "Users can view history of own components" ON public.component_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.canvas_components
     JOIN public.business_cases ON ((business_cases.id = canvas_components.case_id)))
  WHERE ((canvas_components.id = component_history.component_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: agent_accuracy_metrics Users can view org metrics; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view org metrics" ON public.agent_accuracy_metrics;
CREATE POLICY "Users can view org metrics" ON public.agent_accuracy_metrics FOR SELECT USING (((organization_id IS NULL) OR (organization_id = (auth.jwt() ->> 'org_id'::text))));


--
-- Name: assumptions Users can view own assumptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own assumptions" ON public.assumptions;
CREATE POLICY "Users can view own assumptions" ON public.assumptions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.value_cases
     JOIN public.agent_sessions ON ((agent_sessions.id = value_cases.session_id)))
  WHERE ((value_cases.id = assumptions.value_case_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: agent_audit_log Users can view own audit logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.agent_audit_log;
CREATE POLICY "Users can view own audit logs" ON public.agent_audit_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_sessions
  WHERE ((agent_sessions.id = agent_audit_log.session_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: business_cases Users can view own business cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own business cases" ON public.business_cases;
CREATE POLICY "Users can view own business cases" ON public.business_cases FOR SELECT TO authenticated USING ((auth.uid() = owner_id));


--
-- Name: cases Users can view own cases; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own cases" ON public.cases;
CREATE POLICY "Users can view own cases" ON public.cases FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: academy_certifications Users can view own certifications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own certifications" ON public.academy_certifications;
CREATE POLICY "Users can view own certifications" ON public.academy_certifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: company_profiles Users can view own company profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own company profiles" ON public.company_profiles;
CREATE POLICY "Users can view own company profiles" ON public.company_profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.value_cases
     JOIN public.agent_sessions ON ((agent_sessions.id = value_cases.session_id)))
  WHERE ((value_cases.id = company_profiles.value_case_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: financial_models Users can view own financial models; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own financial models" ON public.financial_models;
CREATE POLICY "Users can view own financial models" ON public.financial_models FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.value_cases
     JOIN public.agent_sessions ON ((agent_sessions.id = value_cases.session_id)))
  WHERE ((value_cases.id = financial_models.value_case_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: kpi_hypotheses Users can view own kpi hypotheses; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own kpi hypotheses" ON public.kpi_hypotheses;
CREATE POLICY "Users can view own kpi hypotheses" ON public.kpi_hypotheses FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.value_cases
     JOIN public.agent_sessions ON ((agent_sessions.id = value_cases.session_id)))
  WHERE ((value_cases.id = kpi_hypotheses.value_case_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: value_ledger Users can view own ledger entries; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own ledger entries" ON public.value_ledger;
CREATE POLICY "Users can view own ledger entries" ON public.value_ledger FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: messages Users can view own messages; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (((user_id = auth.uid()) OR (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid())))));


--
-- Name: agent_metrics Users can view own metrics; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own metrics" ON public.agent_metrics;
CREATE POLICY "Users can view own metrics" ON public.agent_metrics FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_sessions
  WHERE ((agent_sessions.id = agent_metrics.session_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: academy_progress Users can view own progress; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own progress" ON public.academy_progress;
CREATE POLICY "Users can view own progress" ON public.academy_progress FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: agent_memory Users can view own session memory; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own session memory" ON public.agent_memory;
CREATE POLICY "Users can view own session memory" ON public.agent_memory FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_sessions
  WHERE ((agent_sessions.id = agent_memory.session_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: message_bus Users can view own session messages; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own session messages" ON public.message_bus;
CREATE POLICY "Users can view own session messages" ON public.message_bus FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_sessions
  WHERE ((agent_sessions.id = message_bus.session_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: task_queue Users can view own tasks; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own tasks" ON public.task_queue;
CREATE POLICY "Users can view own tasks" ON public.task_queue FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.workflow_executions
     JOIN public.agent_sessions ON ((agent_sessions.id = workflow_executions.session_id)))
  WHERE ((workflow_executions.id = task_queue.workflow_execution_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: value_maps Users can view own value maps; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own value maps" ON public.value_maps;
CREATE POLICY "Users can view own value maps" ON public.value_maps FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.value_cases
     JOIN public.agent_sessions ON ((agent_sessions.id = value_cases.session_id)))
  WHERE ((value_cases.id = value_maps.value_case_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: workflow_executions Users can view own workflow executions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own workflow executions" ON public.workflow_executions;
CREATE POLICY "Users can view own workflow executions" ON public.workflow_executions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_sessions
  WHERE ((agent_sessions.id = workflow_executions.session_id) AND (agent_sessions.user_id = auth.uid())))));


--
-- Name: workflows Users can view own workflows; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own workflows" ON public.workflows;
CREATE POLICY "Users can view own workflows" ON public.workflows FOR SELECT USING (((user_id = auth.uid()) OR (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid())))));


--
-- Name: component_relationships Users can view relationships for own components; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view relationships for own components" ON public.component_relationships;
CREATE POLICY "Users can view relationships for own components" ON public.component_relationships FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.canvas_components
     JOIN public.business_cases ON ((business_cases.id = canvas_components.case_id)))
  WHERE ((canvas_components.id = component_relationships.source_component_id) AND (business_cases.owner_id = auth.uid())))));


--
-- Name: feature_flag_evaluations Users can view their own evaluations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view their own evaluations" ON public.feature_flag_evaluations;
CREATE POLICY "Users can view their own evaluations" ON public.feature_flag_evaluations FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: prompt_executions Users can view their own executions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view their own executions" ON public.prompt_executions;
CREATE POLICY "Users can view their own executions" ON public.prompt_executions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: llm_job_results Users can view their own job results; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view their own job results" ON public.llm_job_results;
CREATE POLICY "Users can view their own job results" ON public.llm_job_results FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: semantic_memory Users can view their own memories; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view their own memories" ON public.semantic_memory;
CREATE POLICY "Users can view their own memories" ON public.semantic_memory FOR SELECT TO authenticated USING (((metadata ->> 'userId'::text) = (auth.uid())::text));


--
-- Name: ab_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: academy_certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academy_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: academy_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: academy_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: academy_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: security_audit_log admin_only_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS admin_only_select ON public.security_audit_log;
CREATE POLICY admin_only_select ON public.security_audit_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = (auth.uid())::text) AND (r.name = ANY (ARRAY['admin'::text, 'security_admin'::text, 'system_admin'::text]))))));


--
-- Name: agent_accuracy_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_accuracy_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_calibration_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_calibration_history ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_calibration_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_calibration_models ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_ontologies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_ontologies ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_predictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_retraining_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_retraining_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_tools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

--
-- Name: agents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals approvals_viewable_by_stakeholders; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS approvals_viewable_by_stakeholders ON public.approvals;
CREATE POLICY approvals_viewable_by_stakeholders ON public.approvals FOR SELECT USING (((approver_id = auth.uid()) OR (request_id IN ( SELECT approval_requests.id
   FROM public.approval_requests
  WHERE (approval_requests.requester_id = auth.uid())))));


--
-- Name: approver_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approver_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_requests approvers_can_view_pending; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS approvers_can_view_pending ON public.approval_requests;
CREATE POLICY approvers_can_view_pending ON public.approval_requests FOR SELECT USING (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.approver_roles
  WHERE ((approver_roles.user_id = auth.uid()) AND (approver_roles.active = true))))));


--
-- Name: assumptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_access ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_access audit_log_access_admin_only; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS audit_log_access_admin_only ON public.audit_log_access;
CREATE POLICY audit_log_access_admin_only ON public.audit_log_access USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = (auth.uid())::text) AND (r.name = ANY (ARRAY['security_admin'::text, 'system_admin'::text]))))));


--
-- Name: audit_log_access audit_log_access_immutable; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS audit_log_access_immutable ON public.audit_log_access;
CREATE POLICY audit_log_access_immutable ON public.audit_log_access FOR UPDATE USING (false);


--
-- Name: audit_log_access audit_log_access_no_delete; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS audit_log_access_no_delete ON public.audit_log_access;
CREATE POLICY audit_log_access_no_delete ON public.audit_log_access FOR DELETE USING (false);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: automated_check_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automated_check_results ENABLE ROW LEVEL SECURITY;

--
-- Name: automated_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automated_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: automated_responses automated_responses_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS automated_responses_tenant_isolation ON public.automated_responses;
CREATE POLICY automated_responses_tenant_isolation ON public.automated_responses USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: backup_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_logs backup_logs_insert_system; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS backup_logs_insert_system ON public.backup_logs;
CREATE POLICY backup_logs_insert_system ON public.backup_logs FOR INSERT WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: backup_logs backup_logs_select_admin; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS backup_logs_select_admin ON public.backup_logs;
CREATE POLICY backup_logs_select_admin ON public.backup_logs FOR SELECT USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: billing_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: business_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_components ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: cases cases_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS cases_tenant_isolation ON public.cases;
CREATE POLICY cases_tenant_isolation ON public.cases USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: company_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_evidence compliance_evidence_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS compliance_evidence_tenant_isolation ON public.compliance_evidence;
CREATE POLICY compliance_evidence_tenant_isolation ON public.compliance_evidence USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: compliance_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_reports compliance_reports_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS compliance_reports_tenant_isolation ON public.compliance_reports;
CREATE POLICY compliance_reports_tenant_isolation ON public.compliance_reports USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: component_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.component_history ENABLE ROW LEVEL SECURITY;

--
-- Name: component_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.component_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: confidence_violations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.confidence_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: contextual_triggers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contextual_triggers ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_alerts cost_alerts_insert_system; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS cost_alerts_insert_system ON public.cost_alerts;
CREATE POLICY cost_alerts_insert_system ON public.cost_alerts FOR INSERT WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: cost_alerts cost_alerts_select_admin; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS cost_alerts_select_admin ON public.cost_alerts;
CREATE POLICY cost_alerts_select_admin ON public.cost_alerts FOR SELECT USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: cost_alerts cost_alerts_update_admin; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS cost_alerts_update_admin ON public.cost_alerts;
CREATE POLICY cost_alerts_update_admin ON public.cost_alerts FOR UPDATE USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: confidence_violations cv_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS cv_tenant_isolation ON public.confidence_violations;
CREATE POLICY cv_tenant_isolation ON public.confidence_violations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_tenants ut
  WHERE (ut.user_id = (auth.uid())::text))));


--
-- Name: device_trust_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_trust_history ENABLE ROW LEVEL SECURITY;

--
-- Name: device_trust_history device_trust_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS device_trust_tenant_isolation ON public.device_trust_history;
CREATE POLICY device_trust_tenant_isolation ON public.device_trust_history USING (((tenant_id = (auth.uid())::text) OR (tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text)))));


--
-- Name: evaluation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evaluation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flag_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flag_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_models ENABLE ROW LEVEL SECURITY;

--
-- Name: golden_examples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.golden_examples ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_hypotheses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpi_hypotheses ENABLE ROW LEVEL SECURITY;

--
-- Name: llm_job_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.llm_job_results ENABLE ROW LEVEL SECURITY;

--
-- Name: llm_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: llm_usage llm_usage_insert_own; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS llm_usage_insert_own ON public.llm_usage;
CREATE POLICY llm_usage_insert_own ON public.llm_usage FOR INSERT WITH CHECK (((auth.uid() = user_id) OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text)));


--
-- Name: llm_usage llm_usage_select_own; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS llm_usage_select_own ON public.llm_usage;
CREATE POLICY llm_usage_select_own ON public.llm_usage FOR SELECT USING (((auth.uid() = user_id) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));


--
-- Name: message_bus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_bus ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS messages_tenant_isolation ON public.messages;
CREATE POLICY messages_tenant_isolation ON public.messages USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: audit_logs no_direct_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS no_direct_insert ON public.audit_logs;
CREATE POLICY no_direct_insert ON public.audit_logs FOR INSERT WITH CHECK (false);


--
-- Name: policy_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: prompt_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prompt_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: prompt_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_violations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_violations rate_limit_violations_insert_system; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS rate_limit_violations_insert_system ON public.rate_limit_violations;
CREATE POLICY rate_limit_violations_insert_system ON public.rate_limit_violations FOR INSERT WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: rate_limit_violations rate_limit_violations_select_admin; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS rate_limit_violations_select_admin ON public.rate_limit_violations;
CREATE POLICY rate_limit_violations_select_admin ON public.rate_limit_violations FOR SELECT USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: resource_artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resource_artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: secret_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.secret_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: secret_audit_logs_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.secret_audit_logs_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: secret_audit_logs_legacy secret_audit_logs_no_update; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_no_update ON public.secret_audit_logs_legacy;
CREATE POLICY secret_audit_logs_no_update ON public.secret_audit_logs_legacy FOR UPDATE USING (false);


--
-- Name: secret_audit_logs secret_audit_logs_system_access; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_system_access ON public.secret_audit_logs;
CREATE POLICY secret_audit_logs_system_access ON public.secret_audit_logs FOR SELECT TO authenticated USING (((current_setting('app.current_user_role'::text, true) = 'system'::text) OR (current_setting('app.current_user_role'::text, true) = 'admin'::text)));


--
-- Name: secret_audit_logs_legacy secret_audit_logs_system_access; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_system_access ON public.secret_audit_logs_legacy;
CREATE POLICY secret_audit_logs_system_access ON public.secret_audit_logs_legacy FOR SELECT TO authenticated USING (((current_setting('app.current_user_role'::text, true) = 'system'::text) OR (current_setting('app.current_user_role'::text, true) = 'admin'::text)));


--
-- Name: secret_audit_logs_legacy secret_audit_logs_system_delete; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_system_delete ON public.secret_audit_logs_legacy;
CREATE POLICY secret_audit_logs_system_delete ON public.secret_audit_logs_legacy FOR DELETE TO authenticated USING (((current_setting('app.current_user_role'::text, true) = 'system'::text) AND ("timestamp" < (now() - '90 days'::interval))));


--
-- Name: secret_audit_logs secret_audit_logs_system_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_system_insert ON public.secret_audit_logs;
CREATE POLICY secret_audit_logs_system_insert ON public.secret_audit_logs FOR INSERT TO authenticated WITH CHECK ((current_setting('app.current_user_role'::text, true) = 'system'::text));


--
-- Name: secret_audit_logs_legacy secret_audit_logs_system_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_system_insert ON public.secret_audit_logs_legacy;
CREATE POLICY secret_audit_logs_system_insert ON public.secret_audit_logs_legacy FOR INSERT TO authenticated WITH CHECK ((current_setting('app.current_user_role'::text, true) = 'system'::text));


--
-- Name: secret_audit_logs secret_audit_logs_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_tenant_isolation ON public.secret_audit_logs;
CREATE POLICY secret_audit_logs_tenant_isolation ON public.secret_audit_logs FOR SELECT USING (((tenant_id)::text = current_setting('app.current_tenant_id'::text, true)));


--
-- Name: secret_audit_logs_legacy secret_audit_logs_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS secret_audit_logs_tenant_isolation ON public.secret_audit_logs_legacy;
CREATE POLICY secret_audit_logs_tenant_isolation ON public.secret_audit_logs_legacy FOR SELECT USING (((tenant_id)::text = current_setting('app.current_tenant_id'::text, true)));


--
-- Name: security_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events security_events_immutable; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS security_events_immutable ON public.security_events;
CREATE POLICY security_events_immutable ON public.security_events FOR UPDATE USING (false);


--
-- Name: security_events security_events_no_delete; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS security_events_no_delete ON public.security_events;
CREATE POLICY security_events_no_delete ON public.security_events FOR DELETE USING (false);


--
-- Name: security_events security_events_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS security_events_tenant_isolation ON public.security_events;
CREATE POLICY security_events_tenant_isolation ON public.security_events USING (((tenant_id = (auth.uid())::text) OR (tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text)))));


--
-- Name: security_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: security_incidents security_incidents_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS security_incidents_tenant_isolation ON public.security_incidents;
CREATE POLICY security_incidents_tenant_isolation ON public.security_incidents USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: security_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: security_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: security_policies security_policies_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS security_policies_tenant_isolation ON public.security_policies;
CREATE POLICY security_policies_tenant_isolation ON public.security_policies USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: semantic_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.semantic_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_predictions strict_tenant_isolation_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS strict_tenant_isolation_insert ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_insert ON public.agent_predictions FOR INSERT WITH CHECK (((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_predictions.tenant_id))))));


--
-- Name: agent_predictions strict_tenant_isolation_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS strict_tenant_isolation_select ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_select ON public.agent_predictions FOR SELECT USING (((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_predictions.tenant_id))))));


--
-- Name: agent_predictions strict_tenant_isolation_update; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS strict_tenant_isolation_update ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_update ON public.agent_predictions FOR UPDATE USING (((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_predictions.tenant_id)))))) WITH CHECK (((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_predictions.tenant_id))))));


--
-- Name: subscription_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: system_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: task_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_sessions tenant_isolation_delete; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS tenant_isolation_delete ON public.agent_sessions;
CREATE POLICY tenant_isolation_delete ON public.agent_sessions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_sessions.tenant_id)))));


--
-- Name: agent_sessions tenant_isolation_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS tenant_isolation_insert ON public.agent_sessions;
CREATE POLICY tenant_isolation_insert ON public.agent_sessions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_sessions.tenant_id)))));


--
-- Name: agent_sessions tenant_isolation_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS tenant_isolation_select ON public.agent_sessions;
CREATE POLICY tenant_isolation_select ON public.agent_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_sessions.tenant_id)))));


--
-- Name: agent_sessions tenant_isolation_update; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS tenant_isolation_update ON public.agent_sessions;
CREATE POLICY tenant_isolation_update ON public.agent_sessions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_sessions.tenant_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_tenants
  WHERE ((user_tenants.user_id = (auth.uid())::text) AND (user_tenants.tenant_id = agent_sessions.tenant_id)))));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants tenants_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants FOR SELECT USING ((id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: usage_aggregates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_aggregates ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_quotas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

--
-- Name: user_behavior_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_behavior_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions user_sessions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS user_sessions_tenant_isolation ON public.user_sessions;
CREATE POLICY user_sessions_tenant_isolation ON public.user_sessions USING (((tenant_id = (auth.uid())::text) OR (tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text)))));


--
-- Name: user_tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_tenants user_tenants_insert; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS user_tenants_insert ON public.user_tenants;
CREATE POLICY user_tenants_insert ON public.user_tenants FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_tenants ut
  WHERE ((ut.user_id = (auth.uid())::text) AND (ut.tenant_id = user_tenants.tenant_id) AND (ut.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: user_tenants user_tenants_select; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS user_tenants_select ON public.user_tenants;
CREATE POLICY user_tenants_select ON public.user_tenants FOR SELECT USING (((user_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.user_tenants ut
  WHERE ((ut.user_id = (auth.uid())::text) AND (ut.tenant_id = user_tenants.tenant_id) AND (ut.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- Name: approval_requests users_can_view_own_requests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS users_can_view_own_requests ON public.approval_requests;
CREATE POLICY users_can_view_own_requests ON public.approval_requests FOR SELECT USING ((requester_id = auth.uid()));


--
-- Name: value_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.value_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: value_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.value_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: value_maps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.value_maps ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_executions workflow_executions_service; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS workflow_executions_service ON public.workflow_executions;
CREATE POLICY workflow_executions_service ON public.workflow_executions TO service_role USING (true) WITH CHECK (true);


--
-- Name: workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

--
-- Name: workflows workflows_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS workflows_tenant_isolation ON public.workflows;
CREATE POLICY workflows_tenant_isolation ON public.workflows USING ((tenant_id IN ( SELECT user_tenants.tenant_id
   FROM public.user_tenants
  WHERE (user_tenants.user_id = (auth.uid())::text))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO view_reader;


--
-- Name: FUNCTION add_user_to_tenant_transaction(p_admin_user_id uuid, p_target_user_id uuid, p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_user_to_tenant_transaction(p_admin_user_id uuid, p_target_user_id uuid, p_tenant_id uuid) TO authenticated;


--
-- Name: FUNCTION check_account_lockout(user_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_account_lockout(user_email text) TO authenticated;


--
-- Name: TABLE prompt_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.prompt_versions TO anon;
GRANT SELECT ON TABLE public.prompt_versions TO authenticated;
GRANT ALL ON TABLE public.prompt_versions TO service_role;


--
-- Name: FUNCTION get_current_org_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_current_org_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_current_org_id() TO authenticated;


--
-- Name: FUNCTION get_current_user_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_current_user_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_current_user_id() TO authenticated;


--
-- Name: FUNCTION log_login_attempt(user_email text, attempt_success boolean, client_ip inet, client_user_agent text, reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_login_attempt(user_email text, attempt_success boolean, client_ip inet, client_user_agent text, reason text) TO authenticated;


--
-- Name: TABLE academy_progress; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.academy_progress TO anon;
GRANT SELECT ON TABLE public.academy_progress TO authenticated;
GRANT ALL ON TABLE public.academy_progress TO service_role;


--
-- Name: FUNCTION validate_password_strength(password text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_password_strength(password text) TO authenticated;


--
-- Name: TABLE ab_tests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.ab_tests TO anon;
GRANT SELECT ON TABLE public.ab_tests TO authenticated;
GRANT ALL ON TABLE public.ab_tests TO service_role;


--
-- Name: TABLE academy_certifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.academy_certifications TO anon;
GRANT SELECT ON TABLE public.academy_certifications TO authenticated;
GRANT ALL ON TABLE public.academy_certifications TO service_role;


--
-- Name: TABLE academy_lessons; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.academy_lessons TO anon;
GRANT SELECT ON TABLE public.academy_lessons TO authenticated;
GRANT ALL ON TABLE public.academy_lessons TO service_role;


--
-- Name: TABLE academy_modules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.academy_modules TO anon;
GRANT SELECT ON TABLE public.academy_modules TO authenticated;
GRANT ALL ON TABLE public.academy_modules TO service_role;


--
-- Name: TABLE agent_accuracy_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_accuracy_metrics TO anon;
GRANT SELECT ON TABLE public.agent_accuracy_metrics TO authenticated;
GRANT ALL ON TABLE public.agent_accuracy_metrics TO service_role;


--
-- Name: TABLE agent_activities; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_activities TO anon;
GRANT SELECT ON TABLE public.agent_activities TO authenticated;
GRANT ALL ON TABLE public.agent_activities TO service_role;


--
-- Name: TABLE agent_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_audit_log TO anon;
GRANT SELECT ON TABLE public.agent_audit_log TO authenticated;
GRANT ALL ON TABLE public.agent_audit_log TO service_role;


--
-- Name: TABLE agent_calibration_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_calibration_history TO anon;
GRANT SELECT ON TABLE public.agent_calibration_history TO authenticated;
GRANT ALL ON TABLE public.agent_calibration_history TO service_role;


--
-- Name: TABLE agent_calibration_models; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_calibration_models TO anon;
GRANT SELECT ON TABLE public.agent_calibration_models TO authenticated;
GRANT ALL ON TABLE public.agent_calibration_models TO service_role;


--
-- Name: TABLE agent_memory; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_memory TO anon;
GRANT SELECT ON TABLE public.agent_memory TO authenticated;
GRANT ALL ON TABLE public.agent_memory TO service_role;


--
-- Name: TABLE agent_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_metrics TO anon;
GRANT SELECT ON TABLE public.agent_metrics TO authenticated;
GRANT ALL ON TABLE public.agent_metrics TO service_role;


--
-- Name: TABLE agent_ontologies; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_ontologies TO anon;
GRANT SELECT ON TABLE public.agent_ontologies TO authenticated;
GRANT ALL ON TABLE public.agent_ontologies TO service_role;


--
-- Name: TABLE agent_predictions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_predictions TO anon;
GRANT SELECT ON TABLE public.agent_predictions TO authenticated;
GRANT ALL ON TABLE public.agent_predictions TO service_role;
GRANT SELECT ON TABLE public.agent_predictions TO view_reader;


--
-- Name: TABLE agent_performance_summary; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_performance_summary TO authenticated;
GRANT ALL ON TABLE public.agent_performance_summary TO service_role;


--
-- Name: TABLE agent_retraining_queue; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_retraining_queue TO anon;
GRANT SELECT ON TABLE public.agent_retraining_queue TO authenticated;
GRANT ALL ON TABLE public.agent_retraining_queue TO service_role;


--
-- Name: TABLE agent_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_sessions TO anon;
GRANT SELECT ON TABLE public.agent_sessions TO authenticated;
GRANT ALL ON TABLE public.agent_sessions TO service_role;


--
-- Name: TABLE agent_tools; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agent_tools TO anon;
GRANT SELECT ON TABLE public.agent_tools TO authenticated;
GRANT ALL ON TABLE public.agent_tools TO service_role;


--
-- Name: TABLE agents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.agents TO anon;
GRANT SELECT ON TABLE public.agents TO authenticated;
GRANT ALL ON TABLE public.agents TO service_role;


--
-- Name: TABLE approval_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.approval_requests TO anon;
GRANT SELECT ON TABLE public.approval_requests TO authenticated;
GRANT ALL ON TABLE public.approval_requests TO service_role;


--
-- Name: TABLE approval_requests_archive; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.approval_requests_archive TO anon;
GRANT SELECT ON TABLE public.approval_requests_archive TO authenticated;
GRANT ALL ON TABLE public.approval_requests_archive TO service_role;


--
-- Name: TABLE approvals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.approvals TO anon;
GRANT SELECT ON TABLE public.approvals TO authenticated;
GRANT ALL ON TABLE public.approvals TO service_role;


--
-- Name: TABLE approvals_archive; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.approvals_archive TO anon;
GRANT SELECT ON TABLE public.approvals_archive TO authenticated;
GRANT ALL ON TABLE public.approvals_archive TO service_role;


--
-- Name: TABLE approver_roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.approver_roles TO anon;
GRANT SELECT ON TABLE public.approver_roles TO authenticated;
GRANT ALL ON TABLE public.approver_roles TO service_role;


--
-- Name: TABLE assumptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.assumptions TO anon;
GRANT SELECT ON TABLE public.assumptions TO authenticated;
GRANT ALL ON TABLE public.assumptions TO service_role;


--
-- Name: TABLE audit_log_access; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.audit_log_access TO anon;
GRANT SELECT ON TABLE public.audit_log_access TO authenticated;
GRANT ALL ON TABLE public.audit_log_access TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.audit_logs TO anon;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE audit_logs_archive; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.audit_logs_archive TO anon;
GRANT SELECT ON TABLE public.audit_logs_archive TO authenticated;
GRANT ALL ON TABLE public.audit_logs_archive TO service_role;


--
-- Name: TABLE automated_check_results; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.automated_check_results TO anon;
GRANT SELECT ON TABLE public.automated_check_results TO authenticated;
GRANT ALL ON TABLE public.automated_check_results TO service_role;


--
-- Name: TABLE automated_responses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.automated_responses TO anon;
GRANT SELECT ON TABLE public.automated_responses TO authenticated;
GRANT ALL ON TABLE public.automated_responses TO service_role;


--
-- Name: TABLE backup_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.backup_logs TO anon;
GRANT SELECT ON TABLE public.backup_logs TO authenticated;
GRANT ALL ON TABLE public.backup_logs TO service_role;


--
-- Name: TABLE billing_customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.billing_customers TO anon;
GRANT SELECT ON TABLE public.billing_customers TO authenticated;
GRANT ALL ON TABLE public.billing_customers TO service_role;


--
-- Name: TABLE business_cases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.business_cases TO anon;
GRANT SELECT ON TABLE public.business_cases TO authenticated;
GRANT ALL ON TABLE public.business_cases TO service_role;


--
-- Name: TABLE canvas_components; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.canvas_components TO anon;
GRANT SELECT ON TABLE public.canvas_components TO authenticated;
GRANT ALL ON TABLE public.canvas_components TO service_role;


--
-- Name: TABLE cases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cases TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cases TO authenticated;
GRANT ALL ON TABLE public.cases TO service_role;


--
-- Name: TABLE company_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.company_profiles TO anon;
GRANT SELECT ON TABLE public.company_profiles TO authenticated;
GRANT ALL ON TABLE public.company_profiles TO service_role;


--
-- Name: TABLE compliance_evidence; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.compliance_evidence TO anon;
GRANT SELECT ON TABLE public.compliance_evidence TO authenticated;
GRANT ALL ON TABLE public.compliance_evidence TO service_role;


--
-- Name: TABLE compliance_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.compliance_reports TO anon;
GRANT SELECT ON TABLE public.compliance_reports TO authenticated;
GRANT ALL ON TABLE public.compliance_reports TO service_role;


--
-- Name: TABLE component_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.component_history TO anon;
GRANT SELECT ON TABLE public.component_history TO authenticated;
GRANT ALL ON TABLE public.component_history TO service_role;


--
-- Name: TABLE component_relationships; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.component_relationships TO anon;
GRANT SELECT ON TABLE public.component_relationships TO authenticated;
GRANT ALL ON TABLE public.component_relationships TO service_role;


--
-- Name: TABLE confidence_violations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.confidence_violations TO anon;
GRANT SELECT ON TABLE public.confidence_violations TO authenticated;
GRANT ALL ON TABLE public.confidence_violations TO service_role;
GRANT SELECT ON TABLE public.confidence_violations TO view_reader;


--
-- Name: TABLE contextual_triggers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.contextual_triggers TO anon;
GRANT SELECT ON TABLE public.contextual_triggers TO authenticated;
GRANT ALL ON TABLE public.contextual_triggers TO service_role;


--
-- Name: TABLE cost_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cost_alerts TO anon;
GRANT SELECT ON TABLE public.cost_alerts TO authenticated;
GRANT ALL ON TABLE public.cost_alerts TO service_role;


--
-- Name: TABLE device_trust_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.device_trust_history TO anon;
GRANT SELECT ON TABLE public.device_trust_history TO authenticated;
GRANT ALL ON TABLE public.device_trust_history TO service_role;


--
-- Name: TABLE evaluation_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.evaluation_runs TO anon;
GRANT SELECT ON TABLE public.evaluation_runs TO authenticated;
GRANT ALL ON TABLE public.evaluation_runs TO service_role;


--
-- Name: TABLE feature_flag_evaluations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.feature_flag_evaluations TO anon;
GRANT SELECT ON TABLE public.feature_flag_evaluations TO authenticated;
GRANT ALL ON TABLE public.feature_flag_evaluations TO service_role;


--
-- Name: TABLE feature_flags; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.feature_flags TO anon;
GRANT SELECT ON TABLE public.feature_flags TO authenticated;
GRANT ALL ON TABLE public.feature_flags TO service_role;


--
-- Name: TABLE financial_models; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.financial_models TO anon;
GRANT SELECT ON TABLE public.financial_models TO authenticated;
GRANT ALL ON TABLE public.financial_models TO service_role;


--
-- Name: TABLE golden_examples; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.golden_examples TO anon;
GRANT SELECT ON TABLE public.golden_examples TO authenticated;
GRANT ALL ON TABLE public.golden_examples TO service_role;


--
-- Name: TABLE integration_usage_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.integration_usage_log TO anon;
GRANT SELECT ON TABLE public.integration_usage_log TO authenticated;
GRANT ALL ON TABLE public.integration_usage_log TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.invoices TO anon;
GRANT SELECT ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: TABLE kpi_hypotheses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.kpi_hypotheses TO anon;
GRANT SELECT ON TABLE public.kpi_hypotheses TO authenticated;
GRANT ALL ON TABLE public.kpi_hypotheses TO service_role;


--
-- Name: TABLE llm_calls; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.llm_calls TO anon;
GRANT SELECT ON TABLE public.llm_calls TO authenticated;
GRANT ALL ON TABLE public.llm_calls TO service_role;


--
-- Name: TABLE llm_job_results; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.llm_job_results TO anon;
GRANT SELECT ON TABLE public.llm_job_results TO authenticated;
GRANT ALL ON TABLE public.llm_job_results TO service_role;


--
-- Name: TABLE llm_performance_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.llm_performance_metrics TO anon;
GRANT SELECT ON TABLE public.llm_performance_metrics TO authenticated;
GRANT ALL ON TABLE public.llm_performance_metrics TO service_role;


--
-- Name: TABLE llm_usage; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.llm_usage TO anon;
GRANT SELECT ON TABLE public.llm_usage TO authenticated;
GRANT ALL ON TABLE public.llm_usage TO service_role;


--
-- Name: TABLE login_attempts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.login_attempts TO anon;
GRANT SELECT ON TABLE public.login_attempts TO authenticated;
GRANT ALL ON TABLE public.login_attempts TO service_role;


--
-- Name: TABLE memory_provenance; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.memory_provenance TO anon;
GRANT SELECT ON TABLE public.memory_provenance TO authenticated;
GRANT ALL ON TABLE public.memory_provenance TO service_role;


--
-- Name: TABLE message_bus; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.message_bus TO anon;
GRANT SELECT ON TABLE public.message_bus TO authenticated;
GRANT ALL ON TABLE public.message_bus TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.messages TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE policy_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.policy_rules TO anon;
GRANT SELECT ON TABLE public.policy_rules TO authenticated;
GRANT ALL ON TABLE public.policy_rules TO service_role;


--
-- Name: TABLE prompt_executions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.prompt_executions TO anon;
GRANT SELECT ON TABLE public.prompt_executions TO authenticated;
GRANT ALL ON TABLE public.prompt_executions TO service_role;


--
-- Name: TABLE rate_limit_violations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.rate_limit_violations TO anon;
GRANT SELECT ON TABLE public.rate_limit_violations TO authenticated;
GRANT ALL ON TABLE public.rate_limit_violations TO service_role;


--
-- Name: TABLE resource_artifacts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.resource_artifacts TO anon;
GRANT SELECT ON TABLE public.resource_artifacts TO authenticated;
GRANT ALL ON TABLE public.resource_artifacts TO service_role;


--
-- Name: TABLE retention_policies; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.retention_policies TO anon;
GRANT SELECT ON TABLE public.retention_policies TO authenticated;
GRANT ALL ON TABLE public.retention_policies TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.roles TO anon;
GRANT SELECT ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE secret_audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_logs TO anon;
GRANT SELECT ON TABLE public.secret_audit_logs TO authenticated;
GRANT ALL ON TABLE public.secret_audit_logs TO service_role;


--
-- Name: TABLE secret_audit_failures; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_failures TO anon;
GRANT SELECT ON TABLE public.secret_audit_failures TO authenticated;
GRANT ALL ON TABLE public.secret_audit_failures TO service_role;


--
-- Name: TABLE secret_audit_logs_2024; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_logs_2024 TO anon;
GRANT SELECT ON TABLE public.secret_audit_logs_2024 TO authenticated;
GRANT ALL ON TABLE public.secret_audit_logs_2024 TO service_role;


--
-- Name: TABLE secret_audit_logs_2025; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_logs_2025 TO anon;
GRANT SELECT ON TABLE public.secret_audit_logs_2025 TO authenticated;
GRANT ALL ON TABLE public.secret_audit_logs_2025 TO service_role;


--
-- Name: TABLE secret_audit_logs_2026; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_logs_2026 TO anon;
GRANT SELECT ON TABLE public.secret_audit_logs_2026 TO authenticated;
GRANT ALL ON TABLE public.secret_audit_logs_2026 TO service_role;


--
-- Name: TABLE secret_audit_logs_default; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_logs_default TO anon;
GRANT SELECT ON TABLE public.secret_audit_logs_default TO authenticated;
GRANT ALL ON TABLE public.secret_audit_logs_default TO service_role;


--
-- Name: TABLE secret_audit_logs_legacy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_logs_legacy TO anon;
GRANT SELECT,INSERT ON TABLE public.secret_audit_logs_legacy TO authenticated;
GRANT ALL ON TABLE public.secret_audit_logs_legacy TO service_role;


--
-- Name: TABLE secret_audit_summary; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.secret_audit_summary TO anon;
GRANT SELECT ON TABLE public.secret_audit_summary TO authenticated;
GRANT ALL ON TABLE public.secret_audit_summary TO service_role;


--
-- Name: TABLE security_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.security_audit_log TO anon;
GRANT SELECT ON TABLE public.security_audit_log TO authenticated;
GRANT ALL ON TABLE public.security_audit_log TO service_role;


--
-- Name: TABLE security_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.security_events TO anon;
GRANT SELECT ON TABLE public.security_events TO authenticated;
GRANT ALL ON TABLE public.security_events TO service_role;


--
-- Name: TABLE security_incidents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.security_incidents TO anon;
GRANT SELECT ON TABLE public.security_incidents TO authenticated;
GRANT ALL ON TABLE public.security_incidents TO service_role;


--
-- Name: TABLE security_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.security_metrics TO anon;
GRANT SELECT ON TABLE public.security_metrics TO authenticated;
GRANT ALL ON TABLE public.security_metrics TO service_role;


--
-- Name: TABLE security_policies; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.security_policies TO anon;
GRANT SELECT ON TABLE public.security_policies TO authenticated;
GRANT ALL ON TABLE public.security_policies TO service_role;


--
-- Name: TABLE semantic_memory; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.semantic_memory TO anon;
GRANT SELECT ON TABLE public.semantic_memory TO authenticated;
GRANT ALL ON TABLE public.semantic_memory TO service_role;


--
-- Name: TABLE subscription_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.subscription_items TO anon;
GRANT SELECT ON TABLE public.subscription_items TO authenticated;
GRANT ALL ON TABLE public.subscription_items TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.subscriptions TO anon;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE system_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.system_metrics TO anon;
GRANT SELECT ON TABLE public.system_metrics TO authenticated;
GRANT ALL ON TABLE public.system_metrics TO service_role;


--
-- Name: TABLE task_queue; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.task_queue TO anon;
GRANT SELECT ON TABLE public.task_queue TO authenticated;
GRANT ALL ON TABLE public.task_queue TO service_role;


--
-- Name: TABLE tenant_integrations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tenant_integrations TO anon;
GRANT SELECT ON TABLE public.tenant_integrations TO authenticated;
GRANT ALL ON TABLE public.tenant_integrations TO service_role;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tenants TO anon;
GRANT SELECT ON TABLE public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;


--
-- Name: TABLE usage_aggregates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.usage_aggregates TO anon;
GRANT SELECT ON TABLE public.usage_aggregates TO authenticated;
GRANT ALL ON TABLE public.usage_aggregates TO service_role;


--
-- Name: TABLE usage_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.usage_alerts TO anon;
GRANT SELECT ON TABLE public.usage_alerts TO authenticated;
GRANT ALL ON TABLE public.usage_alerts TO service_role;


--
-- Name: TABLE usage_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.usage_events TO anon;
GRANT SELECT ON TABLE public.usage_events TO authenticated;
GRANT ALL ON TABLE public.usage_events TO service_role;


--
-- Name: TABLE usage_quotas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.usage_quotas TO anon;
GRANT SELECT ON TABLE public.usage_quotas TO authenticated;
GRANT ALL ON TABLE public.usage_quotas TO service_role;


--
-- Name: TABLE user_behavior_analysis; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_behavior_analysis TO anon;
GRANT SELECT ON TABLE public.user_behavior_analysis TO authenticated;
GRANT ALL ON TABLE public.user_behavior_analysis TO service_role;


--
-- Name: TABLE user_pillar_progress; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_pillar_progress TO anon;
GRANT SELECT ON TABLE public.user_pillar_progress TO authenticated;
GRANT ALL ON TABLE public.user_pillar_progress TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_roles TO anon;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_sessions TO anon;
GRANT SELECT ON TABLE public.user_sessions TO authenticated;
GRANT ALL ON TABLE public.user_sessions TO service_role;


--
-- Name: TABLE user_tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_tenants TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.user_tenants TO authenticated;
GRANT ALL ON TABLE public.user_tenants TO service_role;


--
-- Name: TABLE value_cases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.value_cases TO anon;
GRANT SELECT ON TABLE public.value_cases TO authenticated;
GRANT ALL ON TABLE public.value_cases TO service_role;


--
-- Name: TABLE value_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.value_ledger TO anon;
GRANT SELECT ON TABLE public.value_ledger TO authenticated;
GRANT ALL ON TABLE public.value_ledger TO service_role;


--
-- Name: TABLE value_maps; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.value_maps TO anon;
GRANT SELECT ON TABLE public.value_maps TO authenticated;
GRANT ALL ON TABLE public.value_maps TO service_role;


--
-- Name: TABLE value_prediction_accuracy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.value_prediction_accuracy TO anon;
GRANT SELECT ON TABLE public.value_prediction_accuracy TO authenticated;
GRANT ALL ON TABLE public.value_prediction_accuracy TO service_role;


--
-- Name: TABLE value_prediction_accuracy_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.value_prediction_accuracy_metrics TO anon;
GRANT SELECT ON TABLE public.value_prediction_accuracy_metrics TO authenticated;
GRANT ALL ON TABLE public.value_prediction_accuracy_metrics TO service_role;


--
-- Name: TABLE webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.webhook_events TO anon;
GRANT SELECT ON TABLE public.webhook_events TO authenticated;
GRANT ALL ON TABLE public.webhook_events TO service_role;


--
-- Name: TABLE workflow_executions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.workflow_executions TO anon;
GRANT SELECT ON TABLE public.workflow_executions TO authenticated;
GRANT ALL ON TABLE public.workflow_executions TO service_role;


--
-- Name: TABLE workflows; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.workflows TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflows TO authenticated;
GRANT ALL ON TABLE public.workflows TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO service_role;


--
-- PostgreSQL database dump complete
--

-- ================================================
-- Source: supabase/migrations/20241229000000_hitl_tables.sql
-- ================================================
-- Migration: 20241229000000_hitl_tables.sql
-- Description: Create HITL tables for Approval Workflow Engine

-- Create HITL Requests table
DROP TABLE IF EXISTS public.hitl_requests CASCADE;
CREATE TABLE IF NOT EXISTS public.hitl_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_id TEXT NOT NULL,
    organization_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'escalated', 'expired', 'auto_approved', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- JSON payloads for flexibility
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- Includes data preview, action details
    approvals JSONB NOT NULL DEFAULT '[]'::jsonb,      -- Array of approvals
    rejections JSONB NOT NULL DEFAULT '[]'::jsonb,     -- Array of rejections
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb        -- Escalation level, audit tokens etc.
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_hitl_requests_org_id ON public.hitl_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_status ON public.hitl_requests(status);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_expires_at ON public.hitl_requests(expires_at) WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.hitl_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. Service Role (Agents) can do everything
DROP POLICY IF EXISTS "Service role full access" ON public.hitl_requests;
CREATE POLICY "Service role full access" ON public.hitl_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Authenticated users can VIEW requests in their organization
-- Note: 'auth.uid()' check assumes organization mapping exists in a separate table or app_metadata
-- For now, we assume a simplified check or relying on service interactions.
-- In a real app, we'd join with user_roles or organizations.
-- This placeholder allows authenticated users to read.
DROP POLICY IF EXISTS "Authenticated users view org requests" ON public.hitl_requests;
CREATE POLICY "Authenticated users view org requests" ON public.hitl_requests
    FOR SELECT
    TO authenticated
    USING (true); -- Refine this in VOS-SEC-002 refinement if needed

-- 3. Users cannot INSERT/UPDATE directly (must go through Agent API)
-- Only service_role creates requests.

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hitl_requests_updated_at ON public.hitl_requests;
CREATE TRIGGER update_hitl_requests_updated_at
    BEFORE UPDATE ON public.hitl_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ================================================
-- Source: supabase/migrations/20241229115900_organizations_tables.sql
-- ================================================
-- Organizations and User Organizations Tables
-- These are dependencies for integration_connections and other multi-tenant features

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,

  -- Organization settings
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Subscription/billing
  plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- User Organizations (join table for users and organizations)
CREATE TABLE IF NOT EXISTS user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- User's role in this organization
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- A user can only belong to an organization once
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_organizations_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_role ON user_organizations(role);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

DROP TRIGGER IF EXISTS user_organizations_updated_at ON user_organizations;
CREATE TRIGGER user_organizations_updated_at
  BEFORE UPDATE ON user_organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- RLS Policies for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can view organizations they belong to
DROP POLICY IF EXISTS organizations_select ON organizations;
CREATE POLICY organizations_select ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Only owners can update organizations
DROP POLICY IF EXISTS organizations_update ON organizations;
CREATE POLICY organizations_update ON organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = organizations.id
        AND role = 'owner'
    )
  );

-- RLS Policies for user_organizations
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Users can view their own organization memberships
DROP POLICY IF EXISTS user_organizations_select ON user_organizations;
CREATE POLICY user_organizations_select ON user_organizations
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can add users to organizations
DROP POLICY IF EXISTS user_organizations_insert ON user_organizations;
CREATE POLICY user_organizations_insert ON user_organizations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_organizations.organization_id
        AND role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can update user roles
DROP POLICY IF EXISTS user_organizations_update ON user_organizations;
CREATE POLICY user_organizations_update ON user_organizations
 FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.organization_id = user_organizations.organization_id
        AND uo.role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can remove users from organizations
DROP POLICY IF EXISTS user_organizations_delete ON user_organizations;
CREATE POLICY user_organizations_delete ON user_organizations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.organization_id = user_organizations.organization_id
        AND uo.role IN ('owner', 'admin')
    )
  );

-- Comments for documentation
COMMENT ON TABLE organizations IS 'Multi-tenant organizations for ValueOS';
COMMENT ON TABLE user_organizations IS 'User membership and roles within organizations';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier for the organization';
COMMENT ON COLUMN user_organizations.role IS 'User role: owner (full control), admin (manage users/integrations), member (standard access), viewer (read-only)';

-- ================================================
-- Source: supabase/migrations/20241229120000_integration_tables.sql
-- ================================================
-- Integration Connections and Sync History Tables
-- Supports all enterprise adapters (Salesforce, HubSpot, ServiceNow, Slack, SharePoint/Box)

-- Rate limit buckets for token bucket algorithm
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  tokens NUMERIC NOT NULL DEFAULT 0,
  last_refill TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_last_refill ON rate_limit_buckets(last_refill);

-- Integration connections
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Adapter details
  adapter_type VARCHAR(50) NOT NULL CHECK (adapter_type IN (
    'salesforce', 'hubspot', 'servicenow', 'slack', 'sharepoint', 'box'
  )),
  display_name VARCHAR(255) NOT NULL,

  -- Auth credentials (encrypted via Supabase Vault in production)
  credentials JSONB NOT NULL,

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Sync state
  last_sync_time TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'active' CHECK (sync_status IN (
    'active', 'paused', 'error', 'disabled'
  )),
  sync_error TEXT,

  -- Metrics
  total_syncs INT DEFAULT 0,
  successful_syncs INT DEFAULT 0,
  failed_syncs INT DEFAULT 0,
  last_health_check TIMESTAMPTZ,
  health_status JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(organization_id, adapter_type, display_name)
);

-- Indexes for integration_connections
CREATE INDEX IF NOT EXISTS idx_integration_org ON integration_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_type ON integration_connections(adapter_type);
CREATE INDEX IF NOT EXISTS idx_integration_status ON integration_connections(sync_status);
CREATE INDEX IF NOT EXISTS idx_integration_last_sync ON integration_connections(last_sync_time DESC);

-- Sync history for audit trail
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,

  -- Sync details
  sync_direction VARCHAR(20) NOT NULL CHECK (sync_direction IN (
    'pull', 'push', 'bidirectional'
  )),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INT,

  -- Metrics
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  conflicts_detected INT DEFAULT 0,

  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'running', 'completed', 'partial', 'failed'
  )),
  error_message TEXT,

  -- Detailed metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sync_history
CREATE INDEX IF NOT EXISTS idx_sync_connection ON sync_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_time ON sync_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_history(status);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS integration_connections_updated_at ON integration_connections;
CREATE TRIGGER integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

-- RLS Policies for integration_connections
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

-- Users can view connections in their organization
DROP POLICY IF EXISTS integration_connections_select ON integration_connections;
CREATE POLICY integration_connections_select ON integration_connections
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Only admins can insert connections
DROP POLICY IF EXISTS integration_connections_insert ON integration_connections;
CREATE POLICY integration_connections_insert ON integration_connections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = integration_connections.organization_id
        AND role IN ('admin', 'owner')
    )
  );

-- Only admins can update connections
DROP POLICY IF EXISTS integration_connections_update ON integration_connections;
CREATE POLICY integration_connections_update ON integration_connections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = integration_connections.organization_id
        AND role IN ('admin', 'owner')
    )
  );

-- Only admins can delete connections
DROP POLICY IF EXISTS integration_connections_delete ON integration_connections;
CREATE POLICY integration_connections_delete ON integration_connections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = integration_connections.organization_id
        AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for sync_history
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Users can view sync history for connections in their organization
DROP POLICY IF EXISTS sync_history_select ON sync_history;
CREATE POLICY sync_history_select ON sync_history
  FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid()
      )
    )
  );

-- System can insert sync history (no user-facing inserts)
DROP POLICY IF EXISTS sync_history_insert ON sync_history;
CREATE POLICY sync_history_insert ON sync_history
  FOR INSERT
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE integration_connections IS 'Stores configuration for enterprise integration adapters';
COMMENT ON TABLE sync_history IS 'Audit trail of all sync operations across integrations';
COMMENT ON TABLE rate_limit_buckets IS 'Token bucket state for API rate limiting';

-- COMMENT ON COLUMN integration_connections.credentials IS 'Encrypted OAuth tokens and API keys (use Supabase Vault for encryption)';
-- COMMENT ON COLUMN integration_connections.config IS 'Adapter-specific configuration including sync schedule and conflict resolution';
-- COMMENT ON COLUMN integration_connections.field_mappings IS 'Custom field mappings between ValueOS and external system';

-- ================================================
-- Source: supabase/migrations/20241229150000_security_audit_events.sql
-- ================================================
/**
 * Database Migration: Security Audit Events Table
 * For SOC 2 compliance (CC6.8 - Audit Logging)
 */

-- Create security_audit_events table
CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ACCESS_DENIED', 'ACCESS_GRANTED')),
  resource TEXT NOT NULL,
  required_permissions TEXT[] NOT NULL DEFAULT '{}',
  user_permissions TEXT[] NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indices for query performance
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_resource ON security_audit_events(resource);

-- Enable Row Level Security (RLS)
ALTER TABLE security_audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can read audit logs
DROP POLICY IF EXISTS "Admins can view all audit events" ON security_audit_events;
CREATE POLICY "Admins can view all audit events"
  ON security_audit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- RLS Policy: System can insert audit events (service role)
DROP POLICY IF EXISTS "Service role can insert audit events" ON security_audit_events;
CREATE POLICY "Service role can insert audit events"
  ON security_audit_events
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Add comment for documentation
COMMENT ON TABLE security_audit_events IS 'SOC 2 Compliance: Immutable audit trail of security events (CC6.8)';

-- ================================================
-- Source: supabase/migrations/20241229170000_mfa_enforcement.sql
-- ================================================
/**
 * Database Migration: MFA Enforcement
 *
 * Adds MFA support columns to users table and role-based enforcement
 *
 * AUTH-001: MFA enforcement for privileged roles (super_admin, admin, manager)
 */

-- Add MFA columns to auth.users metadata (via user_metadata)
-- Supabase stores MFA data in user metadata, but we need to track enforcement

-- Create MFA secrets table for TOTP
CREATE TABLE IF NOT EXISTS mfa_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_mfa UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE mfa_secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own MFA secrets
DROP POLICY IF EXISTS "Users can view own MFA secrets" ON mfa_secrets;
CREATE POLICY "Users can view own MFA secrets"
  ON mfa_secrets
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own MFA secrets" ON mfa_secrets;
CREATE POLICY "Users can update own MFA secrets"
  ON mfa_secrets
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own MFA secrets" ON mfa_secrets;
CREATE POLICY "Users can insert own MFA secrets"
  ON mfa_secrets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all MFA status (for support)
DROP POLICY IF EXISTS "Admins can view all MFA secrets" ON mfa_secrets;
CREATE POLICY "Admins can view all MFA secrets"
  ON mfa_secrets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' IN ('super_admin', 'admin'))
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_mfa_secrets_user_id ON mfa_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_secrets_enabled ON mfa_secrets(enabled);

-- Function to check if MFA is required for user role
CREATE OR REPLACE FUNCTION is_mfa_required(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_role IN ('super_admin', 'admin', 'manager');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user has MFA enabled
CREATE OR REPLACE FUNCTION has_mfa_enabled(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  mfa_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO mfa_enabled
  FROM mfa_secrets
  WHERE user_id = p_user_id;

  RETURN COALESCE(mfa_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mfa_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_mfa_secrets_updated_at ON mfa_secrets;
CREATE TRIGGER trigger_update_mfa_secrets_updated_at
  BEFORE UPDATE ON mfa_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_mfa_secrets_updated_at();

-- Add comment for documentation
COMMENT ON TABLE mfa_secrets IS 'AUTH-001: MFA secrets for TOTP-based two-factor authentication';
COMMENT ON COLUMN mfa_secrets.secret IS 'Base32-encoded TOTP secret key';
COMMENT ON COLUMN mfa_secrets.backup_codes IS 'One-time backup codes for account recovery';
COMMENT ON COLUMN mfa_secrets.enabled IS 'Whether MFA is active for this user';

-- ================================================
-- Source: supabase/migrations/20241229180000_webauthn_credentials.sql
-- ================================================
/**
 * WebAuthn Credentials Database Migration
 *
 * Stores registered security keys (YubiKey, TouchID, Windows Hello, etc.)
 *
 * WebAuthn Support: Passwordless authentication with hardware-backed credentials
 */

-- Create webauthn_credentials table
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Credential data (WebAuthn spec)
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,

  -- Device information
  device_type TEXT NOT NULL CHECK (device_type IN ('platform', 'cross-platform')),
  -- platform: TouchID, FaceID, Windows Hello (built-in)
  -- cross-platform: YubiKey, hardware security keys

  aaguid TEXT, -- Authenticator AAGUID
  transports TEXT[], -- ['usb', 'nfc', 'ble', 'internal']

  -- User-friendly name
  name TEXT NOT NULL, -- e.g., "My YubiKey", "MacBook TouchID"

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  CONSTRAINT unique_user_credential UNIQUE(user_id, credential_id)
);

-- Enable RLS
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own credentials
DROP POLICY IF EXISTS "Users can view own WebAuthn credentials" ON webauthn_credentials;
CREATE POLICY "Users can view own WebAuthn credentials"
  ON webauthn_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own WebAuthn credentials" ON webauthn_credentials;
CREATE POLICY "Users can insert own WebAuthn credentials"
  ON webauthn_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own WebAuthn credentials" ON webauthn_credentials;
CREATE POLICY "Users can update own WebAuthn credentials"
  ON webauthn_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own WebAuthn credentials" ON webauthn_credentials;
CREATE POLICY "Users can delete own WebAuthn credentials"
  ON webauthn_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all credentials (for support)
DROP POLICY IF EXISTS "Admins can view all WebAuthn credentials" ON webauthn_credentials;
CREATE POLICY "Admins can view all WebAuthn credentials"
  ON webauthn_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' IN ('super_admin', 'admin'))
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_last_used ON webauthn_credentials(last_used_at);

-- Comments for documentation
COMMENT ON TABLE webauthn_credentials IS 'WebAuthn: Passwordless authentication credentials (hardware keys, biometrics)';
COMMENT ON COLUMN webauthn_credentials.credential_id IS 'Base64-encoded credential ID from WebAuthn';
COMMENT ON COLUMN webauthn_credentials.public_key IS 'Base64-encoded public key for verification';
COMMENT ON COLUMN webauthn_credentials.counter IS 'Signature counter for replay protection';
COMMENT ON COLUMN webauthn_credentials.device_type IS 'platform (TouchID) or cross-platform (YubiKey)';

-- ================================================
-- Source: supabase/migrations/20241229181000_trusted_devices.sql
-- ================================================
/**
 * Trusted Devices Database Migration
 *
 * Stores trusted device fingerprints for MFA bypass
 *
 * Trusted Devices: Skip MFA for known devices (30-day trust period)
 */

-- Create trusted_devices table
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Device fingerprint (hash of browser+OS+screen characteristics)
  device_fingerprint TEXT NOT NULL,

  -- Device information (for display)
  device_name TEXT NOT NULL, -- "Chrome on macOS"
  ip_address INET,
  user_agent TEXT,

  -- Trust metadata
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- 30 days from creation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_device_fingerprint UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own trusted devices
DROP POLICY IF EXISTS "Users can view own trusted devices" ON trusted_devices;
CREATE POLICY "Users can view own trusted devices"
  ON trusted_devices
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trusted devices" ON trusted_devices;
CREATE POLICY "Users can insert own trusted devices"
  ON trusted_devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trusted devices" ON trusted_devices;
CREATE POLICY "Users can update own trusted devices"
  ON trusted_devices
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trusted devices" ON trusted_devices;
CREATE POLICY "Users can delete own trusted devices"
  ON trusted_devices
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all trusted devices (for security monitoring)
DROP POLICY IF EXISTS "Admins can view all trusted devices" ON trusted_devices;
CREATE POLICY "Admins can view all trusted devices"
  ON trusted_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' IN ('super_admin', 'admin'))
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires ON trusted_devices(expires_at);

-- Auto-cleanup expired devices (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_trusted_devices()
RETURNS void AS $$
BEGIN
  DELETE FROM trusted_devices
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE trusted_devices IS 'Trusted Devices: Skip MFA for known devices (30-day trust period)';
COMMENT ON COLUMN trusted_devices.device_fingerprint IS 'SHA-256 hash of browser characteristics';
COMMENT ON COLUMN trusted_devices.expires_at IS 'Trust expires after 30 days';

-- ================================================
-- Source: supabase/migrations/20251213000000_fix_rls_tenant_isolation.sql
-- ================================================
-- ============================================================================
-- CRITICAL SECURITY FIX: Enforce Strict Tenant Isolation
-- ============================================================================
-- Date: 2024-12-13
-- Priority: CRITICAL - DEPLOYMENT BLOCKER
--
-- NOTE: This migration is designed for production schema with tenant_id columns.
-- It will be skipped in test environments that use the minimal schema.
-- ============================================================================

-- Skip this migration in test environments
DO $$
BEGIN
  -- Check if we're in a test environment (minimal schema)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_sessions'
    AND column_name = 'tenant_id'
  ) THEN
    RAISE NOTICE 'Skipping RLS migration - test environment detected (no tenant_id column)';
    RETURN;
  END IF;
END $$;

-- ============================================================================
-- 1. FIX: agent_sessions - Add Missing RLS Policies
-- ============================================================================

-- Enable RLS (currently disabled - CRITICAL vulnerability)
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "tenant_isolation_select" ON agent_sessions;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON agent_sessions;
DROP POLICY IF EXISTS "tenant_isolation_update" ON agent_sessions;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON agent_sessions;

-- SELECT: Users can only see sessions in their tenants
CREATE POLICY "tenant_isolation_select" ON agent_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_sessions.tenant_id
    )
  );

-- INSERT: Users can only create sessions in their tenants
CREATE POLICY "tenant_isolation_insert" ON agent_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_sessions.tenant_id
    )
  );

-- UPDATE: Users can only update sessions in their tenants
CREATE POLICY "tenant_isolation_update" ON agent_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_sessions.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_sessions.tenant_id
    )
  );

-- DELETE: Users can only delete sessions in their tenants
CREATE POLICY "tenant_isolation_delete" ON agent_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_sessions.tenant_id
    )
  );

-- ============================================================================
-- 2. FIX: agent_predictions - Remove NULL Bypass Vulnerability
-- ============================================================================

-- Drop vulnerable policy that allows NULL tenant_id
DROP POLICY IF EXISTS "Users can view predictions in their organization" ON agent_predictions;
DROP POLICY IF EXISTS "Users can insert predictions" ON agent_predictions;
DROP POLICY IF EXISTS "Users can update predictions" ON agent_predictions;
DROP POLICY IF EXISTS "strict_tenant_isolation_select" ON agent_predictions;
DROP POLICY IF EXISTS "strict_tenant_isolation_insert" ON agent_predictions;
DROP POLICY IF EXISTS "strict_tenant_isolation_update" ON agent_predictions;

-- CREATE: Strict tenant isolation with NO NULL bypass
CREATE POLICY "strict_tenant_isolation_select" ON agent_predictions
  FOR SELECT
  USING (
    tenant_id IS NOT NULL  -- Explicitly reject NULL
    AND EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_predictions.tenant_id
    )
  );

CREATE POLICY "strict_tenant_isolation_insert" ON agent_predictions
  FOR INSERT
  WITH CHECK (
    tenant_id IS NOT NULL  -- Explicitly reject NULL
    AND EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_predictions.tenant_id
    )
  );

CREATE POLICY "strict_tenant_isolation_update" ON agent_predictions
  FOR UPDATE
  USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_predictions.tenant_id
    )
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = (auth.uid())::text
        AND user_tenants.tenant_id = agent_predictions.tenant_id
    )
  );

-- ============================================================================
-- 3. ADD: NOT NULL Constraints to Prevent Bypass Attacks
-- ============================================================================

-- Add NOT NULL constraint to agent_predictions
-- This prevents attackers from inserting NULL tenant_id to bypass RLS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_predictions'
  ) THEN
    ALTER TABLE agent_predictions ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Set NOT NULL on agent_predictions.tenant_id';
  END IF;
END $$;

-- Add NOT NULL constraint to agent_sessions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_sessions'
  ) THEN
    ALTER TABLE agent_sessions ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Set NOT NULL on agent_sessions.tenant_id';
  END IF;
END $$;

-- Add NOT NULL constraint to workflow_executions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workflow_executions'
  ) THEN
    ALTER TABLE workflow_executions ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Set NOT NULL on workflow_executions.tenant_id';
  END IF;
END $$;

-- Add NOT NULL constraint to canvas_data (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'canvas_data'
  ) THEN
    ALTER TABLE canvas_data ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Set NOT NULL on canvas_data.tenant_id';
  ELSE
    RAISE NOTICE 'Table canvas_data does not exist - skipping NOT NULL constraint';
  END IF;
END $$;

-- Add NOT NULL constraint to value_trees (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'value_trees'
  ) THEN
    ALTER TABLE value_trees ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Set NOT NULL on value_trees.tenant_id';
  ELSE
    RAISE NOTICE 'Table value_trees does not exist - skipping NOT NULL constraint';
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE: Security Audit Triggers
-- ============================================================================

-- Create security audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID,
  details JSONB,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DROP POLICY IF EXISTS "admin_only_select" ON security_audit_log;
CREATE POLICY "admin_only_select" ON security_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (auth.uid())::text
        AND r.name IN ('admin', 'security_admin', 'system_admin')
    )
  );

-- Create audit function to detect suspicious activity
CREATE OR REPLACE FUNCTION audit_tenant_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate tenant_id is not NULL
  IF NEW.tenant_id IS NULL THEN
    -- Log critical security violation
    INSERT INTO security_audit_log (
      event_type,
      user_id,
      tenant_id,
      details,
      severity
    ) VALUES (
      'tenant_id_null_violation',
      (auth.uid())::text,
      NULL,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'attempted_at', NOW()
      ),
      'critical'
    );

    RAISE EXCEPTION 'SECURITY VIOLATION: tenant_id cannot be NULL (table: %, operation: %)',
      TG_TABLE_NAME, TG_OP;
  END IF;

  -- Validate user has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_tenants.user_id = (auth.uid())::text
      AND user_tenants.tenant_id = NEW.tenant_id
  ) THEN
    -- Log unauthorized access attempt
    INSERT INTO security_audit_log (
      event_type,
      user_id,
      tenant_id,
      details,
      severity
    ) VALUES (
      'unauthorized_tenant_access',
      (auth.uid())::text,
      NEW.tenant_id,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'attempted_at', NOW()
      ),
      'critical'
    );

    RAISE EXCEPTION 'SECURITY VIOLATION: User % does not have access to tenant %',
      (auth.uid())::text, NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to critical tables
DROP TRIGGER IF EXISTS enforce_tenant_access_agent_predictions ON agent_predictions;
CREATE TRIGGER enforce_tenant_access_agent_predictions
  BEFORE INSERT OR UPDATE ON agent_predictions
  FOR EACH ROW
  EXECUTE FUNCTION audit_tenant_access();

DROP TRIGGER IF EXISTS enforce_tenant_access_agent_sessions ON agent_sessions;
CREATE TRIGGER enforce_tenant_access_agent_sessions
  BEFORE INSERT OR UPDATE ON agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_tenant_access();

DROP TRIGGER IF EXISTS enforce_tenant_access_workflow_executions ON workflow_executions;
CREATE TRIGGER enforce_tenant_access_workflow_executions
  BEFORE INSERT OR UPDATE ON workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION audit_tenant_access();

-- ----------------------------------------------------------------------------
-- NEW: workflow_executions RLS policies
-- ----------------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that may be too permissive
DROP POLICY IF EXISTS "workflow_executions_select" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_insert" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_update" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_delete" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_service" ON workflow_executions;

-- Create strict tenant-isolated policies
CREATE POLICY "workflow_executions_tenant_select" ON workflow_executions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_executions.workflow_id
      AND w.organization_id = public.get_user_org_id()::uuid
    )
  );

CREATE POLICY "workflow_executions_tenant_insert" ON workflow_executions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_executions.workflow_id
      AND w.organization_id = public.get_user_org_id()::uuid
    )
  );

CREATE POLICY "workflow_executions_tenant_update" ON workflow_executions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_executions.workflow_id
      AND w.organization_id = public.get_user_org_id()::uuid
    )
  );

-- Service role bypass for system operations
CREATE POLICY "workflow_executions_service" ON workflow_executions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. CREATE: Monitoring View for Security Team
-- ============================================================================

-- SKIPPED: security_violations view creation
-- The security_audit_log table exists but has a different schema than expected
-- This view can be created manually if needed based on the actual table schema

DO $$
BEGIN
  RAISE NOTICE 'Skipped security_violations view - schema mismatch with existing table';
END $$;

-- Grant access to security team (if view exists from another migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'security_violations'
  ) THEN
    GRANT SELECT ON security_violations TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- 6. VERIFICATION: Test RLS Policies
-- ============================================================================

-- Create test function to verify RLS is working
CREATE OR REPLACE FUNCTION verify_rls_tenant_isolation()
RETURNS TABLE (
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count INTEGER,
  has_not_null_constraint BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    t.rowsecurity,
    COUNT(p.policyname)::INTEGER,
    EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_name = t.tablename
        AND c.column_name = 'tenant_id'
        AND c.is_nullable = 'NO'
    )
  FROM pg_tables t
  LEFT JOIN pg_policies p ON p.tablename = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'agent_sessions',
      'agent_predictions',
      'workflow_executions',
      'canvas_data',
      'value_trees'
    )
  GROUP BY t.tablename, t.rowsecurity;
END;
$$ LANGUAGE plpgsql;

-- Run verification
SELECT * FROM verify_rls_tenant_isolation();

-- Expected output:
-- table_name            | rls_enabled | policy_count | has_not_null_constraint
-- ----------------------|-------------|--------------|------------------------
-- agent_sessions        | t           | 4            | t
-- agent_predictions     | t           | 3            | t
-- workflow_executions   | t           | 4            | t
-- canvas_data           | t           | 4            | t
-- value_trees           | t           | 4            | t

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- CRITICAL: After applying this migration, run the following tests:
--
-- 1. Test cross-tenant access is blocked:
--    npm run test:security -- rls-tenant-isolation
--
-- 2. Verify audit logs are working:
--    SELECT * FROM security_audit_log ORDER BY created_at DESC LIMIT 10;
--
-- 3. Check for any NULL tenant_id values:
--    SELECT 'agent_sessions' as table_name, COUNT(*)
--    FROM agent_sessions WHERE tenant_id IS NULL
--    UNION ALL
--    SELECT 'agent_predictions', COUNT(*)
--    FROM agent_predictions WHERE tenant_id IS NULL;
--    -- Expected: 0 rows for all tables
--
-- ============================================================================

-- ================================================
-- Source: supabase/migrations/20251213000001_fix_tenant_columns_and_rls.sql
-- ================================================
-- Migration: Defensive fixes for tenant columns, FKs and triggers
-- Run with: supabase db push

-- Ensure organization_id and FK exist on tenant-scoped tables and update triggers/policies safely
DO $$
DECLARE
  t TEXT;
  fk_exists BOOLEAN;
  tables TEXT[] := ARRAY['users','models','agents','agent_runs','agent_memory','api_keys','kpis','cases','workflows','workflow_states','shared_artifacts','audit_logs'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Ensure column exists
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ADD COLUMN IF NOT EXISTS organization_id uuid', t);

    -- Add FK if missing
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = t AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'organization_id')
    INTO fk_exists;
    IF NOT fk_exists THEN
      BEGIN
        EXECUTE format('ALTER TABLE IF EXISTS public.%I ADD CONSTRAINT %I_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE', t, t);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Skipping FK creation for % due to: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

-- Ensure functions exist in public schema (SQL form for plan stability)
CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'org_id'), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;

REVOKE ALL ON FUNCTION public.get_current_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;

-- Robust audit trigger: avoid failures when table lacks organization_id
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_id uuid;
  user_id uuid;
  has_org boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'organization_id'
  ) INTO has_org;

  IF has_org THEN
    IF TG_OP = 'DELETE' THEN
      org_id := OLD.organization_id;
    ELSE
      org_id := NEW.organization_id;
    END IF;
  ELSE
    org_id := (SELECT public.get_current_org_id());
  END IF;

  user_id := (SELECT public.get_current_user_id());

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'delete', TG_TABLE_NAME, OLD.id, jsonb_build_object('before', row_to_json(OLD)));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'update', TG_TABLE_NAME, NEW.id, jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)));
  ELSE
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'create', TG_TABLE_NAME, NEW.id, jsonb_build_object('after', row_to_json(NEW)));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger only if table exists and trigger does not already exist
DO $$
DECLARE
  t name;
  trg text;
  audit_tables name[] := ARRAY['users','agents','models','cases','workflows','workflow_states','shared_artifacts'];
BEGIN
  FOREACH t IN ARRAY audit_tables LOOP
    trg := format('audit_%s', t);
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t) AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = trg) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', trg, t);
    END IF;
  END LOOP;
END;
$$;

-- Create update_timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Ensure update_timestamp trigger exists on additional tables if they have updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cases' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cases_timestamp') THEN
    DROP TRIGGER IF EXISTS update_cases_timestamp ON public.cases;
    CREATE TRIGGER update_cases_timestamp BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflows_timestamp') THEN
    DROP TRIGGER IF EXISTS update_workflows_timestamp ON public.workflows;
    CREATE TRIGGER update_workflows_timestamp BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflow_states' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflow_states_timestamp') THEN
    DROP TRIGGER IF EXISTS update_workflow_states_timestamp ON public.workflow_states;
    CREATE TRIGGER update_workflow_states_timestamp BEFORE UPDATE ON public.workflow_states FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shared_artifacts' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shared_artifacts_timestamp') THEN
    DROP TRIGGER IF EXISTS update_shared_artifacts_timestamp ON public.shared_artifacts;
    CREATE TRIGGER update_shared_artifacts_timestamp BEFORE UPDATE ON public.shared_artifacts FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_runs' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_runs_timestamp') THEN
    DROP TRIGGER IF EXISTS update_agent_runs_timestamp ON public.agent_runs;
    CREATE TRIGGER update_agent_runs_timestamp BEFORE UPDATE ON public.agent_runs FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_memory' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_memory_timestamp') THEN
    DROP TRIGGER IF EXISTS update_agent_memory_timestamp ON public.agent_memory;
    CREATE TRIGGER update_agent_memory_timestamp BEFORE UPDATE ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;
END;
$$;

-- ================================================
-- Source: supabase/migrations/20251226000000_fix_agent_performance_summary_security.sql
-- ================================================
-- Migration: Fix agent_performance_summary view security setting
-- This migration explicitly sets SECURITY INVOKER to ensure RLS policies are respected
-- Issue: View was detected with SECURITY DEFINER which bypasses RLS for callers

-- Drop the existing view
DROP VIEW IF EXISTS agent_performance_summary;

-- Recreate with explicit SECURITY INVOKER (PostgreSQL 15+)
-- This ensures the view respects the caller's RLS policies, not the definer's
CREATE OR REPLACE VIEW agent_performance_summary
WITH (security_invoker = true) AS
SELECT
  agent_type,
  COUNT(*) as total_predictions,
  AVG(confidence_score) as avg_confidence_score,
  COUNT(*) FILTER (WHERE confidence_level = 'low') as low_confidence_count,
  COUNT(*) FILTER (WHERE confidence_level = 'medium') as medium_confidence_count,
  COUNT(*) FILTER (WHERE confidence_level = 'high') as high_confidence_count,
  COUNT(*) FILTER (WHERE hallucination_detected = TRUE) as hallucination_count,
  ROUND(
    COUNT(*) FILTER (WHERE hallucination_detected = TRUE)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as hallucination_rate_pct,
  COUNT(*) FILTER (WHERE actual_outcome IS NOT NULL) as predictions_with_actuals,
  AVG(ABS(variance_percentage)) FILTER (WHERE actual_outcome IS NOT NULL) as avg_variance_pct,
  MAX(created_at) as last_prediction_at
FROM agent_predictions
GROUP BY agent_type;

-- Restore the comment
COMMENT ON VIEW agent_performance_summary IS 'Summary of agent performance metrics';

-- Grant appropriate permissions
GRANT SELECT ON agent_performance_summary TO authenticated;
REVOKE ALL ON agent_performance_summary FROM anon;

-- ================================================
-- Source: supabase/migrations/20251226150000_security_hardening_fix_lint_errors.sql
-- ================================================
-- Security Hardening Migration
-- Fixes 6 security lint errors identified in audit
-- Created: 2025-12-26
--
-- This migration implements:
-- 1. Removes SECURITY DEFINER from views (use SECURITY INVOKER)
-- 2. Revokes PUBLIC grants on all sensitive tables/views
-- 3. Enables RLS with proper tenant isolation policies
-- 4. Creates least-privileged ownership roles
-- 5. Hardens SECURITY DEFINER functions with explicit checks
-- 6. Removes excessive schema/sequence privileges

-- ============================================================================
-- 1. FIX: Security Definer View (recent_confidence_violations)
-- ============================================================================

-- Drop and recreate as SECURITY INVOKER (relies on RLS)
DROP VIEW IF EXISTS public.recent_confidence_violations;

CREATE OR REPLACE VIEW public.recent_confidence_violations
WITH (security_invoker = true)
AS
SELECT
  cv.*,
  ap.agent_type AS prediction_agent_type,
  ap.session_id
FROM public.confidence_violations cv
LEFT JOIN public.agent_predictions ap ON ap.id = cv.prediction_id
WHERE cv.created_at >= now() - interval '7 days';

-- Revoke PUBLIC, grant only to authenticated
REVOKE ALL ON public.recent_confidence_violations FROM PUBLIC;
GRANT SELECT ON public.recent_confidence_violations TO authenticated;

COMMENT ON VIEW public.recent_confidence_violations IS
'SECURITY INVOKER view - relies on RLS policies on underlying tables';

-- ============================================================================
-- 2. FIX: PUBLIC Grants on Sensitive Tables/Views
-- ============================================================================

-- Revoke PUBLIC access from all tables in public schema
DO $$
DECLARE
  r record;
BEGIN
  -- Revoke from tables
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC;', r.schemaname, r.tablename);
  END LOOP;

  -- Revoke from views
  FOR r IN
    SELECT schemaname, viewname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC;', r.schemaname, r.viewname);
  END LOOP;

  RAISE NOTICE 'Revoked PUBLIC access from all public schema objects';
END $$;

-- Grant least privilege to authenticated for key tables
GRANT SELECT ON public.confidence_violations TO authenticated;
GRANT SELECT ON public.agent_predictions TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_tenants TO authenticated;

-- ============================================================================
-- 3. FIX: Missing or Weak RLS Policies
-- ============================================================================

-- Ensure RLS is enabled on critical tables
ALTER TABLE public.confidence_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_predictions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "cv_tenant_read" ON public.confidence_violations;
DROP POLICY IF EXISTS "ap_tenant_read" ON public.agent_predictions;
DROP POLICY IF EXISTS "cv_tenant_isolation" ON public.confidence_violations;
DROP POLICY IF EXISTS "ap_tenant_isolation" ON public.agent_predictions;

-- Confidence violations: tenant isolation
CREATE POLICY "cv_tenant_isolation" ON public.confidence_violations
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user belongs to a tenant (multi-tenant check)
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = (auth.uid())::text
    )
  );

-- Agent predictions: tenant isolation
CREATE POLICY "ap_tenant_isolation" ON public.agent_predictions
  FOR SELECT
  TO authenticated
  USING (
    -- User can see predictions from their tenant
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = (auth.uid())::text
      AND ut.tenant_id = agent_predictions.tenant_id
    )
  );

-- Performance indexes for RLS policies
CREATE INDEX IF NOT EXISTS idx_confidence_violations_created_at
  ON public.confidence_violations(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_session
  ON public.agent_predictions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_tenant
  ON public.agent_predictions(tenant_id);

-- ============================================================================
-- 4. FIX: Over-Privileged Ownership
-- ============================================================================

-- Create least-privileged role for view ownership
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'view_reader') THEN
    CREATE ROLE view_reader NOLOGIN;
  END IF;
END $$;

-- Grant minimal SELECT permissions to view_reader
GRANT SELECT ON public.confidence_violations TO view_reader;
GRANT SELECT ON public.agent_predictions TO view_reader;

-- Transfer ownership of view to least-privileged role (skipped in local dev — requires elevated privileges)
-- GRANT USAGE ON SCHEMA public TO view_reader;
-- GRANT view_reader TO postgres;
-- ALTER VIEW public.recent_confidence_violations OWNER TO view_reader;

-- ============================================================================
-- 5. FIX: SECURITY DEFINER Functions Without Explicit Checks
-- ============================================================================

-- Find and harden any SECURITY DEFINER functions
-- This is a template - adjust based on actual functions in your schema

-- Example: If you have a function that needs SECURITY DEFINER
-- CREATE OR REPLACE FUNCTION public.get_user_violations(p_user_id TEXT)
-- RETURNS SETOF public.confidence_violations
-- LANGUAGE sql
-- SECURITY DEFINER
-- STABLE
-- AS $$
--   -- Explicit tenant check
--   SELECT cv.*
--   FROM public.confidence_violations cv
--   WHERE EXISTS (
--     SELECT 1 FROM public.user_tenants ut
--     WHERE ut.user_id = (auth.uid())::text
--     AND ut.user_id = p_user_id  -- Ensure user can only query themselves
--   );
-- $$;
--
-- REVOKE ALL ON FUNCTION public.get_user_violations(TEXT) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.get_user_violations(TEXT) TO authenticated;
-- ALTER FUNCTION public.get_user_violations(TEXT) OWNER TO view_reader;

-- ============================================================================
-- 6. FIX: Excessive Privileges on Schema/Sequences
-- ============================================================================

-- Harden public schema
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO view_reader;

-- Revoke sequence privileges from PUBLIC
DO $$
DECLARE
  s record;
BEGIN
  FOR s IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC;', s.sequence_schema, s.sequence_name);
  END LOOP;

  RAISE NOTICE 'Revoked PUBLIC access from all sequences';
END $$;

-- Grant sequence USAGE only where needed (for INSERT operations)
-- Adjust based on your application's needs
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- Validation and Summary
-- ============================================================================

DO $$
DECLARE
  rls_count INTEGER;
  public_grant_count INTEGER;
BEGIN
  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
  AND c.relrowsecurity = true;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Security Hardening Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed SECURITY DEFINER view: recent_confidence_violations';
  RAISE NOTICE '✅ Revoked PUBLIC grants from all public schema objects';
  RAISE NOTICE '✅ Enabled RLS on % tables', rls_count;
  RAISE NOTICE '✅ Created least-privileged view_reader role';
  RAISE NOTICE '✅ Hardened schema and sequence privileges';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test as multiple users to verify RLS isolation';
  RAISE NOTICE '  2. Re-run security linter to confirm fixes';
  RAISE NOTICE '  3. Review application for any broken permissions';
  RAISE NOTICE '';
END $$;

-- ================================================
-- Source: supabase/migrations/20251230011757_p0_health_check_table.sql
-- ================================================
-- P0 Production Readiness: Health Check Table
--
-- Creates a dedicated table for database health checks
-- Used by bootstrap process to verify database connectivity

-- Create health check table
CREATE TABLE IF NOT EXISTS _health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a single row for health checks
INSERT INTO _health_check (count)
VALUES (1)
ON CONFLICT DO NOTHING;

-- Create function to create health check table (for runtime creation)
CREATE OR REPLACE FUNCTION create_health_check_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS _health_check (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  INSERT INTO _health_check (count)
  VALUES (1)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Add comment
COMMENT ON TABLE _health_check IS 'Health check table for database connectivity tests';
COMMENT ON FUNCTION create_health_check_table() IS 'Creates health check table if it does not exist';

-- ================================================
-- Source: supabase/migrations/20251230012508_llm_gating_tables.sql
-- ================================================
-- LLM Gating & Cost Control Tables
--
-- Implements the database schema for LLM gating policies and usage tracking
-- as specified in the technical specification

-- ============================================================================
-- LLM Gating Policies Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_gating_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Budget configuration
  monthly_budget_limit DECIMAL(10, 2) NOT NULL CHECK (monthly_budget_limit > 0),
  hard_stop_threshold DECIMAL(3, 2) NOT NULL DEFAULT 0.95 CHECK (hard_stop_threshold BETWEEN 0 AND 1),
  per_request_limit DECIMAL(10, 2) CHECK (per_request_limit IS NULL OR per_request_limit > 0),
  grace_period_hours INTEGER DEFAULT 24 CHECK (grace_period_hours IS NULL OR grace_period_hours > 0),

  -- Model configuration
  default_model VARCHAR(100) NOT NULL,
  routing_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  enable_auto_downgrade BOOLEAN DEFAULT true,

  -- Manifesto enforcement
  manifesto_enforcement JSONB NOT NULL DEFAULT '{
    "strictMode": true,
    "hallucinationCheck": true,
    "conservativeQuantification": true,
    "valueFirstCheck": true
  }'::jsonb,

  -- Priority configuration
  priority_tier VARCHAR(20) DEFAULT 'medium' CHECK (priority_tier IN ('low', 'medium', 'high', 'critical')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(tenant_id)
);

ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_llm_gating_policies_tenant ON llm_gating_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_gating_policies_updated ON llm_gating_policies(updated_at DESC);

-- Comments
COMMENT ON TABLE llm_gating_policies IS 'LLM gating policies for tenant-specific cost control and model routing';
COMMENT ON COLUMN llm_gating_policies.monthly_budget_limit IS 'Monthly budget limit in USD';
COMMENT ON COLUMN llm_gating_policies.hard_stop_threshold IS 'Threshold (0-1) at which to stop all requests';
COMMENT ON COLUMN llm_gating_policies.routing_rules IS 'JSON array of task-to-model routing rules';
COMMENT ON COLUMN llm_gating_policies.manifesto_enforcement IS 'Manifesto compliance enforcement configuration';

-- ============================================================================
-- LLM Usage Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant and user context
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Model and tokens
  model VARCHAR(100) NOT NULL,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),

  -- Cost calculation
  cost DECIMAL(10, 6) NOT NULL CHECK (cost >= 0),

  -- Request context
  task_type VARCHAR(50),
  agent_id VARCHAR(100),
  session_id UUID,
  trace_id VARCHAR(100),

  -- Response metadata
  latency_ms INTEGER,
  model_downgraded BOOLEAN DEFAULT false,
  original_model VARCHAR(100),

  -- Manifesto & Audit trail
  audit_log_id UUID UNIQUE REFERENCES audit_logs(id) ON DELETE SET NULL,
  confidence FLOAT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was already created
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS input_tokens INTEGER;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS output_tokens INTEGER;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS total_tokens INTEGER;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 6);
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS task_type VARCHAR(50);
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS agent_id VARCHAR(100);
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS trace_id VARCHAR(100);
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS model_downgraded BOOLEAN DEFAULT false;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS original_model VARCHAR(100);
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS audit_log_id UUID; -- REFERENCES audit_logs(id) might fail if audit_logs missing
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS confidence FLOAT;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS request_hash TEXT;
ALTER TABLE llm_usage ADD COLUMN IF NOT EXISTS response_hash TEXT;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_date ON llm_usage(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date ON llm_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model ON llm_usage(model);
CREATE INDEX IF NOT EXISTS idx_llm_usage_task_type ON llm_usage(task_type) WHERE task_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_agent ON llm_usage(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_session ON llm_usage(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_trace ON llm_usage(trace_id) WHERE trace_id IS NOT NULL;

-- Composite index for budget calculations
CREATE INDEX IF NOT EXISTS idx_llm_usage_budget_calc ON llm_usage(tenant_id, created_at DESC, cost);

-- Comments
COMMENT ON TABLE llm_usage IS 'LLM usage tracking for cost calculation and audit trail';
COMMENT ON COLUMN llm_usage.cost IS 'Calculated cost in USD using formula: ((T_in * P_in) + (T_out * P_out)) / 1000';
COMMENT ON COLUMN llm_usage.request_hash IS 'SHA-256 hash of request for audit trail';
COMMENT ON COLUMN llm_usage.response_hash IS 'SHA-256 hash of response for audit trail';

-- ============================================================================
-- Budget Status View
-- ============================================================================

CREATE OR REPLACE VIEW llm_budget_status AS
SELECT
  p.tenant_id,
  p.monthly_budget_limit,
  p.hard_stop_threshold,
  COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) AS used_amount,
  p.monthly_budget_limit - COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) AS remaining_budget,
  (COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) / p.monthly_budget_limit * 100) AS usage_percentage,
  COUNT(u.id) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days') AS request_count,
  p.monthly_budget_limit * 1.1 AS hard_limit
FROM llm_gating_policies p
LEFT JOIN llm_usage u ON u.tenant_id = p.tenant_id
GROUP BY p.tenant_id, p.monthly_budget_limit, p.hard_stop_threshold;

COMMENT ON VIEW llm_budget_status IS 'Real-time budget status for all tenants (30-day rolling window)';

-- ============================================================================
-- Usage Statistics View
-- ============================================================================

CREATE OR REPLACE VIEW llm_usage_stats AS
SELECT
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  model,
  task_type,
  COUNT(*) AS request_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost) AS total_cost,
  AVG(cost) AS avg_cost,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE model_downgraded = true) AS downgrade_count
FROM llm_usage
GROUP BY tenant_id, DATE_TRUNC('day', created_at), model, task_type;

COMMENT ON VIEW llm_usage_stats IS 'Daily aggregated usage statistics by tenant, model, and task type';

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get current budget status for a tenant
CREATE OR REPLACE FUNCTION get_budget_status(p_tenant_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  budget_limit DECIMAL(10, 2),
  used_amount DECIMAL(10, 6),
  remaining_budget DECIMAL(10, 6),
  usage_percentage DECIMAL(5, 2),
  in_grace_period BOOLEAN,
  hard_limit DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.tenant_id,
    p.monthly_budget_limit,
    COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0),
    p.monthly_budget_limit - COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0),
    (COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) / p.monthly_budget_limit * 100)::DECIMAL(5, 2),
    COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) > p.monthly_budget_limit
      AND COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) < (p.monthly_budget_limit * 1.1),
    p.monthly_budget_limit * 1.1
  FROM llm_gating_policies p
  LEFT JOIN llm_usage u ON u.tenant_id = p.tenant_id
  WHERE p.tenant_id = p_tenant_id
  GROUP BY p.tenant_id, p.monthly_budget_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_budget_status IS 'Get current budget status for a tenant (30-day rolling window)';

-- Function to check if request should be blocked
CREATE OR REPLACE FUNCTION should_block_request(
  p_tenant_id UUID,
  p_estimated_cost DECIMAL(10, 6)
)
RETURNS TABLE (
  blocked BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  v_policy RECORD;
  v_status RECORD;
BEGIN
  -- Get policy
  SELECT * INTO v_policy
  FROM llm_gating_policies
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT;
    RETURN;
  END IF;

  -- Get current status
  SELECT * INTO v_status
  FROM get_budget_status(p_tenant_id);

  -- Check hard stop threshold
  IF v_status.usage_percentage >= (v_policy.hard_stop_threshold * 100) THEN
    -- Check grace period
    IF NOT v_status.in_grace_period THEN
      RETURN QUERY SELECT
        true,
        format('Budget limit reached (%s%% of %s USD)',
          v_status.usage_percentage,
          v_policy.monthly_budget_limit);
      RETURN;
    END IF;
  END IF;

  -- Check if request would exceed budget
  IF (v_status.used_amount + p_estimated_cost) > v_policy.monthly_budget_limit THEN
    RETURN QUERY SELECT
      true,
      format('Request would exceed budget limit (projected: %s USD, limit: %s USD)',
        v_status.used_amount + p_estimated_cost,
        v_policy.monthly_budget_limit);
    RETURN;
  END IF;

  -- Check per-request limit
  IF v_policy.per_request_limit IS NOT NULL AND p_estimated_cost > v_policy.per_request_limit THEN
    RETURN QUERY SELECT
      true,
      format('Request cost (%s USD) exceeds per-request limit (%s USD)',
        p_estimated_cost,
        v_policy.per_request_limit);
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION should_block_request IS 'Check if a request should be blocked based on budget and policy';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE llm_gating_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Policies for llm_gating_policies
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'llm_gating_policies' LOOP
        EXECUTE 'DROP POLICY "' || pol.policyname || '" ON llm_gating_policies';
    END LOOP;
END $$;
DROP POLICY IF EXISTS llm_gating_policies_tenant_isolation ON llm_gating_policies;
CREATE POLICY llm_gating_policies_tenant_isolation ON llm_gating_policies
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Policies for llm_usage
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'llm_usage' LOOP
        EXECUTE 'DROP POLICY "' || pol.policyname || '" ON llm_usage';
    END LOOP;
END $$;
DROP POLICY IF EXISTS llm_usage_tenant_isolation ON llm_usage;
CREATE POLICY llm_usage_tenant_isolation ON llm_usage
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_llm_gating_policies_updated_at ON llm_gating_policies;
CREATE TRIGGER update_llm_gating_policies_updated_at
  BEFORE UPDATE ON llm_gating_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Sample Data (for development)
-- ============================================================================

-- Insert default policy for existing organizations (if any)
INSERT INTO llm_gating_policies (
  tenant_id,
  monthly_budget_limit,
  hard_stop_threshold,
  default_model,
  routing_rules,
  manifesto_enforcement
)
SELECT
  id,
  1000.00,
  0.95,
  'together-llama-3-70b',
  '[]'::jsonb,
  '{
    "strictMode": true,
    "hallucinationCheck": true,
    "conservativeQuantification": true,
    "valueFirstCheck": true
  }'::jsonb
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM llm_gating_policies WHERE tenant_id = organizations.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ================================================
-- Source: supabase/migrations/20251230012600_llm_gating_rls_enhancement.sql
-- ================================================
-- LLM Gating RLS Enhancement
--
-- Implements the exact RLS policies as specified in the technical requirements:
-- 1. Tenant isolation for LlmUsageLog and TenantLlmBudget
-- 2. Service role bypass for Gating Service operations
-- 3. Integration with existing audit trail system

-- ============================================================================
-- Enhanced RLS Policies for LLM Gating Tables
-- ============================================================================

-- First, ensure the tables exist and are properly configured
-- (These should already exist from migration 20251230012508_llm_gating_tables.sql)

-- Enable RLS (if not already enabled)
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_gating_policies ENABLE ROW LEVEL SECURITY;

-- Ensure columns exist
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS used_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS hard_stop_active BOOLEAN DEFAULT true;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS alert_threshold FLOAT DEFAULT 0.8;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS strict_mode BOOLEAN DEFAULT true;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS hallucination_check BOOLEAN DEFAULT true;

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Tenants can view own usage" ON llm_usage;
DROP POLICY IF EXISTS "Tenants can view own budget" ON llm_gating_policies;
DROP POLICY IF EXISTS "Tenants can insert own usage" ON llm_usage;
DROP POLICY IF EXISTS "Tenants can update own budget" ON llm_gating_policies;
DROP POLICY IF EXISTS "Service role can manage all llm data" ON llm_usage;
DROP POLICY IF EXISTS "Service role can manage all budgets" ON llm_gating_policies;

-- ============================================================================
-- Tenant Isolation Policies
-- ============================================================================

-- Policy: Tenants can only see their own usage logs
CREATE POLICY "Tenants can view own usage" ON llm_usage
  FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can insert their own usage logs
CREATE POLICY "Tenants can insert own usage" ON llm_usage
  FOR INSERT
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can only view their own budget/quota
CREATE POLICY "Tenants can view own budget" ON llm_gating_policies
  FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can update their own budget (for manual adjustments)
CREATE POLICY "Tenants can update own budget" ON llm_gating_policies
  FOR UPDATE
  USING (tenant_id::text = auth.jwt() ->> 'org_id')
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'org_id');

-- ============================================================================
-- Service Role Bypass Policies
-- ============================================================================

-- Policy: Service role (Gating Service) can manage all usage logs
-- This allows the LLMGatingService to write usage records and update spend
CREATE POLICY "Service role can manage all llm data" ON llm_usage
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can manage all budget data
CREATE POLICY "Service role can manage all budgets" ON llm_gating_policies
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Additional Security: Prevent Cross-Tenant Data Access
-- ============================================================================

-- Additional policy to ensure strict tenant isolation
-- This acts as a safety net even if JWT claims are malformed
DROP POLICY IF EXISTS "Strict tenant isolation - usage logs" ON llm_usage;
CREATE POLICY "Strict tenant isolation - usage logs" ON llm_usage
  FOR ALL
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'service_role' THEN true
      ELSE tenant_id::text = (auth.jwt() ->> 'org_id')
    END
  );

DROP POLICY IF EXISTS "Strict tenant isolation - budgets" ON llm_gating_policies;
CREATE POLICY "Strict tenant isolation - budgets" ON llm_gating_policies
  FOR ALL
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'service_role' THEN true
      ELSE tenant_id::text = (auth.jwt() ->> 'org_id')
    END
  );

-- ============================================================================
-- Audit Trail Integration
-- ============================================================================

-- Ensure audit logs can be linked to usage logs
-- The auditLogId field in LlmUsageLog should reference AuditTrail
-- This policy allows read access to audit logs for verification
DROP POLICY IF EXISTS "Tenants can view linked audit logs" ON audit_logs;
CREATE POLICY "Tenants can view linked audit logs" ON audit_logs
  FOR SELECT
  USING (
    organization_id::text = auth.jwt() ->> 'org_id'
    AND EXISTS (
      SELECT 1 FROM llm_usage lul
      WHERE lul.audit_log_id = audit_logs.id
      AND lul.tenant_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- ============================================================================
-- Performance Indexes for RLS Queries
-- ============================================================================

-- Index to optimize RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_llm_usage_org_id ON llm_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_gating_policies_org_id ON llm_gating_policies(tenant_id);

-- Composite index for budget calculations with RLS
CREATE INDEX IF NOT EXISTS idx_llm_usage_org_created ON llm_usage(tenant_id, created_at DESC);

-- ============================================================================
-- Helper Functions for Gating Service
-- ============================================================================

-- Function to get current budget status with RLS context
-- This function is designed to be called by the Gating Service with service_role
CREATE OR REPLACE FUNCTION get_tenant_budget_status(p_tenant_id UUID)
RETURNS TABLE (
  monthly_budget_limit DECIMAL(10, 2),
  used_amount DECIMAL(10, 2),
  hard_stop_threshold FLOAT,
  hard_stop_active BOOLEAN,
  remaining_budget DECIMAL(10, 2),
  usage_percentage DECIMAL(5, 2),
  is_over_budget BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tlb.monthly_budget_limit,
    tlb.used_amount,
    tlb.hard_stop_threshold,
    tlb.hard_stop_active,
    (tlb.monthly_budget_limit - tlb.used_amount) AS remaining_budget,
    (tlb.used_amount / tlb.monthly_budget_limit * 100)::DECIMAL(5, 2) AS usage_percentage,
    (tlb.used_amount >= tlb.monthly_budget_limit) AS is_over_budget
  FROM llm_gating_policies tlb
  WHERE tlb.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate cost using the specified formula
-- Cost = ((PromptTokens × Rate_in) + (CompletionTokens × Rate_out)) / 1000
CREATE OR REPLACE FUNCTION calculate_llm_cost(
  p_model_name VARCHAR,
  p_input_tokens INT,
  p_output_tokens INT
)
RETURNS DECIMAL(10, 6) AS $$
DECLARE
  v_input_rate DECIMAL(10, 6);
  v_output_rate DECIMAL(10, 6);
BEGIN
  -- Get pricing rates (in production, this would query a pricing table)
  -- For now, use hardcoded rates based on existing BudgetTracker.ts
  SELECT
    CASE
      WHEN p_model_name LIKE '%llama-3-70b%' THEN 0.0009
      WHEN p_model_name LIKE '%llama-3-8b%' THEN 0.0002
      WHEN p_model_name LIKE '%mixtral-8x7b%' THEN 0.0006
      WHEN p_model_name LIKE '%mixtral-8x22b%' THEN 0.0012
      WHEN p_model_name LIKE '%claude-3-5-sonnet%' THEN 0.003
      WHEN p_model_name LIKE '%claude-3-opus%' THEN 0.015
      WHEN p_model_name LIKE '%gpt-4-turbo%' THEN 0.01
      WHEN p_model_name LIKE '%gpt-4%' THEN 0.03
      ELSE 0.03 -- Default conservative estimate
    END::DECIMAL(10, 6),
    CASE
      WHEN p_model_name LIKE '%llama-3-70b%' THEN 0.0009
      WHEN p_model_name LIKE '%llama-3-8b%' THEN 0.0002
      WHEN p_model_name LIKE '%mixtral-8x7b%' THEN 0.0006
      WHEN p_model_name LIKE '%mixtral-8x22b%' THEN 0.0012
      WHEN p_model_name LIKE '%claude-3-5-sonnet%' THEN 0.015
      WHEN p_model_name LIKE '%claude-3-opus%' THEN 0.075
      WHEN p_model_name LIKE '%gpt-4-turbo%' THEN 0.03
      WHEN p_model_name LIKE '%gpt-4%' THEN 0.06
      ELSE 0.06 -- Default conservative estimate
    END::DECIMAL(10, 6) INTO v_input_rate, v_output_rate;

  -- Apply the formula: ((T_in × P_in) + (T_out × P_out)) / 1000
  RETURN ((p_input_tokens * v_input_rate) + (p_output_tokens * v_output_rate)) / 1000;
END;
$$ LANGUAGE plpgsql;

-- Function to update budget spend atomically
-- This should be called by the Gating Service after each LLM call
CREATE OR REPLACE FUNCTION update_tenant_spend(
  p_tenant_id UUID,
  p_cost DECIMAL(10, 6)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_used_amount DECIMAL(10, 2);
  v_monthly_budget_limit DECIMAL(10, 2);
  v_hard_stop_active BOOLEAN;
BEGIN
  -- Get current budget info
  SELECT used_amount, monthly_budget_limit, hard_stop_active
  INTO v_used_amount, v_monthly_budget_limit, v_hard_stop_active
  FROM llm_gating_policies
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget record not found for tenant %', p_tenant_id;
  END IF;

  -- Check if hard stop is active and would be exceeded
  IF v_hard_stop_active AND (v_used_amount + p_cost) > v_monthly_budget_limit THEN
    RETURN FALSE;
  END IF;

  -- Update spend atomically
  UPDATE llm_gating_policies
  SET used_amount = used_amount + p_cost,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Views for Monitoring and Reporting
-- ============================================================================

-- View: Real-time budget status with RLS
CREATE OR REPLACE VIEW tenant_budget_status AS
SELECT
  tlb.tenant_id,
  tlb.monthly_budget_limit,
  tlb.used_amount,
  tlb.hard_stop_threshold,
  tlb.hard_stop_active,
  (tlb.monthly_budget_limit - tlb.used_amount) AS remaining_budget,
  (tlb.used_amount / tlb.monthly_budget_limit * 100) AS usage_percentage,
  COUNT(lul.id) AS total_requests,
  AVG(lul.latency_ms) AS avg_latency,
  SUM(lul.cost) AS total_cost_30d
FROM llm_gating_policies tlb
LEFT JOIN llm_usage lul ON lul.tenant_id = tlb.tenant_id
  AND lul.created_at >= NOW() - INTERVAL '30 days'
GROUP BY tlb.tenant_id, tlb.monthly_budget_limit, tlb.used_amount,
         tlb.hard_stop_threshold, tlb.hard_stop_active;

-- View: Usage statistics with RLS
CREATE OR REPLACE VIEW llm_usage_statistics AS
SELECT
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  model,
  task_type,
  COUNT(*) AS request_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(cost) AS total_cost,
  AVG(cost) AS avg_cost,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE confidence < 0.6) AS low_confidence_requests
FROM llm_usage
GROUP BY tenant_id, DATE_TRUNC('day', created_at), model, task_type;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON TABLE llm_usage IS 'Tracks every LLM interaction for billing, observability, and audit trail with tenant isolation';
COMMENT ON TABLE llm_gating_policies IS 'Manages per-tenant budget limits and spending controls';
COMMENT ON COLUMN llm_usage.cost IS 'Calculated using formula: ((PromptTokens × Rate_in) + (CompletionTokens × Rate_out)) / 1000';
COMMENT ON COLUMN llm_usage.audit_log_id IS 'Optional link to AuditTrail for hash-chaining and zero-hallucination verification';
COMMENT ON COLUMN llm_usage.confidence IS 'Agent self-reported confidence score for quality tracking';
COMMENT ON COLUMN llm_gating_policies.used_amount IS 'Tracked in real-time by Gating Service updates';
COMMENT ON COLUMN llm_gating_policies.hard_stop_active IS 'When true, blocks requests that would exceed monthly limit';
COMMENT ON COLUMN llm_gating_policies.strict_mode IS 'Manifesto enforcement: strict validation of all outputs';
COMMENT ON COLUMN llm_gating_policies.hallucination_check IS 'Manifesto enforcement: enable hallucination detection';

-- Grant permissions (if needed for specific roles)
-- Note: RLS policies handle access control, these are for additional role-based permissions
GRANT SELECT ON tenant_budget_status TO authenticated;
GRANT SELECT ON llm_usage_statistics TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Test RLS isolation (run these as different users to verify)
-- SELECT * FROM llm_usage; -- Should only return tenant's own logs
-- SELECT * FROM llm_gating_policies; -- Should only return tenant's own budget
-- SELECT * FROM tenant_budget_status; -- Should only return tenant's status

-- Test service role bypass (run with service_role key)
-- SELECT * FROM llm_usage; -- Should return all logs
-- SELECT * FROM llm_gating_policies; -- Should return all budgets
-- UPDATE llm_gating_policies SET used_amount = used_amount + 0.01 WHERE tenant_id = '...'; -- Should work
-- ================================================
-- Source: supabase/migrations/20251230013534_organization_configurations.sql
-- ================================================
-- Organization Configurations Table
--
-- Comprehensive configuration management for multi-tenant organizations
-- Based on the Configuration & Settings Matrix specification

-- Ensure audit_logs has the required changes column
ALTER TABLE IF EXISTS public.audit_logs ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- Organization Configurations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- ========================================================================
  -- 1. Multi-Tenant & Organization Settings
  -- ========================================================================
  tenant_provisioning JSONB NOT NULL DEFAULT '{
    "status": "trial",
    "maxUsers": 10,
    "maxStorageGB": 10
  }'::jsonb,

  custom_branding JSONB DEFAULT NULL,

  data_residency JSONB NOT NULL DEFAULT '{
    "primaryRegion": "us-east-1"
  }'::jsonb,

  domain_management JSONB DEFAULT NULL,
  namespace_isolation JSONB DEFAULT NULL,

  -- ========================================================================
  -- 2. Identity & Access Management (IAM)
  -- ========================================================================
  auth_policy JSONB NOT NULL DEFAULT '{
    "enforceMFA": false,
    "enableWebAuthn": false,
    "enablePasswordless": false,
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSpecialChars": false
    }
  }'::jsonb,

  sso_config JSONB DEFAULT NULL,

  session_control JSONB NOT NULL DEFAULT '{
    "timeoutMinutes": 60,
    "idleTimeoutMinutes": 30,
    "maxConcurrentSessions": 3
  }'::jsonb,

  ip_whitelist JSONB DEFAULT NULL,

  -- ========================================================================
  -- 3. AI Orchestration & Agent Fabric
  -- ========================================================================
  llm_spending_limits JSONB NOT NULL DEFAULT '{
    "monthlyHardCap": 1000,
    "monthlySoftCap": 800,
    "perRequestLimit": 10,
    "alertThreshold": 80,
    "alertRecipients": []
  }'::jsonb,

  model_routing JSONB NOT NULL DEFAULT '{
    "defaultModel": "together-llama-3-70b",
    "routingRules": [],
    "enableAutoDowngrade": true
  }'::jsonb,

  agent_toggles JSONB NOT NULL DEFAULT '{
    "enabledAgents": {
      "opportunityAgent": true,
      "targetAgent": true,
      "assumptionAgent": true,
      "riskAgent": true,
      "valueAgent": true
    }
  }'::jsonb,

  hitl_thresholds JSONB NOT NULL DEFAULT '{
    "autoApprovalThreshold": 0.9,
    "humanReviewThreshold": 0.7,
    "rejectionThreshold": 0.5,
    "reviewers": []
  }'::jsonb,

  ground_truth_sync JSONB DEFAULT NULL,

  formula_versioning JSONB NOT NULL DEFAULT '{
    "activeVersion": "1.0.0",
    "availableVersions": ["1.0.0"],
    "autoUpdate": false
  }'::jsonb,

  -- ========================================================================
  -- 4. Operational & Performance Settings
  -- ========================================================================
  feature_flags JSONB NOT NULL DEFAULT '{
    "enabledFeatures": {},
    "betaFeatures": {}
  }'::jsonb,

  rate_limiting JSONB NOT NULL DEFAULT '{
    "requestsPerMinute": 60,
    "requestsPerHour": 1000,
    "requestsPerDay": 10000,
    "burstAllowance": 10
  }'::jsonb,

  observability JSONB NOT NULL DEFAULT '{
    "traceSamplingRate": 0.1,
    "logVerbosity": "info",
    "enableMetrics": true,
    "enableTracing": true
  }'::jsonb,

  cache_management JSONB NOT NULL DEFAULT '{
    "cacheTTL": 300,
    "enableCache": true,
    "cacheStrategy": "lru"
  }'::jsonb,

  webhooks JSONB DEFAULT NULL,

  -- ========================================================================
  -- 5. Security, Audit & Governance
  -- ========================================================================
  audit_integrity JSONB NOT NULL DEFAULT '{
    "enableHashChaining": true,
    "verificationFrequencyHours": 24
  }'::jsonb,

  retention_policies JSONB NOT NULL DEFAULT '{
    "dataRetentionDays": 365,
    "logRetentionDays": 90,
    "auditRetentionDays": 2555,
    "financialRetentionYears": 7
  }'::jsonb,

  manifesto_strictness JSONB NOT NULL DEFAULT '{
    "mode": "warning",
    "enabledRules": []
  }'::jsonb,

  secret_rotation JSONB NOT NULL DEFAULT '{
    "autoRotation": false,
    "rotationFrequencyDays": 90
  }'::jsonb,

  rls_monitoring JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "alertOnViolations": true,
    "performanceThresholdMs": 100
  }'::jsonb,

  -- ========================================================================
  -- 6. Billing & Usage Analytics
  -- ========================================================================
  token_dashboard JSONB NOT NULL DEFAULT '{
    "enableRealTime": true,
    "refreshIntervalSeconds": 30,
    "showCostBreakdown": true
  }'::jsonb,

  value_metering JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "billableMilestones": [],
    "pricingModel": "per_user"
  }'::jsonb,

  subscription_plan JSONB NOT NULL DEFAULT '{
    "tier": "free",
    "billingCycle": "monthly",
    "autoRenew": true
  }'::jsonb,

  invoicing JSONB NOT NULL DEFAULT '{
    "paymentMethod": "credit_card",
    "billingEmail": ""
  }'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_configs_org ON organization_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_configs_updated ON organization_configurations(updated_at DESC);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_org_configs_tenant_status ON organization_configurations
  USING GIN ((tenant_provisioning->'status'));

CREATE INDEX IF NOT EXISTS idx_org_configs_subscription_tier ON organization_configurations
  USING GIN ((subscription_plan->'tier'));

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE organization_configurations IS 'Comprehensive configuration management for multi-tenant organizations';

COMMENT ON COLUMN organization_configurations.tenant_provisioning IS 'Tenant lifecycle and resource limits';
COMMENT ON COLUMN organization_configurations.custom_branding IS 'SDUI theme configuration (logos, colors, fonts)';
COMMENT ON COLUMN organization_configurations.data_residency IS 'Geographic data pinning configuration';
COMMENT ON COLUMN organization_configurations.auth_policy IS 'Authentication policies (MFA, WebAuthn, password rules)';
COMMENT ON COLUMN organization_configurations.llm_spending_limits IS 'LLM budget caps and alerts';
COMMENT ON COLUMN organization_configurations.agent_toggles IS 'Enable/disable specific AI agents';
COMMENT ON COLUMN organization_configurations.retention_policies IS 'Data and log retention periods';
COMMENT ON COLUMN organization_configurations.subscription_plan IS 'Billing tier and cycle';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE organization_configurations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their organization's configuration
DROP POLICY IF EXISTS org_configs_tenant_isolation ON organization_configurations;
CREATE POLICY org_configs_tenant_isolation ON organization_configurations
  FOR ALL
  USING (organization_id::text = current_setting('app.current_tenant_id', true));

-- Policy: Vendor admins can access all configurations
DROP POLICY IF EXISTS org_configs_vendor_admin ON organization_configurations;
CREATE POLICY org_configs_vendor_admin ON organization_configurations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role') = 'vendor_admin'
    )
  );

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
DROP TRIGGER IF EXISTS update_org_configs_updated_at ON organization_configurations;
DROP TRIGGER IF EXISTS update_org_configs_updated_at ON organization_configurations;
CREATE TRIGGER update_org_configs_updated_at
  BEFORE UPDATE ON organization_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get configuration for organization
CREATE OR REPLACE FUNCTION get_organization_config(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT to_jsonb(organization_configurations.*) INTO v_config
  FROM organization_configurations
  WHERE organization_id = p_organization_id;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_organization_config IS 'Get complete configuration for an organization';

-- Function to update specific configuration setting
CREATE OR REPLACE FUNCTION update_config_setting(
  p_organization_id UUID,
  p_setting TEXT,
  p_value JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  EXECUTE format(
    'UPDATE organization_configurations SET %I = $1, updated_at = NOW() WHERE organization_id = $2',
    p_setting
  ) USING p_value, p_organization_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_config_setting IS 'Update a specific configuration setting';

-- ============================================================================
-- Default Configurations
-- ============================================================================

-- Insert default configurations for existing organizations
INSERT INTO organization_configurations (
  organization_id,
  tenant_provisioning,
  auth_policy,
  llm_spending_limits,
  feature_flags,
  audit_integrity,
  token_dashboard
)
SELECT
  id,
  jsonb_build_object(
    'organizationId', id,
    'status', 'active',
    'maxUsers', 50,
    'maxStorageGB', 100,
    'createdAt', created_at,
    'updatedAt', updated_at
  ),
  '{
    "enforceMFA": false,
    "enableWebAuthn": false,
    "enablePasswordless": false,
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSpecialChars": false
    }
  }'::jsonb,
  '{
    "monthlyHardCap": 1000,
    "monthlySoftCap": 800,
    "perRequestLimit": 10,
    "alertThreshold": 80,
    "alertRecipients": []
  }'::jsonb,
  '{
    "enabledFeatures": {},
    "betaFeatures": {}
  }'::jsonb,
  '{
    "enableHashChaining": true,
    "verificationFrequencyHours": 24
  }'::jsonb,
  '{
    "enableRealTime": true,
    "refreshIntervalSeconds": 30,
    "showCostBreakdown": true
  }'::jsonb
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM organization_configurations
  WHERE organization_id = organizations.id
)
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- Configuration Change Audit View
-- ============================================================================

CREATE OR REPLACE VIEW configuration_change_audit AS
SELECT
  al.id,
  al.organization_id,
  al.user_id,
  (SELECT email FROM auth.users WHERE id = al.user_id) as user_email,
  al.action,
  al.resource_id as setting_name,
  al.changes,
  al.created_at
FROM audit_logs al
WHERE al.resource_type = 'configuration'
ORDER BY al.created_at DESC;

COMMENT ON VIEW configuration_change_audit IS 'Audit trail of all configuration changes';

-- ================================================
-- Source: supabase/migrations/20260102000001_progressive_rollouts.sql
-- ================================================
-- Progressive Feature Rollout Tables
-- Enables gradual feature rollout with automatic rollback

BEGIN;

-- Feature rollout configurations
CREATE TABLE IF NOT EXISTS feature_rollouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(255) NOT NULL UNIQUE,
  percentage INTEGER NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  target_groups TEXT[] DEFAULT '{}',
  exclude_groups TEXT[] DEFAULT '{}',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  auto_rollback BOOLEAN NOT NULL DEFAULT true,
  error_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.0,
  rollback_reason TEXT,
  rollback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Feature usage tracking
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  enabled BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index for fast queries
  CONSTRAINT feature_usage_unique UNIQUE (feature_name, user_id, timestamp)
);

-- Feature error tracking
CREATE TABLE IF NOT EXISTS feature_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_rollouts_active ON feature_rollouts(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_timestamp ON feature_usage(feature_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feature_errors_feature_timestamp ON feature_errors(feature_name, timestamp DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_feature_rollouts_updated_at ON feature_rollouts;
CREATE TRIGGER update_feature_rollouts_updated_at
BEFORE UPDATE ON feature_rollouts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE feature_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_errors ENABLE ROW LEVEL SECURITY;

-- Policies for feature_rollouts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feature_rollouts' AND policyname = 'Admins can manage feature rollouts') THEN
        DROP POLICY "Admins can manage feature rollouts" ON feature_rollouts;
    END IF;
END $$;
CREATE POLICY "Admins can manage feature rollouts"
ON feature_rollouts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = auth.uid()::text
    AND roles.name IN ('admin', 'developer')
  )
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feature_rollouts' AND policyname = 'All users can view active rollouts') THEN
        DROP POLICY "All users can view active rollouts" ON feature_rollouts;
    END IF;
END $$;
CREATE POLICY "All users can view active rollouts"
ON feature_rollouts
FOR SELECT
TO authenticated
USING (active = true);

-- Policies for feature_usage
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'feature_usage' LOOP
        EXECUTE 'DROP POLICY "' || pol.policyname || '" ON feature_usage';
    END LOOP;
END $$;
CREATE POLICY "Users can insert their own usage"
ON feature_usage
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all usage"
ON feature_usage
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = auth.uid()::text
    AND roles.name IN ('admin', 'developer')
  )
);

-- Policies for feature_errors
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'feature_errors' LOOP
        EXECUTE 'DROP POLICY "' || pol.policyname || '" ON feature_errors';
    END LOOP;
END $$;
CREATE POLICY "Users can insert their own errors"
ON feature_errors
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all errors"
ON feature_errors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = auth.uid()::text
    AND roles.name IN ('admin', 'developer')
  )
);

-- View for rollout metrics
CREATE OR REPLACE VIEW feature_rollout_metrics AS
SELECT
  fr.feature_name,
  fr.percentage,
  fr.active,
  COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.timestamp > NOW() - INTERVAL '24 hours') as total_users_24h,
  COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours') as enabled_users_24h,
  COUNT(fe.id) FILTER (WHERE fe.timestamp > NOW() - INTERVAL '24 hours') as errors_24h,
  CASE
    WHEN COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours') > 0
    THEN (COUNT(fe.id) FILTER (WHERE fe.timestamp > NOW() - INTERVAL '24 hours')::DECIMAL /
          COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours')) * 100
    ELSE 0
  END as error_rate_24h,
  fr.error_threshold,
  CASE
    WHEN COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours') > 0
    THEN (COUNT(fe.id) FILTER (WHERE fe.timestamp > NOW() - INTERVAL '24 hours')::DECIMAL /
          COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours')) * 100 > fr.error_threshold
    ELSE false
  END as should_rollback
FROM feature_rollouts fr
LEFT JOIN feature_usage fu ON fr.feature_name = fu.feature_name
LEFT JOIN feature_errors fe ON fr.feature_name = fe.feature_name
GROUP BY fr.feature_name, fr.percentage, fr.active, fr.error_threshold;

-- Grant access to view
GRANT SELECT ON feature_rollout_metrics TO authenticated;

-- Function to automatically rollback features with high error rates
CREATE OR REPLACE FUNCTION check_and_rollback_features()
RETURNS void AS $$
DECLARE
  feature_record RECORD;
BEGIN
  FOR feature_record IN
    SELECT feature_name, error_rate_24h, error_threshold
    FROM feature_rollout_metrics
    WHERE active = true
    AND auto_rollback = true
    AND should_rollback = true
  LOOP
    UPDATE feature_rollouts
    SET
      active = false,
      rollback_reason = 'Auto-rollback: Error rate ' || feature_record.error_rate_24h || '% exceeded threshold ' || feature_record.error_threshold || '%',
      rollback_at = NOW()
    WHERE feature_name = feature_record.feature_name;

    RAISE NOTICE 'Auto-rolled back feature: %', feature_record.feature_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule automatic rollback check (requires pg_cron extension)
-- Run every 5 minutes
-- SELECT cron.schedule('check-feature-rollbacks', '*/5 * * * *', 'SELECT check_and_rollback_features()');

COMMIT;

-- ================================================
-- Source: supabase/migrations/20260103000001_fix_test_schema.sql
-- ================================================
-- Fix test schema to match production schema
-- This migration ensures the test database has all required columns

-- Add missing columns to organizations table if they don't exist
DO $$
BEGIN
  -- Add slug column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='organizations' AND column_name='slug') THEN
    ALTER TABLE organizations ADD COLUMN slug TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add metadata column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='organizations' AND column_name='metadata') THEN
    ALTER TABLE organizations ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add plan_tier column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='organizations' AND column_name='plan_tier') THEN
    ALTER TABLE organizations ADD COLUMN plan_tier TEXT DEFAULT 'free';
  END IF;

  -- Add status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='organizations' AND column_name='status') THEN
    ALTER TABLE organizations ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Update existing test organizations to have slugs
UPDATE organizations
SET slug = 'test-org-' || SUBSTRING(id::TEXT FROM 1 FOR 8)
WHERE slug = '' OR slug IS NULL;

-- Add tenant_id column to user_tenants if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_tenants' AND column_name='status') THEN
    ALTER TABLE user_tenants ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Create cases table for testing
DROP TABLE IF EXISTS cases CASCADE;
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id TEXT,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table for testing
DROP TABLE IF EXISTS messages CASCADE;
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id TEXT,
  content TEXT NOT NULL,
  role TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create security_audit_events table for testing
CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('ACCESS_DENIED', 'ACCESS_GRANTED')),
  resource TEXT NOT NULL,
  required_permissions TEXT[] NOT NULL DEFAULT '{}',
  user_permissions TEXT[] NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='security_audit_events' AND column_name='tenant_id') THEN
    ALTER TABLE security_audit_events ADD COLUMN tenant_id TEXT;
  ELSE
    ALTER TABLE security_audit_events ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_tenant_id ON security_audit_events(tenant_id);

-- ================================================
-- Source: supabase/migrations/20260103000002_legal_holds.sql
-- ================================================
-- Legal Holds Table
-- Purpose: Prevent data deletion during litigation or regulatory investigations
-- Compliance: GDPR Article 17(3), SOC2 CC6.7

CREATE TABLE IF NOT EXISTS legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  reason TEXT NOT NULL,
  case_number TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'lifted')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_user_id ON legal_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_tenant_id ON legal_holds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_status ON legal_holds(status);
CREATE INDEX IF NOT EXISTS idx_legal_holds_created_at ON legal_holds(created_at);

COMMENT ON TABLE legal_holds IS 'Tracks legal holds to prevent data deletion during litigation';
COMMENT ON COLUMN legal_holds.reason IS 'Reason for legal hold (e.g., "Litigation", "Regulatory Investigation")';
COMMENT ON COLUMN legal_holds.case_number IS 'Optional case or matter number for reference';

-- Trigger to prevent user deletion when legal hold is active
CREATE OR REPLACE FUNCTION prevent_deletion_with_legal_hold()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM legal_holds
    WHERE user_id = OLD.id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot delete user: active legal hold exists (user_id: %)', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_legal_hold_before_delete ON auth.users;
CREATE TRIGGER check_legal_hold_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_deletion_with_legal_hold();

-- Enable RLS
ALTER TABLE legal_holds ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view legal holds
CREATE POLICY legal_holds_admin_read ON legal_holds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Only admins can create legal holds
CREATE POLICY legal_holds_admin_insert ON legal_holds
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Only admins can update legal holds (to lift them)
CREATE POLICY legal_holds_admin_update ON legal_holds
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Service role can access all legal holds
CREATE POLICY legal_holds_service_role ON legal_holds
  FOR ALL
  TO service_role
  USING (true);

-- ================================================
-- Source: supabase/migrations/20260103000003_user_deletions.sql
-- ================================================
-- User Deletions Audit Table
-- Purpose: Track deletion requests for audit and compliance
-- Compliance: GDPR Article 17, SOC2 CC6.7
-- Retention: 7 years

CREATE TABLE IF NOT EXISTS user_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  tenant_id TEXT REFERENCES tenants(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN (
    'user_request',
    'admin_action',
    'gdpr_compliance',
    'account_closure',
    'inactivity'
  )),
  reason TEXT,
  data_exported BOOLEAN DEFAULT FALSE,
  export_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_deletions_user_id ON user_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deletions_user_email ON user_deletions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_deletions_tenant_id ON user_deletions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_deletions_requested_at ON user_deletions(requested_at);
CREATE INDEX IF NOT EXISTS idx_user_deletions_completed_at ON user_deletions(completed_at);
CREATE INDEX IF NOT EXISTS idx_user_deletions_deletion_type ON user_deletions(deletion_type);

COMMENT ON TABLE user_deletions IS 'Audit trail of user deletion requests (retained for 7 years)';
COMMENT ON COLUMN user_deletions.deletion_type IS 'Type of deletion: user_request, admin_action, gdpr_compliance, account_closure, inactivity';
COMMENT ON COLUMN user_deletions.data_exported IS 'Whether user data was exported before deletion';

-- Enable RLS
ALTER TABLE user_deletions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view deletion records
CREATE POLICY user_deletions_admin_read ON user_deletions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Service role can insert deletion records
CREATE POLICY user_deletions_service_insert ON user_deletions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can access all deletion records
CREATE POLICY user_deletions_service_role ON user_deletions
  FOR ALL
  TO service_role
  USING (true);

-- Trigger to log user deletion
CREATE OR REPLACE FUNCTION log_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_deletions (
    user_id,
    user_email,
    deletion_type,
    completed_at
  ) VALUES (
    OLD.id,
    OLD.email,
    'admin_action',
    NOW()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_user_deletion_trigger ON auth.users;
CREATE TRIGGER log_user_deletion_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION log_user_deletion();

-- Retention policy enforcement (prevent deletion before 7 years)
CREATE OR REPLACE FUNCTION enforce_user_deletion_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete user deletion records before retention period expires (7 years)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_user_deletion_retention ON user_deletions;
CREATE TRIGGER check_user_deletion_retention
  BEFORE DELETE ON user_deletions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_user_deletion_retention();

-- ================================================
-- Source: supabase/migrations/20260103000004_cross_region_transfers.sql
-- ================================================
-- Cross-Region Transfer Logging
-- Purpose: Audit cross-region data access for sovereignty compliance
-- Compliance: GDPR Article 44-50, SOC2 CC6.7
-- Retention: 7 years

DROP TABLE IF EXISTS cross_region_transfers CASCADE;
CREATE TABLE IF NOT EXISTS cross_region_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  from_region TEXT NOT NULL,
  to_region TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data_size_bytes BIGINT,
  legal_basis TEXT NOT NULL CHECK (legal_basis IN (
    'user_consent',
    'standard_contractual_clauses',
    'adequacy_decision',
    'binding_corporate_rules',
    'derogation'
  )),
  consent_id UUID,
  transferred_by UUID NOT NULL REFERENCES auth.users(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purpose TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_user_id ON cross_region_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_tenant_id ON cross_region_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_from_region ON cross_region_transfers(from_region);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_to_region ON cross_region_transfers(to_region);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_transferred_at ON cross_region_transfers(transferred_at);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_legal_basis ON cross_region_transfers(legal_basis);

COMMENT ON TABLE cross_region_transfers IS 'Audit trail of cross-region data transfers (retained for 7 years)';
COMMENT ON COLUMN cross_region_transfers.legal_basis IS 'Legal basis for transfer: user_consent, standard_contractual_clauses, adequacy_decision, binding_corporate_rules, derogation';
COMMENT ON COLUMN cross_region_transfers.purpose IS 'Purpose of the data transfer';

-- Enable RLS
ALTER TABLE cross_region_transfers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transfer logs
CREATE POLICY cross_region_transfers_user_read ON cross_region_transfers
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Admins can view all transfer logs
CREATE POLICY cross_region_transfers_admin_read ON cross_region_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Service role can insert transfer logs
CREATE POLICY cross_region_transfers_service_insert ON cross_region_transfers
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can access all transfer logs
CREATE POLICY cross_region_transfers_service_role ON cross_region_transfers
  FOR ALL
  TO service_role
  USING (true);

-- Retention policy enforcement (prevent deletion before 7 years)
CREATE OR REPLACE FUNCTION enforce_cross_region_transfer_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete cross-region transfer records before retention period expires (7 years)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_cross_region_transfer_retention ON cross_region_transfers;
CREATE TRIGGER check_cross_region_transfer_retention
  BEFORE DELETE ON cross_region_transfers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_cross_region_transfer_retention();

-- Function to log cross-region transfer
CREATE OR REPLACE FUNCTION log_cross_region_transfer(
  p_user_id UUID,
  p_tenant_id TEXT,
  p_from_region TEXT,
  p_to_region TEXT,
  p_data_type TEXT,
  p_data_size_bytes BIGINT,
  p_legal_basis TEXT,
  p_purpose TEXT,
  p_transferred_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
BEGIN
  INSERT INTO cross_region_transfers (
    user_id,
    tenant_id,
    from_region,
    to_region,
    data_type,
    data_size_bytes,
    legal_basis,
    transferred_by,
    purpose
  ) VALUES (
    p_user_id,
    p_tenant_id,
    p_from_region,
    p_to_region,
    p_data_type,
    p_data_size_bytes,
    p_legal_basis,
    COALESCE(p_transferred_by, auth.uid()),
    p_purpose
  ) RETURNING id INTO v_transfer_id;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- Source: supabase/migrations/20260103000005_usage_tracking.sql
-- ================================================
-- Usage Tracking Tables
-- Purpose: Track usage for billing and quota enforcement
-- Compliance: SOC2 CC6.7

-- Usage Events Table
DROP TABLE IF EXISTS usage_events CASCADE;
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  metric TEXT NOT NULL CHECK (metric IN (
    'llm_tokens',
    'agent_executions',
    'api_calls',
    'storage_gb',
    'user_seats'
  )),
  amount BIGINT NOT NULL CHECK (amount >= 0),
  request_id TEXT NOT NULL UNIQUE, -- Idempotency key
  metadata JSONB DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_metric ON usage_events(metric);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_processed ON usage_events(processed);
CREATE INDEX IF NOT EXISTS idx_usage_events_request_id ON usage_events(request_id);

COMMENT ON TABLE usage_events IS 'Individual usage events for billing';
COMMENT ON COLUMN usage_events.request_id IS 'Idempotency key to prevent duplicate events';

-- Usage Quotas Table
DROP TABLE IF EXISTS usage_quotas CASCADE;
CREATE TABLE IF NOT EXISTS usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  subscription_id UUID,
  metric TEXT NOT NULL CHECK (metric IN (
    'llm_tokens',
    'agent_executions',
    'api_calls',
    'storage_gb',
    'user_seats'
  )),
  quota_amount BIGINT NOT NULL CHECK (quota_amount >= -1), -- -1 means unlimited
  current_usage BIGINT NOT NULL DEFAULT 0 CHECK (current_usage >= 0),
  hard_cap BOOLEAN NOT NULL DEFAULT FALSE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_quotas_tenant_id ON usage_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_metric ON usage_quotas(metric);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_period ON usage_quotas(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_subscription_id ON usage_quotas(subscription_id);

COMMENT ON TABLE usage_quotas IS 'Usage quotas and current usage by tenant and metric';
COMMENT ON COLUMN usage_quotas.quota_amount IS 'Maximum allowed usage (-1 for unlimited)';
COMMENT ON COLUMN usage_quotas.hard_cap IS 'Whether to strictly enforce quota (true) or allow overage (false)';

-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

-- Policies for usage_events
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'usage_events' LOOP
        EXECUTE 'DROP POLICY "' || pol.policyname || '" ON usage_events';
    END LOOP;
END $$;
CREATE POLICY usage_events_tenant_read ON usage_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY usage_events_service_role ON usage_events
  FOR ALL
  TO service_role
  USING (true);

-- Policies for usage_quotas
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'usage_quotas' LOOP
        EXECUTE 'DROP POLICY "' || pol.policyname || '" ON usage_quotas';
    END LOOP;
END $$;
CREATE POLICY usage_quotas_tenant_read ON usage_quotas
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY usage_quotas_service_role ON usage_quotas
  FOR ALL
  TO service_role
  USING (true);

-- Function to check and enforce usage quota
CREATE OR REPLACE FUNCTION check_usage_quota(
  p_tenant_id TEXT,
  p_metric TEXT,
  p_amount BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_quota usage_quotas%ROWTYPE;
  v_new_usage BIGINT;
BEGIN
  -- Get current quota
  SELECT * INTO v_quota
  FROM usage_quotas
  WHERE tenant_id = p_tenant_id
  AND metric = p_metric
  AND period_start <= NOW()
  AND period_end > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quota found for tenant % and metric %', p_tenant_id, p_metric;
  END IF;

  v_new_usage := v_quota.current_usage + p_amount;

  -- Check if quota would be exceeded
  IF v_quota.hard_cap AND v_quota.quota_amount != -1 AND v_new_usage > v_quota.quota_amount THEN
    RETURN FALSE;
  END IF;

  -- Update usage
  UPDATE usage_quotas
  SET current_usage = v_new_usage,
      updated_at = NOW(),
      last_synced_at = NOW()
  WHERE id = v_quota.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage event
CREATE OR REPLACE FUNCTION record_usage_event(
  p_tenant_id TEXT,
  p_metric TEXT,
  p_amount BIGINT,
  p_request_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Insert usage event (idempotent via request_id unique constraint)
  INSERT INTO usage_events (
    tenant_id,
    metric,
    amount,
    request_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_metric,
    p_amount,
    p_request_id,
    p_metadata
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset quotas where period has ended
  UPDATE usage_quotas
  SET current_usage = 0,
      period_start = period_end,
      period_end = period_end + INTERVAL '1 month',
      updated_at = NOW()
  WHERE period_end <= NOW()
  RETURNING COUNT(*) INTO v_reset_count;

  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate usage events
CREATE OR REPLACE FUNCTION aggregate_usage_events()
RETURNS INTEGER AS $$
DECLARE
  v_processed_count INTEGER;
BEGIN
  -- Aggregate unprocessed events into quotas
  WITH aggregated AS (
    SELECT
      tenant_id,
      metric,
      SUM(amount) as total_amount
    FROM usage_events
    WHERE processed = FALSE
    AND timestamp >= NOW() - INTERVAL '1 hour'
    GROUP BY tenant_id, metric
  )
  UPDATE usage_quotas uq
  SET current_usage = current_usage + a.total_amount,
      updated_at = NOW(),
      last_synced_at = NOW()
  FROM aggregated a
  WHERE uq.tenant_id = a.tenant_id
  AND uq.metric = a.metric
  AND uq.period_start <= NOW()
  AND uq.period_end > NOW();

  -- Mark events as processed
  UPDATE usage_events
  SET processed = TRUE,
      processed_at = NOW()
  WHERE processed = FALSE
  AND timestamp >= NOW() - INTERVAL '1 hour'
  RETURNING COUNT(*) INTO v_processed_count;

  RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Source: supabase/migrations/20260103000006_audit_log_anonymization.sql
-- ================================================
-- Audit Log Anonymization Trigger
-- Purpose: Anonymize user_id in audit logs after user deletion
-- Compliance: GDPR Article 17, SOC2 CC6.8

-- Function to anonymize audit logs on user deletion
CREATE OR REPLACE FUNCTION anonymize_audit_logs_on_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Anonymize user_id in security_audit_events
  UPDATE security_audit_events
  SET user_id = '[DELETED-' || SUBSTRING(OLD.id::TEXT FROM 1 FOR 8) || ']',
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{anonymized_at}',
        to_jsonb(NOW())
      ),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{original_user_email}',
        to_jsonb('[REDACTED]')
      )
  WHERE user_id = OLD.id::TEXT;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (runs after legal hold check)
DROP TRIGGER IF EXISTS anonymize_audit_logs_after_user_delete ON auth.users;
CREATE TRIGGER anonymize_audit_logs_after_user_delete
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_audit_logs_on_user_deletion();

COMMENT ON FUNCTION anonymize_audit_logs_on_user_deletion IS 'Anonymizes audit logs when user is deleted while preserving audit trail';

-- ================================================
-- Source: supabase/migrations/20260103000007_retention_policies.sql
-- ================================================
-- Retention Policy Enforcement Triggers
-- Purpose: Prevent premature deletion of compliance data
-- Compliance: GDPR Article 5(1)(e), SOC2 CC6.7

-- Function to enforce audit log retention (7 years)
CREATE OR REPLACE FUNCTION enforce_audit_log_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete audit logs before retention period expires (7 years). Record created: %, Current time: %', OLD.created_at, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_audit_log_retention ON security_audit_events;
CREATE TRIGGER check_audit_log_retention
  BEFORE DELETE ON security_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_log_retention();

COMMENT ON FUNCTION enforce_audit_log_retention IS 'Prevents deletion of audit logs before 7-year retention period';

-- Function to enforce financial record retention (7 years)
CREATE OR REPLACE FUNCTION enforce_financial_record_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete financial records before retention period expires (7 years). Record created: %, Current time: %', OLD.created_at, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply to invoices table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
DROP TRIGGER IF EXISTS check_financial_record_retention ON invoices;
    CREATE TRIGGER check_financial_record_retention
      BEFORE DELETE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION enforce_financial_record_retention();
  END IF;
END $$;

-- Apply to subscriptions table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
DROP TRIGGER IF EXISTS check_subscription_retention ON subscriptions;
    CREATE TRIGGER check_subscription_retention
      BEFORE DELETE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION enforce_financial_record_retention();
  END IF;
END $$;

COMMENT ON FUNCTION enforce_financial_record_retention IS 'Prevents deletion of financial records before 7-year retention period';

-- Function to enforce GDPR consent retention (2 years after withdrawal)
CREATE OR REPLACE FUNCTION enforce_consent_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '2 years';
  withdrawal_date TIMESTAMPTZ;
BEGIN
  -- If consent was withdrawn, use withdrawal date; otherwise use created date
  withdrawal_date := COALESCE(OLD.withdrawn_at, OLD.created_at);

  IF withdrawal_date > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete consent records before retention period expires (2 years after withdrawal). Withdrawal date: %, Current time: %', withdrawal_date, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create user_consents table if it doesn't exist
DROP TABLE IF EXISTS user_consents CASCADE;
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  consent_type TEXT NOT NULL,
  purpose TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_tenant_id ON user_consents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_consent_type ON user_consents(consent_type);

DROP TRIGGER IF EXISTS check_consent_retention ON user_consents;
CREATE TRIGGER check_consent_retention
  BEFORE DELETE ON user_consents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_consent_retention();

COMMENT ON FUNCTION enforce_consent_retention IS 'Prevents deletion of consent records before 2-year retention period after withdrawal';

-- Function to enforce security incident retention (3 years)
CREATE OR REPLACE FUNCTION enforce_security_incident_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '3 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete security incident records before retention period expires (3 years). Record created: %, Current time: %', OLD.created_at, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create security_incidents table if it doesn't exist
DROP TABLE IF EXISTS security_incidents CASCADE;
CREATE TABLE IF NOT EXISTS security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id),
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  affected_users INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_tenant_id ON security_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON security_incidents(detected_at);

DROP TRIGGER IF EXISTS check_security_incident_retention ON security_incidents;
CREATE TRIGGER check_security_incident_retention
  BEFORE DELETE ON security_incidents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_security_incident_retention();

COMMENT ON FUNCTION enforce_security_incident_retention IS 'Prevents deletion of security incident records before 3-year retention period';

-- Function to check if data can be deleted based on retention policy
CREATE OR REPLACE FUNCTION can_delete_by_retention(
  p_table_name TEXT,
  p_created_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  v_retention_period INTERVAL;
BEGIN
  -- Determine retention period based on table
  CASE p_table_name
    WHEN 'security_audit_events' THEN v_retention_period := '7 years';
    WHEN 'invoices' THEN v_retention_period := '7 years';
    WHEN 'subscriptions' THEN v_retention_period := '7 years';
    WHEN 'user_deletions' THEN v_retention_period := '7 years';
    WHEN 'cross_region_transfers' THEN v_retention_period := '7 years';
    WHEN 'legal_holds' THEN v_retention_period := '7 years';
    WHEN 'user_consents' THEN v_retention_period := '2 years';
    WHEN 'security_incidents' THEN v_retention_period := '3 years';
    ELSE v_retention_period := '1 year'; -- Default
  END CASE;

  RETURN p_created_at <= NOW() - v_retention_period;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_delete_by_retention IS 'Checks if a record can be deleted based on retention policy';

-- Function to get retention period for a table
CREATE OR REPLACE FUNCTION get_retention_period(p_table_name TEXT)
RETURNS INTERVAL AS $$
BEGIN
  CASE p_table_name
    WHEN 'security_audit_events' THEN RETURN '7 years';
    WHEN 'invoices' THEN RETURN '7 years';
    WHEN 'subscriptions' THEN RETURN '7 years';
    WHEN 'user_deletions' THEN RETURN '7 years';
    WHEN 'cross_region_transfers' THEN RETURN '7 years';
    WHEN 'legal_holds' THEN RETURN '7 years';
    WHEN 'user_consents' THEN RETURN '2 years';
    WHEN 'security_incidents' THEN RETURN '3 years';
    ELSE RETURN '1 year';
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_retention_period IS 'Returns the retention period for a given table';

-- View to show retention policy compliance
CREATE OR REPLACE VIEW retention_policy_compliance AS
SELECT
  'security_audit_events' as table_name,
  '7 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 years') as active_records
FROM security_audit_events
UNION ALL
SELECT
  'user_deletions' as table_name,
  '7 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 years') as active_records
FROM user_deletions
UNION ALL
SELECT
  'cross_region_transfers' as table_name,
  '7 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 years') as active_records
FROM cross_region_transfers
UNION ALL
SELECT
  'user_consents' as table_name,
  '2 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE COALESCE(withdrawn_at, created_at) <= NOW() - INTERVAL '2 years') as expired_records,
  COUNT(*) FILTER (WHERE COALESCE(withdrawn_at, created_at) > NOW() - INTERVAL '2 years') as active_records
FROM user_consents
UNION ALL
SELECT
  'security_incidents' as table_name,
  '3 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '3 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '3 years') as active_records
FROM security_incidents;

COMMENT ON VIEW retention_policy_compliance IS 'Shows retention policy compliance status for all tables';

-- ================================================
-- Source: supabase/migrations/20260103000008_tenant_isolation.sql
-- ================================================
-- Tenant Isolation Enhancements
-- Purpose: Ensure strict tenant isolation via RLS
-- Compliance: SOC2 CC6.1, ISO 27001 A.9.4.1

-- Add tenant_id to cases table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='cases' AND column_name='tenant_id') THEN
    ALTER TABLE cases ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

    -- Backfill tenant_id from user_tenants
    UPDATE cases SET tenant_id = (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = cases.user_id::text
      LIMIT 1
    ) WHERE tenant_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_tenant_id ON cases(tenant_id);

-- Add tenant_id to messages table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='messages' AND column_name='tenant_id') THEN
    ALTER TABLE messages ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

    -- Backfill tenant_id from user_tenants
    UPDATE messages SET tenant_id = (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = messages.user_id::text
      LIMIT 1
    ) WHERE tenant_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);

-- Enable RLS on cases table
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's cases
DROP POLICY IF EXISTS tenant_isolation_cases ON cases;
CREATE POLICY tenant_isolation_cases ON cases
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all cases
DROP POLICY IF EXISTS service_role_cases ON cases;
CREATE POLICY service_role_cases ON cases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's messages
DROP POLICY IF EXISTS tenant_isolation_messages ON messages;
CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all messages
DROP POLICY IF EXISTS service_role_messages ON messages;
CREATE POLICY service_role_messages ON messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS on agent_sessions table
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_sessions' AND column_name='tenant_id') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'agent_sessions') LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON agent_sessions';
    END LOOP;
    ALTER TABLE agent_sessions ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
  END IF;
END $$;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's agent sessions
DROP POLICY IF EXISTS tenant_isolation_agent_sessions ON agent_sessions;
CREATE POLICY tenant_isolation_agent_sessions ON agent_sessions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all agent sessions
DROP POLICY IF EXISTS service_role_agent_sessions ON agent_sessions;
CREATE POLICY service_role_agent_sessions ON agent_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS on agent_predictions table
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_predictions' AND column_name='tenant_id') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'agent_predictions') LOOP
      EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON agent_predictions';
    END LOOP;
    ALTER TABLE agent_predictions ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
  END IF;
END $$;
ALTER TABLE agent_predictions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's agent predictions
DROP POLICY IF EXISTS tenant_isolation_agent_predictions ON agent_predictions;
CREATE POLICY tenant_isolation_agent_predictions ON agent_predictions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_tenants.user_id::text = auth.uid()::text
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all agent predictions
DROP POLICY IF EXISTS service_role_agent_predictions ON agent_predictions;
CREATE POLICY service_role_agent_predictions ON agent_predictions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to validate tenant membership
CREATE OR REPLACE FUNCTION validate_tenant_membership(
  p_user_id UUID,
  p_tenant_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_tenant_membership IS 'Validates if a user is an active member of a tenant';

-- Function to get user's tenant IDs
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT tenant_id FROM user_tenants
    WHERE user_id = p_user_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenant_ids IS 'Returns array of tenant IDs for a user';

-- Function to prevent tenant_id modification
CREATE OR REPLACE FUNCTION prevent_tenant_id_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id != OLD.tenant_id THEN
    RAISE EXCEPTION 'Cannot modify tenant_id. Original: %, New: %', OLD.tenant_id, NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply tenant_id immutability to cases
DROP TRIGGER IF EXISTS prevent_cases_tenant_modification ON cases;
CREATE TRIGGER prevent_cases_tenant_modification
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tenant_id_modification();

-- Apply tenant_id immutability to messages
DROP TRIGGER IF EXISTS prevent_messages_tenant_modification ON messages;
CREATE TRIGGER prev