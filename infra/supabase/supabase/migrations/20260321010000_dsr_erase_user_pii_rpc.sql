SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.dsr_erasure_requests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text        NOT NULL,
  user_id           uuid,
  request_token     text        NOT NULL,
  target_email_hash text,
  status            text        NOT NULL DEFAULT 'pending',
  redacted_ts       timestamptz,
  result_summary    jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dsr_erasure_requests_status_check
    CHECK (status = ANY (ARRAY['pending', 'completed']))
);

CREATE UNIQUE INDEX IF NOT EXISTS dsr_erasure_requests_tenant_token_key
  ON public.dsr_erasure_requests (tenant_id, request_token);

CREATE INDEX IF NOT EXISTS idx_dsr_erasure_requests_tenant_email_hash
  ON public.dsr_erasure_requests (tenant_id, target_email_hash);

ALTER TABLE public.dsr_erasure_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dsr_erasure_requests_tenant_select ON public.dsr_erasure_requests;
CREATE POLICY dsr_erasure_requests_tenant_select ON public.dsr_erasure_requests
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS dsr_erasure_requests_service_role ON public.dsr_erasure_requests;
CREATE POLICY dsr_erasure_requests_service_role ON public.dsr_erasure_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.dsr_erasure_requests TO authenticated;
GRANT ALL ON public.dsr_erasure_requests TO service_role;

