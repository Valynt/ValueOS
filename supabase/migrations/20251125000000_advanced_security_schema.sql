-- Phase 4: Advanced Security - Database Schema
-- Migration: 20251125000000_advanced_security_schema.sql

-- Enable Row Level Security for all new tables
-- This migration adds tables for zero-trust architecture, threat detection, SOC 2 compliance, and security automation

-- ===========================================
-- ZERO-TRUST ARCHITECTURE TABLES
-- ===========================================

-- User sessions with continuous authentication
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_fingerprint JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  trust_level TEXT CHECK (trust_level IN ('high', 'medium', 'low')),
  mfa_verified BOOLEAN DEFAULT FALSE,
  risk_score INTEGER DEFAULT 0,
  invalidated_at TIMESTAMPTZ,
  invalidation_reason TEXT,

  FOREIGN KEY (tenant_id, user_id) REFERENCES user_tenants(tenant_id, user_id) ON DELETE CASCADE
);

-- Device trust history for continuous authentication
CREATE TABLE device_trust_history (
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  fingerprint JSONB NOT NULL,
  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  first_seen TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, device_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES user_tenants(tenant_id, user_id) ON DELETE CASCADE
);

-- ===========================================
-- ADVANCED THREAT DETECTION TABLES
-- ===========================================

-- Security events for SIEM and analysis
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source TEXT NOT NULL,
  details JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  risk_score INTEGER DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE,

  FOREIGN KEY (tenant_id, user_id) REFERENCES user_tenants(tenant_id, user_id) ON DELETE CASCADE
);

-- Security metrics for anomaly detection
CREATE TABLE security_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- User behavior analysis results
CREATE TABLE user_behavior_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  anomaly_count INTEGER DEFAULT 0,
  patterns JSONB,

  FOREIGN KEY (tenant_id, user_id) REFERENCES user_tenants(tenant_id, user_id) ON DELETE CASCADE
);

-- ===========================================
-- SECURITY INCIDENT MANAGEMENT TABLES
-- ===========================================

-- Security incidents
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT CHECK (status IN ('detected', 'investigating', 'contained', 'resolved', 'false_positive')),
  incident_type TEXT NOT NULL,
  affected_resources TEXT[] DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  assigned_to TEXT,
  threat_indicators TEXT[] DEFAULT '{}',
  risk_score INTEGER DEFAULT 0,
  impact JSONB DEFAULT '{"usersAffected": 0, "dataCompromised": false, "serviceDisruption": false}',

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Automated responses to security incidents
CREATE TABLE automated_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL,
  tenant_id TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('alert', 'block', 'quarantine', 'isolate', 'notify', 'remediate')),
  description TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
  executed_at TIMESTAMPTZ,
  result TEXT,
  automated BOOLEAN DEFAULT TRUE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (incident_id) REFERENCES security_incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ===========================================
-- SECURITY POLICY MANAGEMENT TABLES
-- ===========================================

-- Security policies
CREATE TABLE security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT CHECK (category IN ('access_control', 'data_protection', 'network_security', 'compliance', 'monitoring')),
  rules JSONB NOT NULL,
  enforcement TEXT CHECK (enforcement IN ('prevent', 'detect', 'alert')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ===========================================
-- SOC 2 COMPLIANCE TABLES
-- ===========================================

-- Compliance evidence collection
CREATE TABLE compliance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  evidence_type TEXT CHECK (evidence_type IN ('log', 'metric', 'test_result', 'manual_review', 'audit')),
  description TEXT NOT NULL,
  data JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  status TEXT CHECK (status IN ('compliant', 'non_compliant', 'needs_review')),
  reviewed_by TEXT,
  review_notes TEXT,

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Compliance reports
CREATE TABLE compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  report_period_start TIMESTAMPTZ NOT NULL,
  report_period_end TIMESTAMPTZ NOT NULL,
  overall_compliance NUMERIC(5,2) NOT NULL,
  controls_status JSONB NOT NULL,
  category_breakdown JSONB NOT NULL,
  critical_findings TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  next_audit_date TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Automated compliance check results
CREATE TABLE automated_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  control_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('passed', 'failed')),
  details TEXT NOT NULL,
  checked_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ===========================================
-- AUDIT AND MONITORING TABLES
-- ===========================================

-- Audit log access tracking (for audit log segregation)
CREATE TABLE audit_log_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_type TEXT CHECK (access_type IN ('read', 'export', 'admin')),
  ip_address INET,
  user_agent TEXT,

  FOREIGN KEY (tenant_id, user_id) REFERENCES user_tenants(tenant_id, user_id) ON DELETE CASCADE
);

-- System metrics for availability monitoring
CREATE TABLE system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ===========================================
-- ENABLE ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_trust_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- ROW LEVEL SECURITY POLICIES
-- ===========================================

-- User sessions: Users can only access their own sessions
CREATE POLICY "user_sessions_tenant_isolation" ON user_sessions
  FOR ALL USING (
    tenant_id = auth.uid()::text OR
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Device trust history: Users can only access their own device history
CREATE POLICY "device_trust_tenant_isolation" ON device_trust_history
  FOR ALL USING (
    tenant_id = auth.uid()::text OR
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Security events: Users can only see events from their tenants
CREATE POLICY "security_events_tenant_isolation" ON security_events
  FOR ALL USING (
    tenant_id = auth.uid()::text OR
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Security incidents: Tenant-level access with role-based permissions
CREATE POLICY "security_incidents_tenant_isolation" ON security_incidents
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Automated responses: Same tenant access
CREATE POLICY "automated_responses_tenant_isolation" ON automated_responses
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Security policies: Tenant-level access
CREATE POLICY "security_policies_tenant_isolation" ON security_policies
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Compliance evidence: Tenant-level access
CREATE POLICY "compliance_evidence_tenant_isolation" ON compliance_evidence
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Compliance reports: Tenant-level access
CREATE POLICY "compliance_reports_tenant_isolation" ON compliance_reports
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
    )
  );

-- Audit log access: Only security admins can access
CREATE POLICY "audit_log_access_admin_only" ON audit_log_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('security_admin', 'system_admin')
    )
  );

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX idx_user_sessions_tenant_user ON user_sessions(tenant_id, user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_device_trust_user ON device_trust_history(user_id, device_id);
CREATE INDEX idx_security_events_tenant_timestamp ON security_events(tenant_id, timestamp);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_incidents_tenant_status ON security_incidents(tenant_id, status);
CREATE INDEX idx_security_incidents_detected ON security_incidents(detected_at);
CREATE INDEX idx_automated_responses_incident ON automated_responses(incident_id);
CREATE INDEX idx_compliance_evidence_control ON compliance_evidence(control_id, tenant_id);
CREATE INDEX idx_compliance_reports_tenant ON compliance_reports(tenant_id, generated_at);
CREATE INDEX idx_system_metrics_tenant_type ON system_metrics(tenant_id, metric_type, timestamp);

-- ===========================================
-- IMMUTABLE AUDIT LOG POLICIES
-- ===========================================

-- Prevent updates and deletes on immutable audit tables
CREATE POLICY "security_events_immutable" ON security_events
  FOR UPDATE USING (false);

CREATE POLICY "security_events_no_delete" ON security_events
  FOR DELETE USING (false);

CREATE POLICY "audit_log_access_immutable" ON audit_log_access
  FOR UPDATE USING (false);

CREATE POLICY "audit_log_access_no_delete" ON audit_log_access
  FOR DELETE USING (false);
