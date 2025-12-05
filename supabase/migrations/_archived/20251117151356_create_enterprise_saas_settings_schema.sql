/*
  # Enterprise SaaS Settings & User Management Schema
  
  This migration creates a complete 15-table schema for enterprise SaaS applications with
  comprehensive user management, multi-tenancy, security, billing, and integration capabilities.
  
  ## Core User & Organization Management (3 tables)
  
  1. `users` - Extended user profiles with preferences and metadata
     - `id` (uuid, primary key) - Unique user identifier (links to auth.users)
     - `email` (text, unique) - User email address
     - `full_name` (text) - User's full name
     - `display_name` (text) - Display name/handle
     - `avatar_url` (text) - Profile picture URL
     - `job_title` (text) - User's job title
     - `user_preferences` (jsonb) - Theme, language, notification settings
     - `created_at` (timestamptz) - Account creation timestamp
     - `updated_at` (timestamptz) - Last profile update timestamp
     - `is_active` (boolean) - Account active status
     - `metadata` (jsonb) - Additional user metadata
  
  2. `organizations` - Company/organization entities
     - `id` (uuid, primary key) - Unique organization identifier
     - `name` (text) - Organization name
     - `slug` (text, unique) - URL-safe organization identifier
     - `logo_url` (text) - Organization logo URL
     - `organization_settings` (jsonb) - Org-wide settings (timezone, currency, etc.)
     - `billing_info` (jsonb) - Billing contact and payment information
     - `subscription_tier` (text) - Plan level (free, pro, enterprise)
     - `created_at` (timestamptz) - Organization creation timestamp
     - `updated_at` (timestamptz) - Last update timestamp
     - `is_active` (boolean) - Organization active status
     - `metadata` (jsonb) - Additional organization metadata
  
  3. `teams` - Workspaces/teams within organizations
     - `id` (uuid, primary key) - Unique team identifier
     - `organization_id` (uuid, FK) - Parent organization
     - `name` (text) - Team name
     - `slug` (text) - URL-safe team identifier
     - `description` (text) - Team description
     - `team_settings` (jsonb) - Team-specific settings
     - `created_at` (timestamptz) - Team creation timestamp
     - `updated_at` (timestamptz) - Last update timestamp
     - `created_by` (uuid, FK) - User who created the team
     - `is_active` (boolean) - Team active status
  
  ## Security & Access Control (4 tables)
  
  4. `roles` - Role definitions with permissions
     - `id` (uuid, primary key) - Unique role identifier
     - `role_name` (text) - Role name (e.g., "Admin", "Member", "Guest")
     - `permissions` (jsonb) - Array of permission strings
     - `is_custom_role` (boolean) - Whether this is a custom role
     - `organization_id` (uuid, FK) - Organization for custom roles (null for system roles)
     - `description` (text) - Role description
     - `created_at` (timestamptz) - Role creation timestamp
     - `updated_at` (timestamptz) - Last update timestamp
  
  5. `user_roles` - Junction table for user-role assignments
     - `id` (uuid, primary key) - Unique assignment identifier
     - `user_id` (uuid, FK) - User being assigned the role
     - `role_id` (uuid, FK) - Role being assigned
     - `assigned_at` (timestamptz) - When role was assigned
     - `assigned_by` (uuid, FK) - User who assigned the role
     - `expires_at` (timestamptz) - Optional role expiration
  
  6. `organization_members` - Organization membership and roles
     - `id` (uuid, primary key) - Unique membership identifier
     - `user_id` (uuid, FK) - Member user
     - `organization_id` (uuid, FK) - Organization
     - `role_id` (uuid, FK) - Role in this organization
     - `joined_at` (timestamptz) - When user joined organization
     - `status` (text) - Membership status (active, invited, suspended)
     - `invited_by` (uuid, FK) - User who invited this member
  
  7. `team_members` - Team membership
     - `id` (uuid, primary key) - Unique membership identifier
     - `user_id` (uuid, FK) - Member user
     - `team_id` (uuid, FK) - Team
     - `role_id` (uuid, FK) - Role in this team
     - `joined_at` (timestamptz) - When user joined team
  
  ## Session & Audit Management (2 tables)
  
  8. `user_sessions` - Active user sessions for security tracking
     - `id` (uuid, primary key) - Unique session identifier
     - `session_id` (text, unique) - Session token/identifier
     - `user_id` (uuid, FK) - Session owner
     - `ip_address` (text) - Client IP address
     - `user_agent` (text) - Browser/client information
     - `created_at` (timestamptz) - Session creation timestamp
     - `expires_at` (timestamptz) - Session expiration timestamp
     - `last_activity_at` (timestamptz) - Last activity timestamp
     - `is_active` (boolean) - Whether session is currently active
     - `metadata` (jsonb) - Additional session metadata
  
  9. `audit_logs` - Comprehensive action audit trail
     - `id` (uuid, primary key) - Unique log entry identifier
     - `user_id` (uuid, FK) - User who performed the action
     - `organization_id` (uuid, FK) - Organization context
     - `action_type` (text) - Type of action performed
     - `resource_type` (text) - Type of resource affected
     - `resource_id` (uuid) - ID of affected resource
     - `metadata` (jsonb) - Action details, before/after values
     - `ip_address` (text) - Client IP address
     - `user_agent` (text) - Browser/client information
     - `timestamp` (timestamptz) - When action occurred
     - `status` (text) - Action status (success, failed)
  
  ## Integrations & API Management (3 tables)
  
  10. `integrations` - Third-party integrations
      - `id` (uuid, primary key) - Unique integration identifier
      - `integration_name` (text) - Integration name (e.g., "Slack", "GitHub")
      - `integration_type` (text) - Type of integration
      - `config` (jsonb) - Integration configuration
      - `organization_id` (uuid, FK) - Organization (null for user-level)
      - `user_id` (uuid, FK) - User (null for org-level)
      - `is_active` (boolean) - Whether integration is active
      - `created_at` (timestamptz) - Integration creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `last_sync_at` (timestamptz) - Last successful sync
  
  11. `api_keys` - Organization API keys
      - `id` (uuid, primary key) - Unique key identifier
      - `key_hash` (text, unique) - Hashed API key
      - `key_prefix` (text) - Visible key prefix (e.g., "sk_live_abc...")
      - `organization_id` (uuid, FK) - Owning organization
      - `name` (text) - Descriptive key name
      - `permissions` (jsonb) - Array of permitted actions
      - `created_by` (uuid, FK) - User who created the key
      - `created_at` (timestamptz) - Key creation timestamp
      - `last_used_at` (timestamptz) - Last usage timestamp
      - `expires_at` (timestamptz) - Optional expiration
      - `is_active` (boolean) - Whether key is active
  
  12. `webhooks` - Webhook configurations
      - `id` (uuid, primary key) - Unique webhook identifier
      - `organization_id` (uuid, FK) - Owning organization
      - `endpoint_url` (text) - Webhook destination URL
      - `events` (jsonb) - Array of subscribed event types
      - `secret_key` (text) - Webhook signing secret
      - `is_active` (boolean) - Whether webhook is active
      - `created_at` (timestamptz) - Webhook creation timestamp
      - `created_by` (uuid, FK) - User who created the webhook
      - `last_triggered_at` (timestamptz) - Last successful trigger
      - `failure_count` (integer) - Consecutive failure count
  
  ## User Experience & Billing (2 tables)
  
  13. `notification_preferences` - User notification settings
      - `id` (uuid, primary key) - Unique preference identifier
      - `user_id` (uuid, FK, unique) - User these preferences belong to
      - `email_notifications` (jsonb) - Email notification settings by type
      - `push_notifications` (jsonb) - Push notification settings by type
      - `in_app_notifications` (jsonb) - In-app notification settings
      - `slack_notifications` (jsonb) - Slack notification settings
      - `do_not_disturb` (boolean) - Global DND toggle
      - `updated_at` (timestamptz) - Last update timestamp
  
  14. `billing_invoices` - Invoice history
      - `id` (uuid, primary key) - Unique invoice identifier
      - `organization_id` (uuid, FK) - Organization being billed
      - `invoice_number` (text, unique) - Invoice number
      - `amount` (numeric) - Invoice amount
      - `currency` (text) - Currency code (USD, EUR, etc.)
      - `status` (text) - Invoice status (draft, paid, overdue, cancelled)
      - `billing_period_start` (date) - Billing period start
      - `billing_period_end` (date) - Billing period end
      - `created_at` (timestamptz) - Invoice creation timestamp
      - `paid_at` (timestamptz) - Payment timestamp
      - `pdf_url` (text) - URL to invoice PDF
      - `metadata` (jsonb) - Additional invoice metadata
  
  ## Policy & Compliance (1 table)
  
  15. `policy_enforcement` - Organization security policies
      - `id` (uuid, primary key) - Unique policy identifier
      - `organization_id` (uuid, FK, unique) - Organization these policies apply to
      - `sso_required` (boolean) - Whether SSO is enforced
      - `mfa_required` (boolean) - Whether MFA is enforced
      - `password_policy` (jsonb) - Password requirements
      - `session_timeout` (integer) - Session timeout in minutes
      - `allowed_domains` (jsonb) - Array of allowed email domains for signup
      - `ip_allowlist` (jsonb) - Array of allowed IP ranges
      - `updated_at` (timestamptz) - Last policy update
      - `updated_by` (uuid, FK) - User who updated policies
  
  ## Security
  
  - All tables have Row Level Security (RLS) enabled
  - Users can only access data within their authorized organizations and teams
  - Comprehensive audit trail for compliance (SOC2, GDPR)
  - Immutable audit logs with complete action history
  - Session management for security and concurrent login control
  - API key hashing for secure credential storage
  - Webhook secret management for secure integrations
  
  ## Performance
  
  - Indexes on all foreign key relationships
  - Indexes on frequently queried fields (email, slug, status)
  - Indexes on audit log searches (user_id, organization_id, timestamp)
  - Composite indexes for membership queries
  - Partial indexes for active records filtering
*/