CREATE OR REPLACE FUNCTION public.erase_user_pii(
  p_tenant_id text,
  p_user_id uuid,
  p_redacted_ts timestamptz,
  p_request_token text,
  p_target_email_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request public.dsr_erasure_requests%ROWTYPE;
  v_result jsonb;
  v_included jsonb := '[]'::jsonb;
  v_excluded jsonb := jsonb_build_array(
    jsonb_build_object('asset', 'semantic_memory', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'agent_audit_log', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'workflow_checkpoints', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'saga_transitions', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'crm-sync', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'crm-webhook', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'crm-prefetch', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'onboarding-research', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'user_tenants', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'memberships', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'compliance_controls', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'pending_subscription_changes', 'reason', 'not_erasable'),
    jsonb_build_object('asset', 'crm-dead-letter', 'reason', 'not_erasable')
  );
  v_placeholder_email text := format('deleted+%s@redacted.local', p_user_id::text);
  v_users_updated integer := 0;
  v_messages_scrubbed integer := 0;
  v_cases_scrubbed integer := 0;
  v_agent_memory_scrubbed integer := 0;
  v_agent_sessions_scrubbed integer := 0;
  v_audit_logs_scrubbed integer := 0;
  v_deleted_table text;
  v_deleted_rows integer;
  v_delete_asset record;
BEGIN
  IF p_tenant_id IS NULL OR btrim(p_tenant_id) = '' THEN
    RAISE EXCEPTION 'tenant_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_redacted_ts IS NULL THEN
    RAISE EXCEPTION 'redacted_ts is required' USING ERRCODE = '22023';
  END IF;

  IF p_request_token IS NULL OR btrim(p_request_token) = '' THEN
    RAISE EXCEPTION 'request_token is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.dsr_erasure_requests (
    tenant_id,
    user_id,
    request_token,
    target_email_hash,
    status,
    redacted_ts
  )
  VALUES (
    p_tenant_id,
    p_user_id,
    p_request_token,
    p_target_email_hash,
    'pending',
    p_redacted_ts
  )
  ON CONFLICT (tenant_id, request_token) DO NOTHING;

  SELECT *
    INTO v_request
  FROM public.dsr_erasure_requests
  WHERE tenant_id = p_tenant_id
    AND request_token = p_request_token
  FOR UPDATE;

  IF v_request.status = 'completed' AND v_request.result_summary IS NOT NULL THEN
    RETURN v_request.result_summary || jsonb_build_object('idempotent_replay', true);
  END IF;

  UPDATE public.users
  SET email = v_placeholder_email,
      full_name = NULL,
      display_name = NULL,
      avatar_url = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('anonymized', true, 'anonymized_at', p_redacted_ts)
  WHERE id::text = p_user_id::text
    AND tenant_id::text = p_tenant_id;
  GET DIAGNOSTICS v_users_updated = ROW_COUNT;

  IF v_users_updated = 0 THEN
    RAISE EXCEPTION 'User % not found in tenant %', p_user_id, p_tenant_id USING ERRCODE = 'P0002';
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    UPDATE public.messages
    SET content = '[redacted]',
        metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object('anonymized', true, 'redacted_at', p_redacted_ts)
    WHERE user_id::text = p_user_id::text
      AND tenant_id::text = p_tenant_id;
    GET DIAGNOSTICS v_messages_scrubbed = ROW_COUNT;
    v_included := v_included || jsonb_build_array('messages');
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'messages', 'reason', 'missing_table'));
  END IF;

  IF to_regclass('public.cases') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.cases
      SET description = '[redacted]'
      WHERE user_id::text = $1::text
        AND tenant_id::text = $2
    $sql$
    USING p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_cases_scrubbed = ROW_COUNT;
    v_included := v_included || jsonb_build_array('cases');
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'cases', 'reason', 'missing_table'));
  END IF;

  IF to_regclass('public.agent_memory') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'agent_memory'
         AND column_name = 'user_id'
     ) THEN
    EXECUTE $sql$
      UPDATE public.agent_memory
      SET content = '[redacted]',
          metadata = COALESCE(metadata, '{}'::jsonb)
            || jsonb_build_object('anonymized', true, 'redacted_at', $1)
      WHERE user_id::text = $2::text
        AND tenant_id::text = $3
    $sql$
    USING p_redacted_ts, p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_agent_memory_scrubbed = ROW_COUNT;
    v_included := v_included || jsonb_build_array('agent_memory');
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'agent_memory', 'reason', 'missing_table_or_columns'));
  END IF;

  IF to_regclass('public.agent_sessions') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.agent_sessions
      SET metadata = COALESCE(metadata, '{}'::jsonb)
            || jsonb_build_object('anonymized', true, 'redacted_at', $1)
      WHERE user_id::text = $2::text
        AND tenant_id::text = $3
    $sql$
    USING p_redacted_ts, p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_agent_sessions_scrubbed = ROW_COUNT;
    v_included := v_included || jsonb_build_array('agent_sessions');
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'agent_sessions', 'reason', 'missing_table'));
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.audit_logs
      SET details = jsonb_build_object('redacted', true, 'redacted_at', $1),
          metadata = COALESCE(metadata, '{}'::jsonb)
            || jsonb_build_object('anonymized', true, 'redacted_at', $1)
      WHERE user_id::text = $2::text
        AND tenant_id::text = $3
    $sql$
    USING p_redacted_ts, p_user_id, p_tenant_id;
    GET DIAGNOSTICS v_audit_logs_scrubbed = ROW_COUNT;
    v_included := v_included || jsonb_build_array('audit_logs');
  ELSE
    v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', 'audit_logs', 'reason', 'missing_table'));
  END IF;

  v_included := jsonb_build_array('users') || v_included;

  FOR v_delete_asset IN
    SELECT *
    FROM (VALUES
      ('hypothesis_outputs', 'created_by', 'tenant_id'),
      ('integrity_outputs', 'created_by', 'tenant_id'),
      ('narrative_drafts', 'created_by', 'tenant_id'),
      ('realization_reports', 'created_by', 'tenant_id'),
      ('expansion_opportunities', 'created_by', 'tenant_id'),
      ('value_tree_nodes', 'created_by', 'tenant_id'),
      ('financial_model_snapshots', 'created_by', 'tenant_id')
    ) AS t(asset, user_column, tenant_column)
  LOOP
    IF to_regclass(format('public.%I', v_delete_asset.asset)) IS NULL THEN
      v_excluded := v_excluded || jsonb_build_array(jsonb_build_object('asset', v_delete_asset.asset, 'reason', 'missing_table'));
      CONTINUE;
    END IF;

    EXECUTE format(
      'DELETE FROM public.%I WHERE %I::text = $1::text AND %I::text = $2',
      v_delete_asset.asset,
      v_delete_asset.user_column,
      v_delete_asset.tenant_column
    )
    USING p_user_id, p_tenant_id;

    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;
    v_included := v_included || jsonb_build_array(v_delete_asset.asset);
  END LOOP;

  v_result := jsonb_build_object(
    'request_type', 'erase',
    'anonymized_to', v_placeholder_email,
    'erased_at', p_redacted_ts,
    'request_token', p_request_token,
    'idempotent_replay', false,
    'pii_assets_included', v_included,
    'pii_assets_excluded', v_excluded,
    'coverage', jsonb_build_object(
      'users', jsonb_build_object('anonymized', v_users_updated),
      'messages', jsonb_build_object('scrubbed', v_messages_scrubbed),
      'cases', jsonb_build_object('scrubbed', v_cases_scrubbed),
      'agent_memory', jsonb_build_object('scrubbed', v_agent_memory_scrubbed),
      'agent_sessions', jsonb_build_object('scrubbed', v_agent_sessions_scrubbed),
      'audit_logs', jsonb_build_object('scrubbed', v_audit_logs_scrubbed)
    )
  );

  UPDATE public.dsr_erasure_requests
  SET user_id = p_user_id,
      target_email_hash = COALESCE(p_target_email_hash, target_email_hash),
      redacted_ts = p_redacted_ts,
      status = 'completed',
      result_summary = v_result,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND request_token = p_request_token;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text)
IS 'Atomically anonymizes a tenant-scoped user profile, scrubs/deletes dependent PII-bearing rows, persists an idempotent replay token, and returns a coverage summary.';

REVOKE ALL ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text) TO service_role;
