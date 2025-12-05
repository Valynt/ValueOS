/*
  # Enterprise Features Database Schema

  1. New Tables
    - `settings_versions` - Version history for all settings changes
    - `active_sessions` - Real-time presence tracking
    - `approval_workflows` - Multi-level approval system
    - `approval_requests` - Pending approval requests
    - `ip_allowlist` - IP and CIDR block management
    - `data_retention_policies` - Automated data retention rules
    - `settings_backups` - Backup snapshots
    - `organization_templates` - Configuration templates
    - `custom_branding` - White-label customizations
    - `rate_limit_rules` - Per-role rate limiting

  2. Security
    - Enable RLS on all tables
    - Add policies for admin-only access
    - Audit logging integration

  3. Indexes
    - Optimized indexes for common queries
*/

-- Settings Version History
CREATE TABLE IF NOT EXISTS settings_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  scope TEXT NOT NULL CHECK (scope IN ('user', 'team', 'organization')),
  scope_id TEXT NOT NULL,
  changed_by UUID NOT NULL,
  change_description TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  rolled_back BOOLEAN DEFAULT false,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID
);

CREATE INDEX IF NOT EXISTS idx_settings_versions_scope ON settings_versions(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_settings_versions_key ON settings_versions(setting_key);
CREATE INDEX IF NOT EXISTS idx_settings_versions_changed_by ON settings_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_settings_versions_created_at ON settings_versions(created_at DESC);

ALTER TABLE settings_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all versions" ON settings_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'organization.manage' = ANY(permissions)
      )
    )
  );

-- Active Sessions (Real-time Presence)
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  action TEXT, -- viewing, editing, etc.
  metadata JSONB DEFAULT '{}',
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_page ON active_sessions(page_path);
CREATE INDEX IF NOT EXISTS idx_active_sessions_heartbeat ON active_sessions(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON active_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Approval Workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('organization', 'team', 'all')),
  scope_id TEXT,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  approval_levels INTEGER NOT NULL DEFAULT 1,
  required_approvers JSONB NOT NULL DEFAULT '[]',
  timeout_hours INTEGER DEFAULT 72,
  auto_approve_after_timeout BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_scope ON approval_workflows(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_enabled ON approval_workflows(enabled);

ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage workflows" ON approval_workflows
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'organization.manage' = ANY(permissions)
      )
    )
  );

-- Approval Requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES approval_workflows(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  change_type TEXT NOT NULL,
  change_data JSONB NOT NULL,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  current_level INTEGER DEFAULT 1,
  approvals JSONB DEFAULT '[]',
  rejections JSONB DEFAULT '[]',
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON approval_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow ON approval_requests(workflow_id);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON approval_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requested_by OR auth.uid()::text IN (
    SELECT jsonb_array_elements_text(approvals)
  ));

-- IP Allowlist
CREATE TABLE IF NOT EXISTS ip_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  ip_address TEXT,
  cidr_block TEXT,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_tested_at TIMESTAMPTZ,
  test_result TEXT
);

CREATE INDEX IF NOT EXISTS idx_ip_allowlist_org ON ip_allowlist(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_allowlist_enabled ON ip_allowlist(enabled);

ALTER TABLE ip_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage IP allowlist" ON ip_allowlist
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'security.manage' = ANY(permissions)
      )
    )
  );

-- Data Retention Policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('delete', 'archive', 'anonymize')),
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_org ON data_retention_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_retention_policies_next_run ON data_retention_policies(next_run_at);

ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage retention policies" ON data_retention_policies
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'organization.manage' = ANY(permissions)
      )
    )
  );

-- Settings Backups
CREATE TABLE IF NOT EXISTS settings_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  backup_name TEXT NOT NULL,
  backup_data JSONB NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('manual', 'scheduled', 'pre_change')),
  encrypted BOOLEAN DEFAULT true,
  encryption_key_id TEXT,
  size_bytes BIGINT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  restored_at TIMESTAMPTZ,
  restored_by UUID
);

CREATE INDEX IF NOT EXISTS idx_backups_org ON settings_backups(organization_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON settings_backups(created_at DESC);

ALTER TABLE settings_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage backups" ON settings_backups
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'organization.manage' = ANY(permissions)
      )
    )
  );

-- Organization Templates
CREATE TABLE IF NOT EXISTS organization_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  industry TEXT,
  organization_size TEXT,
  version INTEGER DEFAULT 1,
  is_public BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_public ON organization_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_industry ON organization_templates(industry);

ALTER TABLE organization_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public templates visible to all" ON organization_templates
  FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = created_by);

-- Custom Branding
CREATE TABLE IF NOT EXISTS custom_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  custom_domain TEXT,
  custom_css TEXT,
  email_from_name TEXT,
  email_from_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branding_org ON custom_branding(organization_id);

ALTER TABLE custom_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage branding" ON custom_branding
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'organization.manage' = ANY(permissions)
      )
    )
  );

-- Rate Limit Rules
CREATE TABLE IF NOT EXISTS rate_limit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  role_id UUID,
  endpoint_pattern TEXT NOT NULL,
  requests_per_minute INTEGER NOT NULL,
  requests_per_hour INTEGER NOT NULL,
  requests_per_day INTEGER NOT NULL,
  burst_limit INTEGER,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_org ON rate_limit_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_role ON rate_limit_rules(role_id);

ALTER TABLE rate_limit_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage rate limits" ON rate_limit_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'security.manage' = ANY(permissions)
      )
    )
  );

-- Compliance Exports
CREATE TABLE IF NOT EXISTS compliance_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('soc2', 'gdpr', 'hipaa', 'custom')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  file_url TEXT,
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  requested_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compliance_exports_org ON compliance_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_exports_type ON compliance_exports(export_type);

ALTER TABLE compliance_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage compliance exports" ON compliance_exports
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'audit.view' = ANY(permissions)
      )
    )
  );