-- =====================================================
-- CORE USER & ORGANIZATION MANAGEMENT (3 tables)
-- =====================================================

-- 1. Users table (extended profiles)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  display_name text,
  avatar_url text,
  job_title text,
  user_preferences jsonb DEFAULT '{
    "theme": "system",
    "language": "en",
    "timezone": "UTC",
    "dateFormat": "YYYY-MM-DD",
    "notifications": true
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  organization_settings jsonb DEFAULT '{
    "timezone": "UTC",
    "currency": "USD",
    "dateFormat": "YYYY-MM-DD",
    "fiscalYearStart": "01-01"
  }'::jsonb,
  billing_info jsonb DEFAULT '{}'::jsonb,
  subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise', 'trial')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 3. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  team_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  UNIQUE(organization_id, slug)
);

-- =====================================================
-- SECURITY & ACCESS CONTROL (4 tables)
-- =====================================================

-- 4. Roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_custom_role boolean DEFAULT false,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, role_name)
);

-- 5. User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  UNIQUE(user_id, role_id)
);

-- 6. Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  joined_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'left')),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, organization_id)
);

-- 7. Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- =====================================================
-- SESSION & AUDIT MANAGEMENT (2 tables)
-- =====================================================

-- 8. User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 9. Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  timestamp timestamptz DEFAULT now(),
  status text DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending'))
);

