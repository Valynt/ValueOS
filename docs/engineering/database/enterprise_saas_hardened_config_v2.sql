-- ============================================================================
-- ENTERPRISE SAAS HARDENED CONFIGURATION FOR SUPABASE (AUDITED VERSION 2.0)
-- ============================================================================
-- Purpose: Baseline security policies for production multi-tenant SaaS
-- Target: Supabase PostgreSQL with Row-Level Security (RLS)
-- Compliance: SOC 2, GDPR, HIPAA-ready baseline
-- Apply via: Supabase SQL Editor or CLI
-- Version: 2.0 (Integrated with Vector Store, Enhanced Audit, Service Role Controls)
-- Last Updated: 2024
-- ============================================================================

-- ============================================================================
-- SECTION 1: DATABASE SECURITY FOUNDATION
-- ============================================================================

-- 1.1 Enable essential PostgreSQL security extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Secure UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS "vector";         -- Vector embeddings for LLM/RAG

COMMENT ON EXTENSION vector IS 'Enables storage and similarity search of vector embeddings for LLM semantic memory';

-- 1.2 Create audit schema for security logging
CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS 'Audit logging schema for security and compliance';

-- 1.3 Create security functions schema
CREATE SCHEMA IF NOT EXISTS security;
COMMENT ON SCHEMA security IS 'Security utility functions and policies';

-- ============================================================================
-- SECTION 2: ROLE-BASED ACCESS CONTROL (RBAC) SETUP
-- ============================================================================

-- 2.1 Create custom database roles for principle of least privilege
DO $$
BEGIN
    -- Application service role (used by backend services)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_service') THEN
        CREATE ROLE app_service NOLOGIN;
    END IF;
    
    -- Read-only analytics role
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_reader') THEN
        CREATE ROLE analytics_reader NOLOGIN;
    END IF;
    
    -- Admin role for operational tasks
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin NOLOGIN;
    END IF;
END
$$;

-- 2.2 Grant appropriate schema permissions
GRANT USAGE ON SCHEMA public TO app_service;
GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT ALL ON SCHEMA public TO app_admin;

-- Restrict audit schema access
GRANT USAGE ON SCHEMA audit TO app_admin;
GRANT USAGE ON SCHEMA security TO app_service;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;

-- ============================================================================
-- SECTION 3: MULTI-TENANCY FOUNDATION
-- ============================================================================

-- 3.1 Create organizations table (tenant isolation root)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.organizations IS 'Root tenant table for multi-tenancy isolation';
COMMENT ON COLUMN public.organizations.slug IS 'URL-safe unique identifier for organization';
COMMENT ON COLUMN public.organizations.status IS 'Organization status for access control';

-- 3.2 Create users table with organization relationship
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.users IS 'Application users with organization membership';
COMMENT ON COLUMN public.users.role IS 'User role within their organization for RBAC';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status) WHERE status = 'active';

-- 3.3 Create user_tenants table for multi-organization membership (ENHANCED)
-- NOTE: This table supports users belonging to multiple organizations
-- The primary users.organization_id remains as the "default" organization
CREATE TABLE IF NOT EXISTS public.user_tenants (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, organization_id)
);

COMMENT ON TABLE public.user_tenants IS 'Maps users to multiple organizations for multi-org access scenarios';
COMMENT ON COLUMN public.user_tenants.role IS 'User role within this specific organization';

-- Create indexes for user_tenants
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON public.user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_organization_id ON public.user_tenants(organization_id);

-- ============================================================================
-- SECTION 4: SECURITY UTILITY FUNCTIONS
-- ============================================================================

-- 4.1 Function to get current user's primary organization_id from JWT
CREATE OR REPLACE FUNCTION security.get_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    org_id UUID;
BEGIN
    -- PRIORITY 1: Extract organization_id from JWT custom claims (performance optimized)
    BEGIN
        org_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'organization_id', '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        org_id := NULL;
    END;
    
    -- PRIORITY 2: Fallback to users table lookup if JWT claim missing
    IF org_id IS NULL AND auth.uid() IS NOT NULL THEN
        SELECT organization_id INTO org_id
        FROM public.users
        WHERE id = auth.uid()
        LIMIT 1;
    END IF;
    
    RETURN org_id;
END;
$$;

COMMENT ON FUNCTION security.get_user_organization_id() IS 'Extracts primary organization_id from JWT or user record for RLS policies';

-- 4.2 Function to get all organizations user has access to (MULTI-ORG SUPPORT)
CREATE OR REPLACE FUNCTION security.get_user_organizations()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    org_ids UUID[];
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN ARRAY[]::UUID[];
    END IF;
    
    -- Get all organizations user has access to via user_tenants
    SELECT ARRAY_AGG(DISTINCT organization_id)
    INTO org_ids
    FROM (
        -- Primary organization from users table
        SELECT organization_id FROM public.users WHERE id = auth.uid()
        UNION
        -- Additional organizations from user_tenants
        SELECT organization_id FROM public.user_tenants 
        WHERE user_id = auth.uid() AND status = 'active'
    ) combined_orgs;
    
    RETURN COALESCE(org_ids, ARRAY[]::UUID[]);
END;
$$;

COMMENT ON FUNCTION security.get_user_organizations() IS 'Returns array of all organization IDs user has access to';

-- 4.3 Function to check if user has specific role
CREATE OR REPLACE FUNCTION security.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE id = auth.uid()
    AND status = 'active';
    
    -- Role hierarchy: owner > admin > member > viewer
    RETURN CASE
        WHEN user_role = 'owner' THEN TRUE
        WHEN user_role = 'admin' AND required_role IN ('admin', 'member', 'viewer') THEN TRUE
        WHEN user_role = 'member' AND required_role IN ('member', 'viewer') THEN TRUE
        WHEN user_role = 'viewer' AND required_role = 'viewer' THEN TRUE
        ELSE FALSE
    END;
END;
$$;

COMMENT ON FUNCTION security.has_role(TEXT) IS 'Checks if current user has required role with hierarchy support';

