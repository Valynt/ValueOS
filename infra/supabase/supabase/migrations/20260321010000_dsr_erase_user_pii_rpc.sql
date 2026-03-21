-- Transactional GDPR Art. 17 erasure boundary.
--
-- Adds a tenant-scoped idempotency table for erasure requests and a
-- SECURITY DEFINER RPC that anonymizes/scrubs/deletes dependent data in one
-- database transaction, then persists a coverage summary for retry-safe replays.

SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.dsr_erasure_requests (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL,
  user_id              uuid        NOT NULL,
  request_type         text        NOT NULL DEFAULT 'erase',
  request_token        text        NOT NULL,
  status               text        NOT NULL DEFAULT 'pending',
  result_summary       jsonb,
  last_error           text,
  test_fail_after_step text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  CONSTRAINT dsr_erasure_requests_type_check
    CHECK (request_type = 'erase'),
  CONSTRAINT dsr_erasure_requests_status_check
    CHECK (status = ANY (ARRAY['pending', 'completed', 'failed']))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dsr_erasure_requests_token
  ON public.dsr_erasure_requests (tenant_id, request_type, request_token);

CREATE INDEX IF NOT EXISTS idx_dsr_erasure_requests_user
  ON public.dsr_erasure_requests (tenant_id, user_id, created_at DESC);

ALTER TABLE public.dsr_erasure_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dsr_erasure_requests_tenant_select ON public.dsr_erasure_requests;
DROP POLICY IF EXISTS dsr_erasure_requests_tenant_insert ON public.dsr_erasure_requests;
DROP POLICY IF EXISTS dsr_erasure_requests_tenant_update ON public.dsr_erasure_requests;
DROP POLICY IF EXISTS dsr_erasure_requests_service_role ON public.dsr_erasure_requests;

CREATE POLICY dsr_erasure_requests_tenant_select
  ON public.dsr_erasure_requests FOR SELECT
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY dsr_erasure_requests_tenant_insert
  ON public.dsr_erasure_requests FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY dsr_erasure_requests_tenant_update
  ON public.dsr_erasure_requests FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY dsr_erasure_requests_service_role
  ON public.dsr_erasure_requests FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.dsr_erasure_requests TO authenticated;
GRANT ALL ON public.dsr_erasure_requests TO service_role;

CREATE OR REPLACE FUNCTION public.erase_user_pii(
  p_tenant_id uuid,
  p_user_id uuid,
  p_redacted_ts timestamptz,
  p_request_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request public.dsr_erasure_requests%ROWTYPE;
  v_summary jsonb;
  v_included text[] := ARRAY[]::text[];
  v_excluded jsonb := '[]'::jsonb;
  v_scrubbed_counts jsonb := '{}'::jsonb;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_placeholder_email text;
  v_row_count integer := 0;
  v_fail_step text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_redacted_ts IS NULL THEN
    RAISE EXCEPTION 'p_redacted_ts is required' USING ERRCODE = '22023';
  END IF;

  IF auth.role() <> 'service_role' AND NOT security.user_has_tenant_access(p_tenant_id::text) THEN
    RAISE EXCEPTION 'tenant access denied for erase_user_pii'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_token IS NOT NULL THEN
    INSERT INTO public.dsr_erasure_requests (
      tenant_id,
      user_id,
      request_type,
      request_token,
      status,
      last_error,
      updated_at
    )
    VALUES (
      p_tenant_id,
      p_user_id,
      'erase',
      p_request_token,
      'pending',
      NULL,
      now()
    )
    ON CONFLICT (tenant_id, request_type, request_token) DO NOTHING;

    SELECT *
      INTO v_request
    FROM public.dsr_erasure_requests
    WHERE tenant_id = p_tenant_id
      AND request_type = 'erase'
      AND request_token = p_request_token
    FOR UPDATE;

    IF v_request.status = 'completed' AND v_request.result_summary IS NOT NULL THEN
      RETURN jsonb_set(v_request.result_summary, '{idempotent_replay}', 'true'::jsonb, true);
    END IF;

    v_fail_step := v_request.test_fail_after_step;
  END IF;

  v_placeholder_email := format('deleted+%s@redacted.local', p_user_id);

  UPDATE public.users
  SET email = v_placeholder_email,
      full_name = NULL,
      display_name = NULL,
      avatar_url = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'anonymized', true,
        'anonymized_at', p_redacted_ts
      )
  WHERE id = p_user_id
    AND tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'User not found in this tenant' USING ERRCODE = 'P0002';
  END IF;

  v_included := array_append(v_included, 'users');
  v_scrubbed_counts := jsonb_set(v_scrubbed_counts, '{users}', to_jsonb(v_row_count), true);

  IF v_fail_step = 'after_users' THEN
    RAISE EXCEPTION 'Forced DSR erasure failure after users step' USING ERRCODE = 'P0001';
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    UPDATE public.messages
    SET content = '[redacted]',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'anonymized', true,
          'redacted_at', p_redacted_ts
        )
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'messages');
    v_scrubbed_counts := jsonb_set(v_scrubbed_counts, '{messages}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'messages', 'reason', 'table_missing'));
  END IF;

  IF v_fail_step = 'after_messages' THEN
    RAISE EXCEPTION 'Forced DSR erasure failure after messages step' USING ERRCODE = 'P0001';
  END IF;

  IF to_regclass('public.cases') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cases'
        AND column_name = 'tenant_id'
    ) THEN
      EXECUTE $cases$
        UPDATE public.cases
        SET description = '[redacted]'
        WHERE user_id = $1
          AND tenant_id::text = $2::text
      $cases$
      USING p_user_id, p_tenant_id;

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_included := array_append(v_included, 'cases');
      v_scrubbed_counts := jsonb_set(v_scrubbed_counts, '{cases}', to_jsonb(v_row_count), true);
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cases'
        AND column_name = 'organization_id'
    ) THEN
      EXECUTE $cases_org$
        UPDATE public.cases
        SET description = '[redacted]'
        WHERE user_id = $1
          AND organization_id = $2
      $cases_org$
      USING p_user_id, p_tenant_id;

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_included := array_append(v_included, 'cases');
      v_scrubbed_counts := jsonb_set(v_scrubbed_counts, '{cases}', to_jsonb(v_row_count), true);
    ELSE
      v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'cases', 'reason', 'tenant_column_missing'));
    END IF;
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'cases', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.agent_memory') IS NOT NULL AND to_regclass('public.agent_sessions') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agent_sessions'
        AND column_name = 'tenant_id'
    ) THEN
      EXECUTE $memory$
        UPDATE public.agent_memory AS am
        SET content = '[redacted]',
            metadata = COALESCE(am.metadata, '{}'::jsonb) || jsonb_build_object(
              'anonymized', true,
              'redacted_at', $3
            )
        FROM public.agent_sessions AS s
        WHERE am.session_id = s.id
          AND s.user_id = $1
          AND s.tenant_id::text = $2::text
      $memory$
      USING p_user_id, p_tenant_id, p_redacted_ts;

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_included := array_append(v_included, 'agent_memory');
      v_scrubbed_counts := jsonb_set(v_scrubbed_counts, '{agent_memory}', to_jsonb(v_row_count), true);
    ELSE
      v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'agent_memory', 'reason', 'session_tenant_column_missing'));
    END IF;
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'agent_memory', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.agent_sessions') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agent_sessions'
        AND column_name = 'tenant_id'
    ) THEN
      EXECUTE $sessions$
        UPDATE public.agent_sessions
        SET session_token = concat('redacted:', id::text),
            context = '{}'::jsonb,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'anonymized', true,
              'redacted_at', $3
            )
        WHERE user_id = $1
          AND tenant_id::text = $2::text
      $sessions$
      USING p_user_id, p_tenant_id, p_redacted_ts;

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_included := array_append(v_included, 'agent_sessions');
      v_scrubbed_counts := jsonb_set(v_scrubbed_counts, '{agent_sessions}', to_jsonb(v_row_count), true);
    ELSE
      v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'agent_sessions', 'reason', 'tenant_column_missing'));
    END IF;
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'agent_sessions', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE $audit$
      UPDATE public.audit_logs
      SET user_id = NULL,
          old_values = NULL,
          new_values = NULL,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'anonymized', true,
            'redacted_at', $3
          )
      WHERE user_id = $1
        AND (
          tenant_id::text = $2::text
          OR organization_id = $2
        )
    $audit$
    USING p_user_id, p_tenant_id, p_redacted_ts;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'audit_logs');
    v_scrubbed_counts := jsonb_set(v_scrubbed_counts, '{audit_logs}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'audit_logs', 'reason', 'table_missing'));
  END IF;

  IF v_fail_step = 'after_scrubs' THEN
    RAISE EXCEPTION 'Forced DSR erasure failure after scrub steps' USING ERRCODE = 'P0001';
  END IF;

  -- Deletion assets where schema may use either tenant_id or organization_id.
  IF to_regclass('public.hypothesis_outputs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.hypothesis_outputs WHERE created_by = $1 AND organization_id = $2'
      USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'hypothesis_outputs');
    v_deleted_counts := jsonb_set(v_deleted_counts, '{hypothesis_outputs}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'hypothesis_outputs', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.integrity_outputs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.integrity_outputs WHERE created_by = $1 AND organization_id = $2'
      USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'integrity_outputs');
    v_deleted_counts := jsonb_set(v_deleted_counts, '{integrity_outputs}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'integrity_outputs', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.narrative_drafts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.narrative_drafts WHERE created_by = $1 AND organization_id = $2'
      USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'narrative_drafts');
    v_deleted_counts := jsonb_set(v_deleted_counts, '{narrative_drafts}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'narrative_drafts', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.realization_reports') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.realization_reports WHERE created_by = $1 AND organization_id = $2'
      USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'realization_reports');
    v_deleted_counts := jsonb_set(v_deleted_counts, '{realization_reports}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'realization_reports', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.expansion_opportunities') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.expansion_opportunities WHERE created_by = $1 AND organization_id = $2'
      USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'expansion_opportunities');
    v_deleted_counts := jsonb_set(v_deleted_counts, '{expansion_opportunities}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'expansion_opportunities', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.value_tree_nodes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.value_tree_nodes WHERE created_by = $1 AND organization_id = $2'
      USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'value_tree_nodes');
    v_deleted_counts := jsonb_set(v_deleted_counts, '{value_tree_nodes}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'value_tree_nodes', 'reason', 'table_missing'));
  END IF;

  IF to_regclass('public.financial_model_snapshots') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.financial_model_snapshots WHERE created_by = $1 AND organization_id = $2'
      USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_included := array_append(v_included, 'financial_model_snapshots');
    v_deleted_counts := jsonb_set(v_deleted_counts, '{financial_model_snapshots}', to_jsonb(v_row_count), true);
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'financial_model_snapshots', 'reason', 'table_missing'));
  END IF;

  v_summary := jsonb_build_object(
    'anonymized_to', v_placeholder_email,
    'erased_at', p_redacted_ts,
    'pii_assets_included', to_jsonb(v_included),
    'pii_assets_excluded', v_excluded,
    'scrubbed_counts', v_scrubbed_counts,
    'deleted_counts', v_deleted_counts,
    'idempotent_replay', false
  );

  IF p_request_token IS NOT NULL THEN
    UPDATE public.dsr_erasure_requests
    SET status = 'completed',
        result_summary = v_summary,
        last_error = NULL,
        completed_at = now(),
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND request_type = 'erase'
      AND request_token = p_request_token;
  END IF;

  RETURN v_summary;
END;
$$;

COMMENT ON FUNCTION public.erase_user_pii(uuid, uuid, timestamptz, text)
IS 'Anonymize a tenant-scoped user profile plus dependent PII-bearing records in one transaction, with idempotent request-token replay support and a JSONB coverage summary.';

REVOKE ALL ON FUNCTION public.erase_user_pii(uuid, uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_user_pii(uuid, uuid, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.erase_user_pii(uuid, uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erase_user_pii(uuid, uuid, timestamptz, text) TO service_role;
