-- Fix tenant_id type mismatches
-- The tenants table uses TEXT for id, not UUID

-- Drop existing tables if they exist (from partial migrations)
DROP TABLE IF EXISTS legal_holds CASCADE;
DROP TABLE IF EXISTS user_deletions CASCADE;
DROP TABLE IF EXISTS cross_region_transfers CASCADE;
DROP TABLE IF EXISTS user_consents CASCADE;
DROP TABLE IF EXISTS security_incidents CASCADE;
DROP TABLE IF EXISTS data_region_changes CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS temp_files CASCADE;

-- Recreate legal_holds with TEXT tenant_id
CREATE TABLE legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  reason TEXT NOT NULL,
  case_number TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'lifted')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_legal_holds_user_id ON legal_holds(user_id);
CREATE INDEX idx_legal_holds_tenant_id ON legal_holds(tenant_id);
CREATE INDEX idx_legal_holds_status ON legal_holds(status);
CREATE INDEX idx_legal_holds_created_at ON legal_holds(created_at);

-- Recreate user_deletions with TEXT tenant_id
CREATE TABLE user_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  tenant_id TEXT REFERENCES tenants(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN (
    'user_request',
    'admin_action',
    'gdpr_compliance',
    'account_closure',
    'inactivity'
  )),
  reason TEXT,
  data_exported BOOLEAN DEFAULT FALSE,
  export_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_deletions_user_id ON user_deletions(user_id);
CREATE INDEX idx_user_deletions_user_email ON user_deletions(user_email);
CREATE INDEX idx_user_deletions_tenant_id ON user_deletions(tenant_id);
CREATE INDEX idx_user_deletions_requested_at ON user_deletions(requested_at);
CREATE INDEX idx_user_deletions_completed_at ON user_deletions(completed_at);
CREATE INDEX idx_user_deletions_deletion_type ON user_deletions(deletion_type);

-- Recreate cross_region_transfers with TEXT tenant_id
CREATE TABLE cross_region_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  from_region TEXT NOT NULL,
  to_region TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data_size_bytes BIGINT,
  legal_basis TEXT NOT NULL CHECK (legal_basis IN (
    'user_consent',
    'standard_contractual_clauses',
    'adequacy_decision',
    'binding_corporate_rules',
    'derogation'
  )),
  consent_id UUID,
  transferred_by UUID NOT NULL REFERENCES auth.users(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purpose TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cross_region_transfers_user_id ON cross_region_transfers(user_id);
CREATE INDEX idx_cross_region_transfers_tenant_id ON cross_region_transfers(tenant_id);
CREATE INDEX idx_cross_region_transfers_from_region ON cross_region_transfers(from_region);
CREATE INDEX idx_cross_region_transfers_to_region ON cross_region_transfers(to_region);
CREATE INDEX idx_cross_region_transfers_transferred_at ON cross_region_transfers(transferred_at);
CREATE INDEX idx_cross_region_transfers_legal_basis ON cross_region_transfers(legal_basis);

-- Recreate user_consents with TEXT tenant_id
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  consent_type TEXT NOT NULL,
  purpose TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_tenant_id ON user_consents(tenant_id);
CREATE INDEX idx_user_consents_consent_type ON user_consents(consent_type);

-- Recreate security_incidents with TEXT tenant_id
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id),
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  affected_users INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_incidents_tenant_id ON security_incidents(tenant_id);
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX idx_security_incidents_detected_at ON security_incidents(detected_at);

-- Recreate data_region_changes with TEXT tenant_id
CREATE TABLE data_region_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  old_region TEXT NOT NULL,
  new_region TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_data_region_changes_tenant_id ON data_region_changes(tenant_id);
CREATE INDEX idx_data_region_changes_changed_at ON data_region_changes(changed_at);

-- Recreate sessions with TEXT tenant_id
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Recreate temp_files with TEXT tenant_id
CREATE TABLE temp_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_temp_files_user_id ON temp_files(user_id);
CREATE INDEX idx_temp_files_created_at ON temp_files(created_at);

-- Enable RLS on all tables
ALTER TABLE legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_region_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_region_changes ENABLE ROW LEVEL SECURITY;

-- Create service role policies
CREATE POLICY legal_holds_service_role ON legal_holds FOR ALL TO service_role USING (true);
CREATE POLICY user_deletions_service_role ON user_deletions FOR ALL TO service_role USING (true);
CREATE POLICY cross_region_transfers_service_role ON cross_region_transfers FOR ALL TO service_role USING (true);
CREATE POLICY user_consents_service_role ON user_consents FOR ALL TO service_role USING (true);
CREATE POLICY security_incidents_service_role ON security_incidents FOR ALL TO service_role USING (true);
CREATE POLICY data_region_changes_service_role ON data_region_changes FOR ALL TO service_role USING (true);