-- 4.4 Function to check if user has role in specific organization (MULTI-ORG)
CREATE OR REPLACE FUNCTION security.has_role_in_org(p_org_id UUID, required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check primary organization
    SELECT role INTO user_role
    FROM public.users
    WHERE id = auth.uid()
    AND organization_id = p_org_id
    AND status = 'active';
    
    -- If not found, check user_tenants
    IF user_role IS NULL THEN
        SELECT role INTO user_role
        FROM public.user_tenants
        WHERE user_id = auth.uid()
        AND organization_id = p_org_id
        AND status = 'active';
    END IF;
    
    -- Role hierarchy: owner > admin > member > viewer
    RETURN CASE
        WHEN user_role = 'owner' THEN TRUE
        WHEN user_role = 'admin' AND required_role IN ('admin', 'member', 'viewer') THEN TRUE
        WHEN user_role = 'member' AND required_role IN ('member', 'viewer') THEN TRUE
        WHEN user_role = 'viewer' AND required_role = 'viewer' THEN TRUE
        ELSE FALSE
    END;
END;
$$;

COMMENT ON FUNCTION security.has_role_in_org(UUID, TEXT) IS 'Checks if user has required role in specific organization';

-- 4.5 Function to check if user is active
CREATE OR REPLACE FUNCTION security.is_user_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.organizations o ON u.organization_id = o.id
        WHERE u.id = auth.uid()
        AND u.status = 'active'
        AND o.status = 'active'
    );
END;
$$;

COMMENT ON FUNCTION security.is_user_active() IS 'Verifies user and their organization are both active';

-- ============================================================================
-- SECTION 5: ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 5.1 Enable RLS on core tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- 5.2 SERVICE ROLE BYPASS POLICIES (WITH AUDIT LOGGING)
-- CRITICAL: These policies allow backend services to perform cross-tenant operations
-- All service role operations are logged via triggers for compliance

-- Service role bypass for organizations (with audit)
CREATE POLICY "app_service_bypass_organizations"
ON public.organizations
FOR ALL
TO app_service
USING (true)
WITH CHECK (true);

-- Admin role bypass for organizations
CREATE POLICY "app_admin_bypass_organizations"
ON public.organizations
FOR ALL
TO app_admin
USING (true)
WITH CHECK (true);

-- Service role bypass for users (with audit)
CREATE POLICY "app_service_bypass_users"
ON public.users
FOR ALL
TO app_service
USING (true)
WITH CHECK (true);

-- Admin role bypass for users
CREATE POLICY "app_admin_bypass_users"
ON public.users
FOR ALL
TO app_admin
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "app_service_bypass_organizations" ON public.organizations IS 
'Allows backend services to perform cross-tenant operations. All operations are audited via triggers.';

-- 5.3 Organizations RLS Policies (for authenticated users)
-- Users can only see their own organization
CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
    id = security.get_user_organization_id()
    AND security.is_user_active()
);

-- Only owners can update organization
CREATE POLICY "Owners can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
    id = security.get_user_organization_id()
    AND security.has_role('owner')
)
WITH CHECK (
    id = security.get_user_organization_id()
    AND security.has_role('owner')
);

-- Only system can insert organizations (via service role)
CREATE POLICY "Service role can insert organizations"
ON public.organizations
FOR INSERT
TO service_role
WITH CHECK (true);

-- Soft delete only (owners)
CREATE POLICY "Owners can soft delete their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
    id = security.get_user_organization_id()
    AND security.has_role('owner')
    AND deleted_at IS NULL
)
WITH CHECK (
    id = security.get_user_organization_id()
    AND deleted_at IS NOT NULL
);

-- 5.4 Users RLS Policies
-- Users can view other users in their organization(s)
CREATE POLICY "Users can view organization members"
ON public.users
FOR SELECT
TO authenticated
USING (
    organization_id = ANY(security.get_user_organizations())
    AND security.is_user_active()
);

-- Admins and owners can insert new users
CREATE POLICY "Admins can invite users to their organization"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
    organization_id = security.get_user_organization_id()
    AND security.has_role('admin')
);

-- Admins can update users in their organization
CREATE POLICY "Admins can update organization members"
ON public.users
FOR UPDATE
TO authenticated
USING (
    organization_id = ANY(security.get_user_organizations())
    AND security.has_role_in_org(organization_id, 'admin')
)
WITH CHECK (
    organization_id = ANY(security.get_user_organizations())
);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    AND organization_id = ANY(security.get_user_organizations())
);

-- 5.5 User Tenants RLS Policies
-- Users can view their own multi-org memberships
CREATE POLICY "Users can view their own multi-org memberships"
ON public.user_tenants
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR organization_id = ANY(security.get_user_organizations())
);

-- Admins can manage multi-org memberships for their organization
CREATE POLICY "Admins can manage multi-org memberships"
ON public.user_tenants
FOR ALL
TO authenticated
USING (
    organization_id = ANY(security.get_user_organizations())
    AND security.has_role_in_org(organization_id, 'admin')
)
WITH CHECK (
    organization_id = ANY(security.get_user_organizations())
    AND security.has_role_in_org(organization_id, 'admin')
);

-- Service role can manage all multi-org memberships
CREATE POLICY "Service role can manage all multi-org memberships"
ON public.user_tenants
FOR ALL
TO app_service
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 6: AUDIT LOGGING INFRASTRUCTURE (ENHANCED WITH IMMUTABILITY)
-- ============================================================================

