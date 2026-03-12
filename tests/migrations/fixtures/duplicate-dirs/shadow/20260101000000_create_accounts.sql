-- Shadow copy of the same migration in a second directory.
-- Simulates a parallel migration source that should be rejected.
CREATE TABLE IF NOT EXISTS accounts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
);