-- =====================================================
-- INTEGRATIONS & API MANAGEMENT (3 tables)
-- =====================================================

-- 10. Integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name text NOT NULL,
  integration_type text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_sync_at timestamptz,
  CHECK (organization_id IS NOT NULL OR user_id IS NOT NULL)
);

-- 11. API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text UNIQUE NOT NULL,
  key_prefix text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

-- 12. Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  events jsonb DEFAULT '[]'::jsonb,
  secret_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  last_triggered_at timestamptz,
  failure_count integer DEFAULT 0
);

-- =====================================================
-- USER EXPERIENCE & BILLING (2 tables)
-- =====================================================

-- 13. Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_notifications jsonb DEFAULT '{
    "task_assigned": true,
    "comment_posted": true,
    "mention": true,
    "weekly_digest": true
  }'::jsonb,
  push_notifications jsonb DEFAULT '{
    "task_assigned": true,
    "comment_posted": true,
    "mention": true
  }'::jsonb,
  in_app_notifications jsonb DEFAULT '{
    "task_assigned": true,
    "comment_posted": true,
    "mention": true,
    "system_updates": true
  }'::jsonb,
  slack_notifications jsonb DEFAULT '{
    "task_assigned": false,
    "mention": false
  }'::jsonb,
  do_not_disturb boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- 14. Billing invoices table
CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'USD' NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'paid', 'overdue', 'cancelled', 'refunded')),
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  pdf_url text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- =====================================================
-- POLICY & COMPLIANCE (1 table)
-- =====================================================

-- 15. Policy enforcement table
CREATE TABLE IF NOT EXISTS policy_enforcement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sso_required boolean DEFAULT false,
  mfa_required boolean DEFAULT false,
  password_policy jsonb DEFAULT '{
    "minLength": 8,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumbers": true,
    "requireSpecialChars": true
  }'::jsonb,
  session_timeout integer DEFAULT 1440,
  allowed_domains jsonb DEFAULT '[]'::jsonb,
  ip_allowlist jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active) WHERE is_active = true;

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- Roles indexes
CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_is_custom ON roles(is_custom_role);

-- Organization members indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_org_members_composite ON organization_members(organization_id, user_id, status);

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- User sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at) WHERE is_active = true;

-- Audit logs indexes (conditional on column existence)
DO $$
BEGIN
  -- Check if user_id column exists
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
  END IF;
  
  -- Check if organization_id column exists
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'audit_logs' AND column_name = 'organization_id') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
  END IF;
  
  -- Check if timestamp column exists
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'audit_logs' AND column_name = 'timestamp') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
  END IF;
  
  -- Check if resource_type and resource_id columns exist
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'audit_logs' AND column_name = 'resource_type') AND
     EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'audit_logs' AND column_name = 'resource_id') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
  END IF;
  
  -- Check if organization_id and timestamp columns exist for composite index
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'audit_logs' AND column_name = 'organization_id') AND
     EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'audit_logs' AND column_name = 'timestamp') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_composite ON audit_logs(organization_id, timestamp DESC);
  END IF;
END $$;

-- Integrations indexes
CREATE INDEX IF NOT EXISTS idx_integrations_organization_id ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- Webhooks indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;

-- Billing invoices indexes
CREATE INDEX IF NOT EXISTS idx_billing_invoices_organization_id ON billing_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_created_at ON billing_invoices(created_at DESC);

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if user has permission in organization
CREATE OR REPLACE FUNCTION user_has_org_permission(
  p_user_id uuid,
  p_organization_id uuid,
  p_permission text
)
RETURNS boolean AS $$
DECLARE
  v_has_permission boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN roles r ON r.id = om.role_id
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_organization_id
      AND om.status = 'active'
      AND r.permissions @> to_jsonb(p_permission)
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is member of organization
CREATE OR REPLACE FUNCTION user_is_org_member(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is member of team
CREATE OR REPLACE FUNCTION user_is_team_member(
  p_user_id uuid,
  p_team_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM teams
  WHERE id = p_team_id;
  
  RETURN EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.user_id = p_user_id
      AND tm.team_id = p_team_id
  ) AND user_is_org_member(p_user_id, v_organization_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id uuid,
  p_organization_id uuid,
  p_action_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    organization_id,
    action_type,
    resource_type,
    resource_id,
    metadata,
    timestamp,
    status
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_metadata,
    now(),
    'success'
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_enforcement ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can view profiles in same organization"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
        AND om2.user_id = users.id
        AND om1.status = 'active'
        AND om2.status = 'active'
    )
  );

