-- Security audit retention with immutable archive manifest + integrity verification.

DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN others THEN RAISE NOTICE 'pgcrypto: skipped (%)' , SQLERRM; END $$;

CREATE TABLE IF NOT EXISTS public.security_audit_archive_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_policy_version TEXT NOT NULL,
  operational_window_days INTEGER NOT NULL,
  archive_retain_until TIMESTAMPTZ NOT NULL,
  object_store_uri TEXT,
  object_lock_mode TEXT NOT NULL DEFAULT 'COMPLIANCE',
  legal_hold BOOLEAN NOT NULL DEFAULT TRUE,
  export_checksum_sha256 TEXT,
  exported_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'staged'
);

CREATE TABLE IF NOT EXISTS public.security_audit_archive_segment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.security_audit_archive_batch(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ,
  payload JSONB NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  chain_prev_checksum_sha256 TEXT,
  chain_checksum_sha256 TEXT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_security_audit_archive_segment_batch ON public.security_audit_archive_segment(batch_id, event_timestamp);

CREATE TABLE IF NOT EXISTS public.security_audit_archive_alert (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.security_audit_archive_batch(id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  code TEXT NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.rotate_security_audit_logs(
  retention_policy JSONB DEFAULT '{"policy_version":"legacy-180d","operational_window_days":180,"archive_years":7}'::jsonb,
  max_rows INTEGER DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy_version TEXT := COALESCE(retention_policy->>'policy_version', 'legacy-180d');
  operational_window_days INTEGER := COALESCE((retention_policy->>'operational_window_days')::INTEGER, 180);
  archive_years INTEGER := COALESCE((retention_policy->>'archive_years')::INTEGER, 7);
  archive_retain_until TIMESTAMPTZ := NOW() + make_interval(years => archive_years);
  batch_id UUID;
  moved_count INTEGER := 0;
BEGIN
  INSERT INTO public.security_audit_archive_batch (
    retention_policy_version,
    operational_window_days,
    archive_retain_until
  ) VALUES (
    policy_version,
    operational_window_days,
    archive_retain_until
  )
  RETURNING id INTO batch_id;

  WITH candidates AS (
    SELECT ctid, to_jsonb(s) AS payload
    FROM public.security_audit_log AS s
    WHERE COALESCE(
      NULLIF(to_jsonb(s)->>'timestamp', '')::timestamptz,
      NULLIF(to_jsonb(s)->>'created_at', '')::timestamptz,
      NOW()
    ) < NOW() - make_interval(days => operational_window_days)
    ORDER BY COALESCE(
      NULLIF(to_jsonb(s)->>'timestamp', '')::timestamptz,
      NULLIF(to_jsonb(s)->>'created_at', '')::timestamptz,
      NOW()
    )
    LIMIT GREATEST(max_rows, 1)
  ), archived AS (
    INSERT INTO public.security_audit_archive_segment (
      batch_id,
      source_id,
      event_timestamp,
      payload,
      checksum_sha256,
      chain_prev_checksum_sha256,
      chain_checksum_sha256
    )
    SELECT
      batch_id,
      COALESCE(payload->>'id', encode(digest(payload::text, 'sha256'), 'hex')),
      COALESCE(
        NULLIF(payload->>'timestamp', '')::timestamptz,
        NULLIF(payload->>'created_at', '')::timestamptz,
        NOW()
      ),
      payload,
      encode(digest(payload::text, 'sha256'), 'hex'),
      lag(encode(digest(payload::text, 'sha256'), 'hex')) OVER (
        ORDER BY COALESCE(NULLIF(payload->>'timestamp', '')::timestamptz, NULLIF(payload->>'created_at', '')::timestamptz, NOW())
      ),
      encode(
        digest(
          COALESCE(
            lag(encode(digest(payload::text, 'sha256'), 'hex')) OVER (
              ORDER BY COALESCE(NULLIF(payload->>'timestamp', '')::timestamptz, NULLIF(payload->>'created_at', '')::timestamptz, NOW())
            ),
            ''
          ) || ':' || encode(digest(payload::text, 'sha256'), 'hex'),
          'sha256'
        ),
        'hex'
      )
    FROM candidates
    RETURNING source_id
  ), deleted AS (
    DELETE FROM public.security_audit_log AS s
    USING candidates
    WHERE s.ctid = candidates.ctid
    RETURNING 1
  )
  SELECT COUNT(*) INTO moved_count FROM deleted;

  UPDATE public.security_audit_archive_batch
  SET status = CASE WHEN moved_count = 0 THEN 'noop' ELSE 'staged' END
  WHERE id = batch_id;

  RETURN jsonb_build_object(
    'batch_id', batch_id,
    'policy_version', policy_version,
    'operational_window_days', operational_window_days,
    'archive_years', archive_years,
    'rows_moved', moved_count,
    'status', CASE WHEN moved_count = 0 THEN 'noop' ELSE 'staged' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_security_audit_archive_integrity(
  lookback_days INTEGER DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bad_checksum_count INTEGER := 0;
  missing_export_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO bad_checksum_count
  FROM public.security_audit_archive_segment s
  WHERE s.archived_at >= NOW() - make_interval(days => lookback_days)
    AND s.checksum_sha256 <> encode(digest(s.payload::text, 'sha256'), 'hex');

  SELECT COUNT(*) INTO missing_export_count
  FROM public.security_audit_archive_batch b
  WHERE b.created_at >= NOW() - make_interval(days => lookback_days)
    AND b.status IN ('staged', 'exported')
    AND (b.object_store_uri IS NULL OR b.export_checksum_sha256 IS NULL);

  IF bad_checksum_count > 0 OR missing_export_count > 0 THEN
    INSERT INTO public.security_audit_archive_alert (severity, code, details)
    VALUES (
      'critical',
      'archive_integrity_mismatch',
      jsonb_build_object(
        'bad_checksum_count', bad_checksum_count,
        'missing_export_count', missing_export_count,
        'lookback_days', lookback_days
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN bad_checksum_count = 0 AND missing_export_count = 0 THEN 'ok' ELSE 'alert' END,
    'bad_checksum_count', bad_checksum_count,
    'missing_export_count', missing_export_count,
    'lookback_days', lookback_days
  );
END;
$$;
