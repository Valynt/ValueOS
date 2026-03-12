CREATE TABLE IF NOT EXISTS accounts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name      TEXT NOT NULL
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