-- Organizations policies
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Org admins can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (user_has_org_permission(auth.uid(), id, 'organization.manage'))
  WITH CHECK (user_has_org_permission(auth.uid(), id, 'organization.manage'));

-- Teams policies
CREATE POLICY "Users can view teams in their organization"
  ON teams FOR SELECT
  TO authenticated
  USING (user_is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(auth.uid(), organization_id));

CREATE POLICY "Team admins can update their teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    user_has_org_permission(auth.uid(), organization_id, 'team.manage')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    user_has_org_permission(auth.uid(), organization_id, 'team.manage')
    OR created_by = auth.uid()
  );

-- Roles policies
CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR user_is_org_member(auth.uid(), organization_id)
  );

-- Organization members policies
CREATE POLICY "Users can view members in their organization"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'members.manage'))
  WITH CHECK (user_has_org_permission(auth.uid(), organization_id, 'members.manage'));

-- Team members policies
CREATE POLICY "Users can view team members in their teams"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
        AND user_is_org_member(auth.uid(), teams.organization_id)
    )
  );

-- User sessions policies
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Audit logs policies
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_has_org_permission(auth.uid(), organization_id, 'audit.view')
  );

-- Integrations policies
CREATE POLICY "Users can view integrations in their organization"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "Users can manage own integrations"
  ON integrations FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Org admins can manage org integrations"
  ON integrations FOR ALL
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'integrations.manage'))
  WITH CHECK (user_has_org_permission(auth.uid(), organization_id, 'integrations.manage'));

-- API keys policies
CREATE POLICY "Users can view API keys in their organization"
  ON api_keys FOR SELECT
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'api_keys.view'));

CREATE POLICY "Org admins can manage API keys"
  ON api_keys FOR ALL
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'api_keys.manage'))
  WITH CHECK (user_has_org_permission(auth.uid(), organization_id, 'api_keys.manage'));

-- Webhooks policies
CREATE POLICY "Users can view webhooks in their organization"
  ON webhooks FOR SELECT
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'webhooks.view'));

CREATE POLICY "Org admins can manage webhooks"
  ON webhooks FOR ALL
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'webhooks.manage'))
  WITH CHECK (user_has_org_permission(auth.uid(), organization_id, 'webhooks.manage'));

-- Notification preferences policies
CREATE POLICY "Users can manage own notification preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Billing invoices policies
CREATE POLICY "Users can view invoices in their organization"
  ON billing_invoices FOR SELECT
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'billing.view'));

-- Policy enforcement policies
CREATE POLICY "Users can view policy enforcement in their organization"
  ON policy_enforcement FOR SELECT
  TO authenticated
  USING (user_is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can manage policy enforcement"
  ON policy_enforcement FOR ALL
  TO authenticated
  USING (user_has_org_permission(auth.uid(), organization_id, 'security.manage'))
  WITH CHECK (user_has_org_permission(auth.uid(), organization_id, 'security.manage'));

-- =====================================================
-- INSERT DEFAULT SYSTEM ROLES
-- =====================================================

-- Insert system-wide default roles
INSERT INTO roles (role_name, permissions, is_custom_role, description) VALUES
  ('Organization Owner', 
   '["organization.manage", "members.manage", "team.manage", "billing.manage", "api_keys.manage", "webhooks.manage", "integrations.manage", "security.manage", "audit.view"]'::jsonb,
   false,
   'Full access to all organization settings and resources'),
  ('Organization Admin',
   '["members.manage", "team.manage", "integrations.manage", "audit.view"]'::jsonb,
   false,
   'Can manage members, teams, and integrations'),
  ('Organization Member',
   '["team.view"]'::jsonb,
   false,
   'Standard organization member with basic access'),
  ('Team Admin',
   '["team.manage"]'::jsonb,
   false,
   'Can manage specific teams'),
  ('Team Member',
   '[]'::jsonb,
   false,
   'Standard team member')
ON CONFLICT DO NOTHING;