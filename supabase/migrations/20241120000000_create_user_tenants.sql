-- Create user_tenants table (missing dependency)
-- This table is required by multiple later migrations
-- Created: 2025-12-26 (retroactive fix)

-- Tenants table (if not exists)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- User-Tenant relationship table
CREATE TABLE IF NOT EXISTS user_tenants (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Roles table (if not exists, required by some RLS policies)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id UUID NOT NULL,
  tenant_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for user_tenants
CREATE POLICY "user_tenants_select" ON user_tenants
  FOR SELECT USING (
    user_id = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.user_id = auth.uid()::text
      AND ut.tenant_id = user_tenants.tenant_id
      AND ut.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "user_tenants_insert" ON user_tenants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.user_id = auth.uid()::text
      AND ut.tenant_id = user_tenants.tenant_id
      AND ut.role IN ('owner', 'admin')
    )
  );

-- Tenants policies
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()::text
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Insert default system roles
INSERT INTO roles (name, description, permissions) VALUES
  ('system_admin', 'System administrator with full access', '["*"]'::jsonb),
  ('security_admin', 'Security administrator', '["security.*", "audit.*"]'::jsonb),
  ('tenant_owner', 'Tenant owner', '["tenant.*"]'::jsonb),
  ('tenant_admin', 'Tenant administrator', '["tenant.read", "tenant.write"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE user_tenants IS 'Maps users to tenants with roles - required by security migrations';
COMMENT ON TABLE tenants IS 'Multi-tenant organization table';
