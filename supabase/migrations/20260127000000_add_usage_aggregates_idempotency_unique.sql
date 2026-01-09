CREATE UNIQUE INDEX IF NOT EXISTS usage_aggregates_idempotency_key_unique
  ON public.usage_aggregates (idempotency_key);
