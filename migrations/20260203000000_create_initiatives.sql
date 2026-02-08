-- ============================================================================
-- Initiatives: multi-tenant CRUD with audit fields, soft delete, idempotency
-- ============================================================================

CREATE TABLE IF NOT EXISTS initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  category TEXT NOT NULL CHECK (category IN ('growth', 'efficiency', 'risk')),
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 5),
  owner_email TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  start_date DATE,
  end_date DATE,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT initiatives_dates_valid CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  )
);

CREATE INDEX IF NOT EXISTS idx_initiatives_tenant ON initiatives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_initiatives_category ON initiatives(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_initiatives_priority ON initiatives(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_initiatives_created_at ON initiatives(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS initiatives_tenant_name_unique
  ON initiatives(tenant_id, name)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS initiatives_tenant_idempotency_unique
  ON initiatives(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS initiatives_tenant_select ON initiatives;
DROP POLICY IF EXISTS initiatives_tenant_insert ON initiatives;
DROP POLICY IF EXISTS initiatives_tenant_update ON initiatives;
DROP POLICY IF EXISTS initiatives_tenant_delete ON initiatives;

CREATE POLICY initiatives_tenant_select ON initiatives
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY initiatives_tenant_insert ON initiatives
  FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY initiatives_tenant_update ON initiatives
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY initiatives_tenant_delete ON initiatives
  FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));
