-- Same timestamp prefix as create_accounts — duplicate version violation
CREATE TABLE IF NOT EXISTS users (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
);