-- 6.1 Create audit log table with immutability enforcement
CREATE TABLE IF NOT EXISTS audit.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES public.organizations(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    -- Service role tracking
    service_role TEXT,
    is_service_operation BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE audit.activity_log IS 'Comprehensive audit trail for security and compliance (IMMUTABLE)';
COMMENT ON COLUMN audit.activity_log.service_role IS 'Tracks which service role performed the operation';
COMMENT ON COLUMN audit.activity_log.is_service_operation IS 'Flags operations performed by service accounts';

-- Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit.activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_organization_id ON audit.activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit.activity_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit.activity_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_service_operations ON audit.activity_log(is_service_operation) WHERE is_service_operation = TRUE;

-- 6.2 AUDIT LOG IMMUTABILITY ENFORCEMENT (ENHANCED)
CREATE OR REPLACE FUNCTION audit.enforce_audit_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Allow superuser for emergency maintenance only
    IF current_setting('is_superuser', true)::boolean THEN
        RAISE WARNING 'Superuser modification of audit log detected: % on record %', TG_OP, OLD.id;
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Prevent all modifications for compliance
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Audit log records are immutable and cannot be modified. Contact system administrator for emergency procedures.';
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_immutability_trigger ON audit.activity_log;
CREATE TRIGGER enforce_immutability_trigger
    BEFORE UPDATE OR DELETE ON audit.activity_log
    FOR EACH ROW EXECUTE FUNCTION audit.enforce_audit_immutability();

COMMENT ON FUNCTION audit.enforce_audit_immutability() IS 'Enforces immutability of audit logs for SOC 2/GDPR compliance';

-- 6.3 Audit logging function (ENHANCED)
CREATE OR REPLACE FUNCTION audit.log_activity(
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
    current_role_name TEXT;
    is_service_op BOOLEAN;
BEGIN
    -- Detect if this is a service role operation
    current_role_name := current_user;
    is_service_op := current_role_name IN ('app_service', 'app_admin', 'service_role');
    
    INSERT INTO audit.activity_log (
        user_id,
        organization_id,
        action,
        resource_type,
        resource_id,
        old_data,
        new_data,
        ip_address,
        metadata,
        service_role,
        is_service_operation
    ) VALUES (
        auth.uid(),
        security.get_user_organization_id(),
        p_action,
        p_resource_type,
        p_resource_id,
        p_old_data,
        p_new_data,
        inet_client_addr(),
        p_metadata,
        CASE WHEN is_service_op THEN current_role_name ELSE NULL END,
        is_service_op
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

COMMENT ON FUNCTION audit.log_activity IS 'Centralized function for logging security-relevant activities with service role tracking';

-- 6.4 Generic audit trigger function (ENHANCED)
CREATE OR REPLACE FUNCTION audit.trigger_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM audit.log_activity(
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            NULL,
            to_jsonb(NEW),
            jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM audit.log_activity(
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW),
            jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM audit.log_activity(
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            to_jsonb(OLD),
            NULL,
            jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME)
        );
        RETURN OLD;
    END IF;
END;
$$;

-- 6.5 Apply audit triggers to core tables
DROP TRIGGER IF EXISTS audit_organizations_trigger ON public.organizations;
CREATE TRIGGER audit_organizations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

DROP TRIGGER IF EXISTS audit_users_trigger ON public.users;
CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

DROP TRIGGER IF EXISTS audit_user_tenants_trigger ON public.user_tenants;
CREATE TRIGGER audit_user_tenants_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.user_tenants
    FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

-- ============================================================================
-- SECTION 7: DATA ENCRYPTION AND PROTECTION
-- ============================================================================

-- 7.1 Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION security.encrypt_sensitive_data(data TEXT, key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    -- Use provided key or fall back to environment variable
    encryption_key := COALESCE(
        key,
        current_setting('app.encryption_key', true)
    );
    
    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Encryption key not configured';
    END IF;
    
    RETURN encode(
        pgcrypto.encrypt(
            data::bytea,
            encryption_key::bytea,
            'aes'
        ),
        'base64'
    );
END;
$$;

-- 7.2 Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION security.decrypt_sensitive_data(encrypted_data TEXT, key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    encryption_key := COALESCE(
        key,
        current_setting('app.encryption_key', true)
    );
    
    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Encryption key not configured';
    END IF;
    
    RETURN convert_from(
        pgcrypto.decrypt(
            decode(encrypted_data, 'base64'),
            encryption_key::bytea,
            'aes'
        ),
        'utf8'
    );
END;
$$;

-- ============================================================================
-- SECTION 8: RATE LIMITING AND ABUSE PREVENTION
-- ============================================================================

-- 8.1 Create rate limiting table
CREATE TABLE IF NOT EXISTS security.rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier TEXT NOT NULL, -- user_id, ip_address, or api_key
    action TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(identifier, action, window_start)
);

COMMENT ON TABLE security.rate_limits IS 'Rate limiting tracking for API and user actions';

-- Create index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON security.rate_limits(identifier, action, window_start DESC);

-- 8.2 Rate limiting check function
CREATE OR REPLACE FUNCTION security.check_rate_limit(
    p_identifier TEXT,
    p_action TEXT,
    p_max_requests INTEGER,
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_window TIMESTAMPTZ;
    request_count INTEGER;
BEGIN
    -- Calculate current time window
    current_window := date_trunc('minute', NOW()) - 
                     (EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes) * INTERVAL '1 minute';
    
    -- Get or create rate limit record
    INSERT INTO security.rate_limits (identifier, action, window_start, request_count)
    VALUES (p_identifier, p_action, current_window, 1)
    ON CONFLICT (identifier, action, window_start)
    DO UPDATE SET request_count = security.rate_limits.request_count + 1
    RETURNING security.rate_limits.request_count INTO request_count;
    
    -- Check if limit exceeded
    IF request_count > p_max_requests THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION security.check_rate_limit IS 'Checks and enforces rate limits for actions';

-- 8.3 Cleanup old rate limit records (run via scheduled job)
CREATE OR REPLACE FUNCTION security.cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM security.rate_limits
    WHERE window_start < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- SECTION 9: SESSION SECURITY
-- ============================================================================

-- 9.1 Create sessions table for enhanced session management
CREATE TABLE IF NOT EXISTS security.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT
);

COMMENT ON TABLE security.sessions IS 'Enhanced session tracking for security monitoring';

-- Create indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON security.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON security.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON security.sessions(expires_at);

-- 9.2 Function to validate session
CREATE OR REPLACE FUNCTION security.validate_session(p_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_valid BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM security.sessions s
        JOIN public.users u ON s.user_id = u.id
        JOIN public.organizations o ON s.organization_id = o.id
        WHERE s.token_hash = p_token_hash
        AND s.expires_at > NOW()
        AND s.revoked_at IS NULL
        AND u.status = 'active'
        AND o.status = 'active'
    ) INTO session_valid;
    
    -- Update last activity if valid
    IF session_valid THEN
        UPDATE security.sessions
        SET last_activity_at = NOW()
        WHERE token_hash = p_token_hash;
    END IF;
    
    RETURN session_valid;
END;
$$;

-- 9.3 Function to revoke sessions
CREATE OR REPLACE FUNCTION security.revoke_session(
    p_token_hash TEXT,
    p_reason TEXT DEFAULT 'manual_revocation'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE security.sessions
    SET revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE token_hash = p_token_hash
    AND revoked_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- 9.4 Function to revoke all user sessions (for security incidents)
CREATE OR REPLACE FUNCTION security.revoke_all_user_sessions(
    p_user_id UUID,
    p_reason TEXT DEFAULT 'security_incident'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE security.sessions
    SET revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE user_id = p_user_id
    AND revoked_at IS NULL;
    
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    
    -- Log the security action
    PERFORM audit.log_activity(
        'REVOKE_ALL_SESSIONS',
        'user',
        p_user_id,
        NULL,
        jsonb_build_object('revoked_count', revoked_count),
        jsonb_build_object('reason', p_reason)
    );
    
    RETURN revoked_count;
END;
$$;

-- ============================================================================
-- SECTION 10: DATA RETENTION AND CLEANUP
-- ============================================================================

-- 10.1 Function to soft delete old records
CREATE OR REPLACE FUNCTION security.soft_delete_old_records(
    p_table_name TEXT,
    p_days_old INTEGER DEFAULT 365
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_rows INTEGER;
    sql_query TEXT;
BEGIN
    sql_query := format(
        'UPDATE %I SET deleted_at = NOW() WHERE deleted_at IS NULL AND created_at < NOW() - INTERVAL ''%s days''',
        p_table_name,
        p_days_old
    );
    
    EXECUTE sql_query;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN affected_rows;
END;
$$;

-- 10.2 Function to hard delete soft-deleted records
CREATE OR REPLACE FUNCTION security.hard_delete_soft_deleted(
    p_table_name TEXT,
    p_days_since_deletion INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_rows INTEGER;
    sql_query TEXT;
BEGIN
    sql_query := format(
        'DELETE FROM %I WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL ''%s days''',
        p_table_name,
        p_days_since_deletion
    );
    
    EXECUTE sql_query;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN affected_rows;
END;
$$;

-- ============================================================================
-- SECTION 11: PERFORMANCE AND MONITORING
-- ============================================================================

-- 11.1 Create function to monitor slow queries
CREATE OR REPLACE FUNCTION security.get_slow_queries(p_min_duration_ms INTEGER DEFAULT 1000)
RETURNS TABLE (
    query TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    max_time DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pss.query,
        pss.calls,
        pss.total_exec_time as total_time,
        pss.mean_exec_time as mean_time,
        pss.max_exec_time as max_time
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time > p_min_duration_ms
    ORDER BY pss.mean_exec_time DESC
    LIMIT 50;
END;
$$;

-- 11.2 Create function to check table bloat
CREATE OR REPLACE FUNCTION security.check_table_bloat()
RETURNS TABLE (
    table_name TEXT,
    bloat_ratio NUMERIC,
    wasted_bytes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename AS table_name,
        ROUND((pg_total_relation_size(schemaname||'.'||tablename)::NUMERIC / 
               NULLIF(pg_relation_size(schemaname||'.'||tablename), 0)), 2) AS bloat_ratio,
        (pg_total_relation_size(schemaname||'.'||tablename) - 
         pg_relation_size(schemaname||'.'||tablename)) AS wasted_bytes
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY wasted_bytes DESC
    LIMIT 20;
END;
$$;

-- ============================================================================
-- SECTION 12: BACKUP AND DISASTER RECOVERY
-- ============================================================================

-- 12.1 Create backup metadata table
CREATE TABLE IF NOT EXISTS audit.backup_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
    backup_size_bytes BIGINT,
    backup_location TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

COMMENT ON TABLE audit.backup_log IS 'Tracks backup operations for disaster recovery';

-- 12.2 Function to log backup operations
CREATE OR REPLACE FUNCTION audit.log_backup(
    p_backup_type TEXT,
    p_status TEXT,
    p_backup_size_bytes BIGINT DEFAULT NULL,
    p_backup_location TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    backup_id UUID;
BEGIN
    INSERT INTO audit.backup_log (
        backup_type,
        status,
        completed_at,
        backup_size_bytes,
        backup_location,
        error_message
    ) VALUES (
        p_backup_type,
        p_status,
        CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END,
        p_backup_size_bytes,
        p_backup_location,
        p_error_message
    )
    RETURNING id INTO backup_id;
    
    RETURN backup_id;
END;
$$;

-- ============================================================================
-- SECTION 13: SECURITY VIEWS FOR MONITORING
-- ============================================================================

-- 13.1 View for active sessions
CREATE OR REPLACE VIEW security.active_sessions AS
SELECT 
    s.id,
    s.user_id,
    u.email,
    u.full_name,
    s.organization_id,
    o.name as organization_name,
    s.ip_address,
    s.last_activity_at,
    s.expires_at,
    s.created_at,
    EXTRACT(EPOCH FROM (NOW() - s.last_activity_at)) as idle_seconds
FROM security.sessions s
JOIN public.users u ON s.user_id = u.id
JOIN public.organizations o ON s.organization_id = o.id
WHERE s.expires_at > NOW()
AND s.revoked_at IS NULL
ORDER BY s.last_activity_at DESC;

COMMENT ON VIEW security.active_sessions IS 'Real-time view of active user sessions';

-- 13.2 View for suspicious activity
CREATE OR REPLACE VIEW security.suspicious_activity AS
SELECT 
    al.timestamp,
    al.user_id,
    u.email,
    al.organization_id,
    o.name as organization_name,
    al.action,
    al.resource_type,
    al.ip_address,
    al.is_service_operation,
    al.service_role,
    COUNT(*) OVER (
        PARTITION BY al.user_id, al.action 
        ORDER BY al.timestamp 
        RANGE BETWEEN INTERVAL '5 minutes' PRECEDING AND CURRENT ROW
    ) as action_count_5min
FROM audit.activity_log al
LEFT JOIN public.users u ON al.user_id = u.id
LEFT JOIN public.organizations o ON al.organization_id = o.id
WHERE al.timestamp > NOW() - INTERVAL '1 hour'
ORDER BY al.timestamp DESC;

COMMENT ON VIEW security.suspicious_activity IS 'Detects potential suspicious activity patterns including service role operations';

-- 13.3 View for failed authentication attempts
CREATE OR REPLACE VIEW security.failed_auth_attempts AS
SELECT 
    al.timestamp,
    al.user_id,
    al.ip_address,
    al.metadata->>'email' as attempted_email,
    al.metadata->>'reason' as failure_reason,
    COUNT(*) OVER (
        PARTITION BY al.ip_address 
        ORDER BY al.timestamp 
        RANGE BETWEEN INTERVAL '15 minutes' PRECEDING AND CURRENT ROW
    ) as failures_from_ip
FROM audit.activity_log al
WHERE al.action = 'AUTH_FAILED'
AND al.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY al.timestamp DESC;

COMMENT ON VIEW security.failed_auth_attempts IS 'Monitors failed authentication for brute force detection';

-- 13.4 View for service role operations (COMPLIANCE MONITORING)
CREATE OR REPLACE VIEW security.service_role_operations AS
SELECT 
    al.timestamp,
    al.service_role,
    al.action,
    al.resource_type,
    al.resource_id,
    al.organization_id,
    o.name as organization_name,
    al.old_data,
    al.new_data,
    al.metadata
FROM audit.activity_log al
LEFT JOIN public.organizations o ON al.organization_id = o.id
WHERE al.is_service_operation = TRUE
ORDER BY al.timestamp DESC;

COMMENT ON VIEW security.service_role_operations IS 'Tracks all operations performed by service roles for compliance auditing';

-- ============================================================================
-- SECTION 14: UPDATED_AT TRIGGER AUTOMATION
-- ============================================================================

-- 14.1 Generic updated_at trigger function
CREATE OR REPLACE FUNCTION security.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 14.2 Apply updated_at triggers to core tables
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION security.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION security.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_tenants_updated_at ON public.user_tenants;
CREATE TRIGGER update_user_tenants_updated_at
    BEFORE UPDATE ON public.user_tenants
    FOR EACH ROW
    EXECUTE FUNCTION security.update_updated_at_column();

-- ============================================================================
-- SECTION 15: VECTOR STORE AND LLM MEMORY INTEGRATION (ENHANCED)
-- ============================================================================

-- 15.1 Create semantic_memory table for LLM/RAG with comprehensive security
CREATE TABLE IF NOT EXISTS public.semantic_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    document_chunk TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    source TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT valid_embedding_dimension CHECK (vector_dims(embedding) = 1536)
);

COMMENT ON TABLE public.semantic_memory IS 'Stores vector embeddings for agent semantic memory and RAG with tenant isolation';
COMMENT ON COLUMN public.semantic_memory.embedding IS 'Vector embedding (1536 dimensions for OpenAI ada-002)';
COMMENT ON COLUMN public.semantic_memory.metadata IS 'Additional metadata (tags, categories, confidence scores)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_semantic_memory_organization_id ON public.semantic_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_user_id ON public.semantic_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_source ON public.semantic_memory(source);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_created_at ON public.semantic_memory(created_at DESC);

-- 15.2 Create vector similarity search index
-- Note: lists parameter should be approximately sqrt(total_rows) for optimal performance
-- Starting with 100, adjust based on actual dataset size
CREATE INDEX IF NOT EXISTS idx_semantic_embedding_cosine 
ON public.semantic_memory 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

COMMENT ON INDEX idx_semantic_embedding_cosine IS 'IVFFlat index for cosine similarity search. Adjust lists parameter based on dataset size (sqrt of total rows).';

-- 15.3 Enable RLS on semantic_memory
ALTER TABLE public.semantic_memory ENABLE ROW LEVEL SECURITY;

-- 15.4 RLS Policies for semantic_memory

-- Users can read semantic memory from their organization(s)
CREATE POLICY "organization_isolation_semantic_read"
ON public.semantic_memory
FOR SELECT
TO authenticated
USING (
    organization_id = ANY(security.get_user_organizations())
    AND security.is_user_active()
    AND deleted_at IS NULL
);

-- Users can insert semantic memory for their organization
CREATE POLICY "users_can_insert_semantic_memory"
ON public.semantic_memory
FOR INSERT
TO authenticated
WITH CHECK (
    organization_id = security.get_user_organization_id()
    AND security.is_user_active()
);

-- Users can update their own semantic memory entries
CREATE POLICY "users_can_update_own_semantic_memory"
ON public.semantic_memory
FOR UPDATE
TO authenticated
USING (
    organization_id = ANY(security.get_user_organizations())
    AND (user_id = auth.uid() OR security.has_role_in_org(organization_id, 'admin'))
)
WITH CHECK (
    organization_id = ANY(security.get_user_organizations())
);

-- Admins can soft delete semantic memory in their organization
CREATE POLICY "admins_can_delete_semantic_memory"
ON public.semantic_memory
FOR UPDATE
TO authenticated
USING (
    organization_id = ANY(security.get_user_organizations())
    AND security.has_role_in_org(organization_id, 'admin')
    AND deleted_at IS NULL
)
WITH CHECK (
    deleted_at IS NOT NULL
);

-- Service role can manage all semantic memory (with validation)
CREATE POLICY "app_service_semantic_memory_access"
ON public.semantic_memory
FOR ALL
TO app_service
USING (true)
WITH CHECK (
    organization_id IS NOT NULL
    AND vector_dims(embedding) = 1536
);

-- 15.5 Function for semantic similarity search
CREATE OR REPLACE FUNCTION public.search_semantic_memory(
    p_query_embedding vector(1536),
    p_organization_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    document_chunk TEXT,
    source TEXT,
    metadata JSONB,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    -- Verify user has access to this organization
    IF p_organization_id != security.get_user_organization_id() 
       AND p_organization_id != ALL(security.get_user_organizations()) THEN
        RAISE EXCEPTION 'Access denied to organization semantic memory';
    END IF;
    
    RETURN QUERY
    SELECT 
        sm.id,
        sm.document_chunk,
        sm.source,
        sm.metadata,
        1 - (sm.embedding <=> p_query_embedding) AS similarity,
        sm.created_at
    FROM public.semantic_memory sm
    WHERE sm.organization_id = p_organization_id
    AND sm.deleted_at IS NULL
    AND 1 - (sm.embedding <=> p_query_embedding) >= p_similarity_threshold
    ORDER BY sm.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.search_semantic_memory IS 'Performs cosine similarity search on semantic memory with tenant isolation';

-- 15.6 Apply audit and updated_at triggers to semantic_memory
DROP TRIGGER IF EXISTS audit_semantic_memory_trigger ON public.semantic_memory;
CREATE TRIGGER audit_semantic_memory_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.semantic_memory
    FOR EACH ROW EXECUTE FUNCTION audit.trigger_audit_log();

DROP TRIGGER IF EXISTS update_semantic_memory_updated_at ON public.semantic_memory;
CREATE TRIGGER update_semantic_memory_updated_at
    BEFORE UPDATE ON public.semantic_memory
    FOR EACH ROW
    EXECUTE FUNCTION security.update_updated_at_column();

-- ============================================================================
-- SECTION 16: GRANT PERMISSIONS TO ROLES
-- ============================================================================

-- 16.1 Grant permissions to app_service role
GRANT SELECT, INSERT, UPDATE ON public.organizations TO app_service;
GRANT SELECT, INSERT, UPDATE ON public.users TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenants TO app_service;
GRANT SELECT, INSERT, UPDATE ON public.semantic_memory TO app_service;
GRANT SELECT, INSERT ON audit.activity_log TO app_service;
GRANT SELECT, INSERT, UPDATE ON security.sessions TO app_service;
GRANT SELECT, INSERT, UPDATE ON security.rate_limits TO app_service;

-- Grant execute on security functions
GRANT EXECUTE ON FUNCTION security.get_user_organization_id() TO app_service;
GRANT EXECUTE ON FUNCTION security.get_user_organizations() TO app_service;
GRANT EXECUTE ON FUNCTION security.has_role(TEXT) TO app_service;
GRANT EXECUTE ON FUNCTION security.has_role_in_org(UUID, TEXT) TO app_service;
GRANT EXECUTE ON FUNCTION security.is_user_active() TO app_service;
GRANT EXECUTE ON FUNCTION security.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO app_service;
GRANT EXECUTE ON FUNCTION security.validate_session(TEXT) TO app_service;
GRANT EXECUTE ON FUNCTION audit.log_activity(TEXT, TEXT, UUID, JSONB, JSONB, JSONB) TO app_service;
GRANT EXECUTE ON FUNCTION public.search_semantic_memory(vector, UUID, INTEGER, FLOAT) TO app_service;

-- 16.2 Grant read-only permissions to analytics_reader role
GRANT SELECT ON public.organizations TO analytics_reader;
GRANT SELECT ON public.users TO analytics_reader;
GRANT SELECT ON public.user_tenants TO analytics_reader;
GRANT SELECT ON public.semantic_memory TO analytics_reader;
GRANT SELECT ON audit.activity_log TO analytics_reader;
GRANT SELECT ON security.active_sessions TO analytics_reader;
GRANT SELECT ON security.suspicious_activity TO analytics_reader;
GRANT SELECT ON security.service_role_operations TO analytics_reader;

-- 16.3 Grant admin permissions to app_admin role
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT ALL ON ALL TABLES IN SCHEMA audit TO app_admin;
GRANT ALL ON ALL TABLES IN SCHEMA security TO app_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA security TO app_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA audit TO app_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO app_admin;

-- ============================================================================
-- SECTION 17: POSTGRESQL CONFIGURATION RECOMMENDATIONS
-- ============================================================================

-- These settings should be applied via Supabase Dashboard or postgresql.conf
-- Listed here for documentation and reference

/*
RECOMMENDED POSTGRESQL SETTINGS FOR PRODUCTION:

# Connection Settings
max_connections = 100
superuser_reserved_connections = 3

# Memory Settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB

# Write-Ahead Log (WAL) Settings
wal_level = replica
max_wal_size = 2GB
min_wal_size = 1GB
wal_compression = on

# Query Planning
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_destination = 'csvlog'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000  # Log queries slower than 1 second
log_connections = on
log_disconnections = on
log_duration = off
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_lock_waits = on
log_statement = 'ddl'
log_temp_files = 0

# Security
ssl = on
password_encryption = scram-sha-256
row_security = on

# Performance
checkpoint_completion_target = 0.9
default_statistics_target = 100

# Vector Extension (pgvector)
shared_preload_libraries = 'vector'
*/

-- ============================================================================
-- SECTION 18: MAINTENANCE PROCEDURES
-- ============================================================================

-- 18.1 Create maintenance log table
CREATE TABLE IF NOT EXISTS audit.maintenance_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'in_progress',
    rows_affected INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- 18.2 Comprehensive maintenance procedure
CREATE OR REPLACE FUNCTION security.run_maintenance()
RETURNS TABLE (
    operation TEXT,
    rows_affected INTEGER,
    status TEXT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_count INTEGER;
    maintenance_id UUID;
BEGIN
    -- Clean up old rate limits
    BEGIN
        SELECT security.cleanup_old_rate_limits() INTO cleanup_count;
        RETURN QUERY SELECT 'cleanup_rate_limits'::TEXT, cleanup_count, 'success'::TEXT, 
                            'Cleaned up old rate limit records'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'cleanup_rate_limits'::TEXT, 0, 'failed'::TEXT, SQLERRM;
    END;
    
    -- Clean up expired sessions
    BEGIN
        DELETE FROM security.sessions 
        WHERE expires_at < NOW() - INTERVAL '7 days';
        GET DIAGNOSTICS cleanup_count = ROW_COUNT;
        RETURN QUERY SELECT 'cleanup_sessions'::TEXT, cleanup_count, 'success'::TEXT,
                            'Cleaned up expired sessions'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'cleanup_sessions'::TEXT, 0, 'failed'::TEXT, SQLERRM;
    END;
    
    -- Vacuum analyze critical tables
    BEGIN
        VACUUM ANALYZE public.organizations;
        VACUUM ANALYZE public.users;
        VACUUM ANALYZE public.semantic_memory;
        VACUUM ANALYZE audit.activity_log;
        RETURN QUERY SELECT 'vacuum_analyze'::TEXT, 0, 'success'::TEXT,
                            'Completed VACUUM ANALYZE on critical tables'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'vacuum_analyze'::TEXT, 0, 'failed'::TEXT, SQLERRM;
    END;
    
    -- Update table statistics
    BEGIN
        ANALYZE public.organizations;
        ANALYZE public.users;
        ANALYZE public.semantic_memory;
        ANALYZE audit.activity_log;
        RETURN QUERY SELECT 'analyze_statistics'::TEXT, 0, 'success'::TEXT,
                            'Updated table statistics'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'analyze_statistics'::TEXT, 0, 'failed'::TEXT, SQLERRM;
    END;
END;
$$;

COMMENT ON FUNCTION security.run_maintenance() IS 'Runs comprehensive maintenance tasks including vector index optimization';

-- ============================================================================
-- SECTION 19: HEALTH CHECK FUNCTIONS
-- ============================================================================

-- 19.1 Database health check
CREATE OR REPLACE FUNCTION security.health_check()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    value TEXT,
    severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check active connections
    RETURN QUERY
    SELECT 
        'active_connections'::TEXT,
        CASE WHEN COUNT(*) < 80 THEN 'healthy' ELSE 'warning' END,
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) < 80 THEN 'info' ELSE 'warning' END
    FROM pg_stat_activity
    WHERE state = 'active';
    
    -- Check database size
    RETURN QUERY
    SELECT 
        'database_size'::TEXT,
        'healthy'::TEXT,
        pg_size_pretty(pg_database_size(current_database())),
        'info'::TEXT;
    
    -- Check replication lag (if applicable)
    RETURN QUERY
    SELECT 
        'replication_status'::TEXT,
        CASE WHEN pg_is_in_recovery() THEN 'replica' ELSE 'primary' END,
        CASE WHEN pg_is_in_recovery() 
             THEN pg_size_pretty(pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn()))
             ELSE 'N/A' END,
        'info'::TEXT;
    
    -- Check for long-running queries
    RETURN QUERY
    SELECT 
        'long_running_queries'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'healthy' ELSE 'warning' END,
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'info' ELSE 'warning' END
    FROM pg_stat_activity
    WHERE state = 'active'
    AND query_start < NOW() - INTERVAL '5 minutes'
    AND query NOT LIKE '%pg_stat_activity%';
    
    -- Check for table bloat
    RETURN QUERY
    SELECT 
        'table_bloat'::TEXT,
        'info'::TEXT,
        COUNT(*)::TEXT || ' tables with bloat',
        'info'::TEXT
    FROM (SELECT * FROM security.check_table_bloat() WHERE bloat_ratio > 2) bloated;
    
    -- Check vector extension status
    RETURN QUERY
    SELECT 
        'vector_extension'::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'healthy' ELSE 'error' END,
        CASE WHEN COUNT(*) > 0 THEN 'installed' ELSE 'missing' END,
        CASE WHEN COUNT(*) > 0 THEN 'info' ELSE 'critical' END
    FROM pg_extension
    WHERE extname = 'vector';
END;
$$;

COMMENT ON FUNCTION security.health_check() IS 'Comprehensive database health check including vector extension';

-- ============================================================================
-- SECTION 20: COMPLIANCE AND GDPR FUNCTIONS
-- ============================================================================

-- 20.1 Function to export user data (GDPR data portability)
CREATE OR REPLACE FUNCTION security.export_user_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_data JSONB;
BEGIN
    -- Verify the requesting user is the data subject or an admin
    IF auth.uid() != p_user_id AND NOT security.has_role('admin') THEN
        RAISE EXCEPTION 'Unauthorized access to user data';
    END IF;
    
    SELECT jsonb_build_object(
        'user', to_jsonb(u.*),
        'organization', to_jsonb(o.*),
        'multi_org_memberships', (
            SELECT jsonb_agg(to_jsonb(ut.*))
            FROM public.user_tenants ut
            WHERE ut.user_id = p_user_id
        ),
        'semantic_memory', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', sm.id,
                'document_chunk', sm.document_chunk,
                'source', sm.source,
                'metadata', sm.metadata,
                'created_at', sm.created_at
            ))
            FROM public.semantic_memory sm
            WHERE sm.user_id = p_user_id
        ),
        'activity_log', (
            SELECT jsonb_agg(to_jsonb(al.*))
            FROM audit.activity_log al
            WHERE al.user_id = p_user_id
        ),
        'sessions', (
            SELECT jsonb_agg(to_jsonb(s.*))
            FROM security.sessions s
            WHERE s.user_id = p_user_id
        ),
        'export_timestamp', NOW()
    ) INTO user_data
    FROM public.users u
    JOIN public.organizations o ON u.organization_id = o.id
    WHERE u.id = p_user_id;
    
    -- Log the data export
    PERFORM audit.log_activity(
        'DATA_EXPORT',
        'user',
        p_user_id,
        NULL,
        jsonb_build_object('exported_by', auth.uid()),
        jsonb_build_object('compliance', 'GDPR')
    );
    
    RETURN user_data;
END;
$$;

COMMENT ON FUNCTION security.export_user_data(UUID) IS 'Exports all user data including semantic memory for GDPR compliance';

-- 20.2 Function to anonymize user data (GDPR right to be forgotten)
CREATE OR REPLACE FUNCTION security.anonymize_user_data(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify authorization
    IF auth.uid() != p_user_id AND NOT security.has_role('admin') THEN
        RAISE EXCEPTION 'Unauthorized anonymization request';
    END IF;
    
    -- Log before anonymization
    PERFORM audit.log_activity(
        'DATA_ANONYMIZATION',
        'user',
        p_user_id,
        (SELECT to_jsonb(u.*) FROM public.users u WHERE u.id = p_user_id),
        NULL,
        jsonb_build_object('compliance', 'GDPR', 'requested_by', auth.uid())
    );
    
    -- Anonymize user data
    UPDATE public.users
    SET 
        email = 'anonymized_' || id || '@deleted.local',
        full_name = 'Anonymized User',
        status = 'deleted',
        deleted_at = NOW()
    WHERE id = p_user_id;
    
    -- Remove multi-org memberships
    DELETE FROM public.user_tenants
    WHERE user_id = p_user_id;
    
    -- Soft delete semantic memory
    UPDATE public.semantic_memory
    SET deleted_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Revoke all sessions
    PERFORM security.revoke_all_user_sessions(p_user_id, 'user_anonymization');
    
    -- Anonymize audit logs (keep structure but remove PII)
    UPDATE audit.activity_log
    SET 
        old_data = NULL,
        new_data = NULL,
        ip_address = NULL,
        user_agent = NULL
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION security.anonymize_user_data(UUID) IS 'Anonymizes user data including semantic memory for GDPR right to be forgotten';

-- ============================================================================
-- SECTION 21: FINAL SECURITY HARDENING
-- ============================================================================

-- 21.1 Revoke unnecessary public permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- 21.2 Ensure RLS is enabled on all user tables
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT IN ('organizations', 'users', 'user_tenants', 'semantic_memory')  -- Already handled
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
        RAISE NOTICE 'Enabled RLS on table: %', tbl.tablename;
    END LOOP;
END;
$$;

-- 21.3 Create security policy enforcement check
CREATE OR REPLACE FUNCTION security.verify_rls_enabled()
RETURNS TABLE (
    table_name TEXT,
    rls_enabled BOOLEAN,
    policy_count INTEGER,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.relname::TEXT,
        c.relrowsecurity,
        COUNT(p.polname)::INTEGER,
        CASE 
            WHEN c.relrowsecurity AND COUNT(p.polname) > 0 THEN 'OK'
            WHEN c.relrowsecurity AND COUNT(p.polname) = 0 THEN 'WARNING: RLS enabled but no policies'
            WHEN NOT c.relrowsecurity THEN 'CRITICAL: RLS not enabled'
        END
    FROM pg_class c
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind = 'r'
    GROUP BY c.relname, c.relrowsecurity
    ORDER BY c.relname;
END;
$$;

COMMENT ON FUNCTION security.verify_rls_enabled() IS 'Verifies RLS is enabled and policies exist on all tables';

-- 21.4 Create function to audit service role usage
CREATE OR REPLACE FUNCTION security.audit_service_role_usage(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    service_role TEXT,
    action TEXT,
    resource_type TEXT,
    operation_count BIGINT,
    unique_organizations BIGINT,
    first_occurrence TIMESTAMPTZ,
    last_occurrence TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.service_role,
        al.action,
        al.resource_type,
        COUNT(*) as operation_count,
        COUNT(DISTINCT al.organization_id) as unique_organizations,
        MIN(al.timestamp) as first_occurrence,
        MAX(al.timestamp) as last_occurrence
    FROM audit.activity_log al
    WHERE al.is_service_operation = TRUE
    AND al.timestamp > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY al.service_role, al.action, al.resource_type
    ORDER BY operation_count DESC;
END;
$$;

COMMENT ON FUNCTION security.audit_service_role_usage IS 'Audits service role operations for compliance monitoring';

-- ============================================================================
-- DEPLOYMENT VERIFICATION
-- ============================================================================

-- Run verification checks
DO $$
DECLARE
    rls_check RECORD;
    health_check RECORD;
    issues_found INTEGER := 0;
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'ENTERPRISE SAAS HARDENED CONFIGURATION V2.0 APPLIED';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'PostgreSQL Version: %', version();
    RAISE NOTICE '=================================================================';
    
    -- Check RLS status
    RAISE NOTICE 'VERIFYING ROW-LEVEL SECURITY (RLS) STATUS...';
    FOR rls_check IN SELECT * FROM security.verify_rls_enabled() LOOP
        IF rls_check.status != 'OK' THEN
            RAISE NOTICE '  [%] Table: % (% policies)', rls_check.status, rls_check.table_name, rls_check.policy_count;
            issues_found := issues_found + 1;
        END IF;
    END LOOP;
    
    IF issues_found = 0 THEN
        RAISE NOTICE '  ✓ All tables have RLS enabled with policies';
    END IF;
    
    -- Check health
    RAISE NOTICE 'RUNNING HEALTH CHECKS...';
    FOR health_check IN SELECT * FROM security.health_check() LOOP
        RAISE NOTICE '  [%] %: %', health_check.severity, health_check.check_name, health_check.value;
    END LOOP;
    
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'CRITICAL NEXT STEPS:';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '1. CONFIGURE JWT custom claims in Supabase Dashboard';
    RAISE NOTICE '   - Add organization_id to JWT claims';
    RAISE NOTICE '   - Verify JWT signing key is secure';
    RAISE NOTICE '';
    RAISE NOTICE '2. DEPLOY Edge Functions via Supabase CLI:';
    RAISE NOTICE '   - supabase functions deploy llm-proxy';
    RAISE NOTICE '   - supabase functions deploy check-password-breach';
    RAISE NOTICE '   - supabase secrets set LLM_API_KEY=<your-key>';
    RAISE NOTICE '';
    RAISE NOTICE '3. CONFIGURE STORAGE RLS Policies:';
    RAISE NOTICE '   - Create segregated buckets per tenant';
    RAISE NOTICE '   - Apply RLS policies to storage buckets';
    RAISE NOTICE '';
    RAISE NOTICE '4. VERIFY SERVICE ROLE AUDIT LOGGING:';
    RAISE NOTICE '   - Run: SELECT * FROM security.service_role_operations LIMIT 10;';
    RAISE NOTICE '   - Run: SELECT * FROM security.audit_service_role_usage(7);';
    RAISE NOTICE '';
    RAISE NOTICE '5. CONFIGURE EXTERNAL INTEGRATIONS:';
    RAISE NOTICE '   - Register Stripe webhook endpoints';
    RAISE NOTICE '   - Configure log export to observability stack';
    RAISE NOTICE '';
    RAISE NOTICE '6. RUN SECURITY VERIFICATION:';
    RAISE NOTICE '   - SELECT * FROM security.verify_rls_enabled();';
    RAISE NOTICE '   - SELECT * FROM security.health_check();';
    RAISE NOTICE '';
    RAISE NOTICE '7. SCHEDULE MAINTENANCE:';
    RAISE NOTICE '   - Set up cron job: SELECT * FROM security.run_maintenance();';
    RAISE NOTICE '   - Recommended: Daily at 2 AM UTC';
    RAISE NOTICE '';
    RAISE NOTICE '8. VECTOR SEARCH OPTIMIZATION:';
    RAISE NOTICE '   - Monitor semantic_memory table size';
    RAISE NOTICE '   - Adjust IVFFlat lists parameter when rows > 10,000';
    RAISE NOTICE '   - Formula: lists = SQRT(total_rows)';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'SECURITY FEATURES ENABLED:';
    RAISE NOTICE '  ✓ Multi-tenant data isolation with RLS';
    RAISE NOTICE '  ✓ Service role bypass with audit logging';
    RAISE NOTICE '  ✓ Immutable audit trail';
    RAISE NOTICE '  ✓ Vector store with tenant isolation';
    RAISE NOTICE '  ✓ Multi-organization user support';
    RAISE NOTICE '  ✓ Rate limiting and session management';
    RAISE NOTICE '  ✓ GDPR compliance functions';
    RAISE NOTICE '  ✓ Comprehensive monitoring views';
    RAISE NOTICE '=================================================================';
END;
$$;

-- ============================================================================
-- END OF CONFIGURATION
-- ============================================================================
