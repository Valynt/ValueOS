-- ============================================================================
-- Tenant Foundations: tenants + user_tenants schema, constraints, indexes, RLS
-- ============================================================================

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::JSONB,
    status TEXT DEFAULT 'active' CHECK (
        status IN ('active', 'suspended', 'deleted')
    )
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);

-- User-to-tenant memberships
CREATE TABLE IF NOT EXISTS user_tenants (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (
        role IN ('owner', 'admin', 'member', 'viewer')
    ),
    status TEXT DEFAULT 'active' CHECK (
        status IN ('active', 'suspended', 'revoked')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, user_id),
    CONSTRAINT user_tenants_tenant_id_fkey FOREIGN KEY (
        tenant_id
    ) REFERENCES tenants (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_status ON user_tenants (status);

-- Ensure status column exists for legacy schemas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_tenants'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tenants' AND column_name = 'status'
  ) THEN
    ALTER TABLE user_tenants ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked'));
  END IF;
END $$;

-- Updated_at trigger (if shared function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
    CREATE TRIGGER update_tenants_updated_at
      BEFORE UPDATE ON tenants
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_user_tenants_updated_at ON user_tenants;
    CREATE TRIGGER update_user_tenants_updated_at
      BEFORE UPDATE ON user_tenants
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants
FOR SELECT
USING (
    id IN (
        SELECT tenant_id FROM user_tenants
        WHERE
            user_id = (auth.uid())::TEXT
            AND status = 'active'
    )
);

DROP POLICY IF EXISTS user_tenants_select ON user_tenants;
CREATE POLICY user_tenants_select ON user_tenants
FOR SELECT
USING (
    user_id = (auth.uid())::TEXT
    OR EXISTS (
        SELECT 1 FROM user_tenants AS ut
        WHERE
            ut.user_id = (auth.uid())::TEXT
            AND ut.tenant_id = user_tenants.tenant_id
            AND ut.role IN ('owner', 'admin')
            AND ut.status = 'active'
    )
);

DROP POLICY IF EXISTS user_tenants_insert ON user_tenants;
CREATE POLICY user_tenants_insert ON user_tenants
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_tenants AS ut
        WHERE
            ut.user_id = (auth.uid())::TEXT
            AND ut.tenant_id = user_tenants.tenant_id
            AND ut.role IN ('owner', 'admin')
            AND ut.status = 'active'
    )
);

DROP POLICY IF EXISTS user_tenants_update ON user_tenants;
CREATE POLICY user_tenants_update ON user_tenants
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM user_tenants AS ut
        WHERE
            ut.user_id = (auth.uid())::TEXT
            AND ut.tenant_id = user_tenants.tenant_id
            AND ut.role IN ('owner', 'admin')
            AND ut.status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_tenants AS ut
        WHERE
            ut.user_id = (auth.uid())::TEXT
            AND ut.tenant_id = user_tenants.tenant_id
            AND ut.role IN ('owner', 'admin')
            AND ut.status = 'active'
    )
);

DROP POLICY IF EXISTS user_tenants_delete ON user_tenants;
CREATE POLICY user_tenants_delete ON user_tenants
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM user_tenants AS ut
        WHERE
            ut.user_id = (auth.uid())::TEXT
            AND ut.tenant_id = user_tenants.tenant_id
            AND ut.role IN ('owner', 'admin')
            AND ut.status = 'active'
    )
);


