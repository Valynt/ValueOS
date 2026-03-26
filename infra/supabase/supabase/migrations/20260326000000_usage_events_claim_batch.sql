-- Add atomic claim semantics for usage aggregation workers.

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by text;

CREATE INDEX IF NOT EXISTS idx_usage_events_claimable
  ON public.usage_events (processed, claim_expires_at, "timestamp")
  WHERE processed = false;

CREATE OR REPLACE FUNCTION public.claim_usage_events_batch(
  p_worker_id text,
  p_batch_size integer DEFAULT 1000,
  p_claim_ttl_seconds integer DEFAULT 300
)
RETURNS SETOF public.usage_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'p_worker_id is required';
  END IF;

  IF p_batch_size IS NULL OR p_batch_size <= 0 THEN
    RAISE EXCEPTION 'p_batch_size must be > 0';
  END IF;

  RETURN QUERY
  WITH claimable AS (
    SELECT ue.id
    FROM public.usage_events ue
    WHERE ue.processed = false
      AND (ue.claimed_by IS NULL OR ue.claim_expires_at IS NULL OR ue.claim_expires_at <= now())
    ORDER BY ue."timestamp" ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.usage_events ue
    SET
      claimed_by = p_worker_id,
      claimed_at = now(),
      claim_expires_at = now() + make_interval(secs => p_claim_ttl_seconds)
    FROM claimable c
    WHERE ue.id = c.id
    RETURNING ue.*
  )
  SELECT *
  FROM claimed
  ORDER BY "timestamp" ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_usage_events_batch(text, integer, integer) TO service_role;
