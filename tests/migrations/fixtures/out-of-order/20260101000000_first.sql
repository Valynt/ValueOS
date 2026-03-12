-- migration 1 (inserted after migration 3 — simulates backfill violation)
CREATE TABLE IF NOT EXISTS accounts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
);
