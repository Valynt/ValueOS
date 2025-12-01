# RLS Policy Refinements - Complete Guide

**Database:** PostgreSQL with Supabase  
**Current Status:** 40+ tables with RLS enabled  
**Last Audit:** December 1, 2025

---

## 🎯 Executive Summary

### **Current State**
- ✅ 40+ tables have RLS enabled
- ✅ Basic user isolation in place
- ⚠️  Some policies need hardening
- ⚠️  Performance optimization needed
- ⚠️  Testing infrastructure missing

### **Refinement Goals**
1. **Harden security** - Close potential bypasses
2. **Optimize performance** - Reduce query overhead
3. **Improve maintainability** - Consolidate patterns
4. **Add testing** - Automated RLS verification
5. **Document patterns** - Standardize future policies

---

## 📊 Current RLS Coverage Analysis

### **Tables with RLS Enabled (40+)**

**Agent Fabric (18 tables):**
- `agents`, `agent_tools`, `agent_ontologies`
- `agent_sessions`, `agent_memory`, `message_bus`
- `workflows`, `workflow_executions`, `task_queue`
- `agent_audit_log`, `agent_metrics`, `policy_rules`
- `value_cases`, `company_profiles`, `value_maps`
- `kpi_hypotheses`, `financial_models`, `assumptions`

**Application Layer (3 tables):**
- `cases`, `workflows`, `messages`

**Monitoring & Observability (4 tables):**
- `llm_usage`, `cost_alerts`
- `rate_limit_violations`, `backup_logs`

**VOS Value Fabric (14 tables):**
- `business_objectives`, `capabilities`, `use_cases`
- `value_trees`, `value_tree_nodes`, `value_tree_links`
- `roi_models`, `roi_model_calculations`
- `benchmarks`, `value_commits`, `kpi_targets`
- `telemetry_events`, `realization_reports`, `realization_results`

**Governance & Audit (5+ tables):**
- `sof_governance_controls`, `sof_audit_events`
- `approval_requests`, `approvals`, `approver_roles`
- `secret_audit_logs`

---

## 🔒 Security Issues Identified

### **Critical (Fix Immediately)**

#### **Issue 1: Overly Permissive Feature Flags**
**Location:** `20241123130000_add_feature_flags.sql`

**Current:**
```sql
CREATE POLICY "Feature flags are insertable by authenticated users"
  ON feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- ❌ ANY authenticated user can insert!
```

**Risk:** Any authenticated user can create feature flags

**Fix:**
```sql
-- Only admins can manage feature flags
CREATE POLICY "Admins can manage feature flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Users can only read feature flags
CREATE POLICY "Users can read feature flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);
```

---

#### **Issue 2: Weak JWT Role Checking**
**Location:** Multiple files

**Current:**
```sql
-- Uses string comparison on JWT claim
USING (auth.jwt() ->> 'role' = 'admin')
```

**Risk:** 
- JWT manipulation possible
- No validation that 'admin' role is legitimate
- Relies on client-provided data

**Fix:**
```sql
-- Create admin verification function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin' OR
        raw_user_meta_data->>'role' = 'service_role'
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use in policies
CREATE POLICY "Admins can manage cost alerts"
  ON cost_alerts FOR ALL
  USING (is_admin());
```

---

#### **Issue 3: Missing Service Role Bypass**
**Location:** Most tables

**Current:**
```sql
-- Only user-level access
USING (auth.uid() = user_id)
```

**Risk:** Service role (backend) cannot access data even for legitimate operations

**Fix:**
```sql
-- Allow service role bypass for all operations
CREATE POLICY "Service role full access"
  ON table_name FOR ALL
  TO service_role
  USING (true);

-- User-level policy
CREATE POLICY "Users can manage own data"
  ON table_name FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

### **High (Fix Soon)**

#### **Issue 4: Performance - Nested Subqueries**
**Location:** `20241129000002_phase1_rls_policies.sql`

**Current:**
```sql
CREATE POLICY "Users can view own workflows"
  ON workflows FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = workflows.case_id 
        AND cases.user_id = auth.uid()
    )
  );
```

**Issue:** Nested EXISTS can be slow on large tables

**Fix:**
```sql
-- Create materialized view for user ownership
CREATE MATERIALIZED VIEW user_workflow_access AS
SELECT 
  w.id AS workflow_id,
  COALESCE(w.user_id, c.user_id) AS user_id
FROM workflows w
LEFT JOIN cases c ON c.id = w.case_id;

CREATE UNIQUE INDEX ON user_workflow_access(workflow_id, user_id);

-- Simpler policy using materialized view
CREATE POLICY "Users can view accessible workflows"
  ON workflows FOR SELECT
  USING (
    id IN (
      SELECT workflow_id FROM user_workflow_access 
      WHERE user_id = auth.uid()
    )
  );

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_workflow_access()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_workflow_access;
END;
$$ LANGUAGE plpgsql;
```

---

#### **Issue 5: No Tenant Isolation**
**Location:** Many tables

**Current:**
```sql
-- Only user-level isolation
USING (auth.uid() = user_id)
```

**Issue:** No support for multi-tenant scenarios

**Fix:**
```sql
-- Add tenant_id column to tables
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE table_name ADD CONSTRAINT fk_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Create tenant membership table
CREATE TABLE tenant_members (
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Policy with tenant isolation
CREATE POLICY "Users can access tenant data"
  ON table_name FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );
```

---

### **Medium (Monitor)**

#### **Issue 6: Immutable Tables Without Protection**
**Location:** `sof_audit_events`, `agent_audit_log`

**Current:**
```sql
-- Allows inserts but not explicit prevention of updates/deletes
CREATE POLICY "System can insert audit events"
  ON sof_audit_events FOR INSERT
  WITH CHECK (true);
```

**Fix:**
```sql
-- Explicit insert-only policy
CREATE POLICY "System can insert audit events"
  ON sof_audit_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Prevent updates
CREATE POLICY "No updates to audit events"
  ON sof_audit_events FOR UPDATE
  USING (false);

-- Prevent deletes
CREATE POLICY "No deletes of audit events"
  ON sof_audit_events FOR DELETE
  USING (false);

-- Or use REVOKE at table level
REVOKE UPDATE, DELETE ON sof_audit_events FROM authenticated, anon;
```

---

## ✅ Recommended Policy Patterns

### **Pattern 1: User Owns Data**
```sql
-- Standard pattern for user-scoped data
CREATE POLICY "users_own_data"
  ON table_name FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Use for:** `cases`, `workflows`, `agent_sessions`, `messages`

---

### **Pattern 2: Tenant Isolation**
```sql
-- Multi-tenant data access
CREATE POLICY "tenant_isolation"
  ON table_name FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')  -- No viewers on writes
    )
  );
```

**Use for:** `value_cases`, `company_profiles`, `value_trees`

---

### **Pattern 3: Admin Only**
```sql
-- Administrative data (read-only for most)
CREATE POLICY "admin_full_access"
  ON table_name FOR ALL
  USING (is_admin());

CREATE POLICY "users_read_only"
  ON table_name FOR SELECT
  TO authenticated
  USING (true);
```

**Use for:** `agents`, `policy_rules`, `cost_alerts`

---

### **Pattern 4: Service Role Bypass**
```sql
-- Always include service role bypass
CREATE POLICY "service_role_bypass"
  ON table_name FOR ALL
  TO service_role
  USING (true);
```

**Use for:** ALL tables (as first policy)

---

### **Pattern 5: Shared Resources**
```sql
-- Read by all, write by creator
CREATE POLICY "shared_read_access"
  ON table_name FOR SELECT
  TO authenticated
  USING (
    visibility = 'public' OR
    visibility = 'shared' OR
    user_id = auth.uid()
  );

CREATE POLICY "creator_write_access"
  ON table_name FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Use for:** `capabilities`, `benchmarks`, `use_cases`

---

### **Pattern 6: Immutable Audit Logs**
```sql
-- Insert-only, no updates/deletes
CREATE POLICY "insert_audit_logs"
  ON audit_table FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "read_own_audit_logs"
  ON audit_table FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Explicitly prevent modifications
REVOKE UPDATE, DELETE ON audit_table FROM authenticated, anon, service_role;
```

**Use for:** `agent_audit_log`, `sof_audit_events`, `secret_audit_logs`

---

## 🚀 Implementation Plan

### **Phase 1: Critical Fixes (Week 1)**

1. **Create Helper Functions**
```sql
-- File: supabase/migrations/20251201000000_rls_helper_functions.sql

-- Admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'service_role')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenant membership check
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenant admin check
CREATE OR REPLACE FUNCTION is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

2. **Fix Feature Flags Policy**
3. **Add Service Role Bypass to All Tables**
4. **Harden Admin-Only Tables**

---

### **Phase 2: Performance Optimization (Week 2)**

1. **Create Materialized Views for Complex Joins**
2. **Add Indexes on RLS Columns**
```sql
-- Index columns used in RLS policies
CREATE INDEX IF NOT EXISTS idx_table_user_id ON table_name(user_id);
CREATE INDEX IF NOT EXISTS idx_table_tenant_id ON table_name(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
```

3. **Optimize Nested Queries**
4. **Benchmark Policy Performance**

---

### **Phase 3: Tenant Isolation (Week 3)**

1. **Add tenant_id to Core Tables**
2. **Create Tenant Management Tables**
3. **Migrate User Data to Tenants**
4. **Update All Policies for Tenant Isolation**

---

### **Phase 4: Testing & Monitoring (Week 4)**

1. **Create RLS Test Suite**
2. **Add Policy Performance Monitoring**
3. **Document All Policies**
4. **Set Up Automated Testing**

---

## 🧪 RLS Testing Framework

### **Test Script**
```sql
-- File: supabase/migrations/tests/rls_tests.sql

-- Create test users
DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  admin_id UUID;
BEGIN
  -- Insert test users (requires service role)
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES 
    (gen_random_uuid(), 'user1@test.com', '{"role": "user"}'),
    (gen_random_uuid(), 'user2@test.com', '{"role": "user"}'),
    (gen_random_uuid(), 'admin@test.com', '{"role": "admin"}')
  RETURNING id INTO user1_id, user2_id, admin_id;

  -- Test 1: User can only see own data
  SET LOCAL "request.jwt.claims" TO json_build_object('sub', user1_id::text)::text;
  
  ASSERT (
    SELECT COUNT(*) FROM cases WHERE user_id != user1_id
  ) = 0, 'User should not see other users data';

  -- Test 2: User cannot insert data for other users
  BEGIN
    INSERT INTO cases (user_id, title) VALUES (user2_id, 'Attempt');
    RAISE EXCEPTION 'Should have failed RLS check';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Expected
  END;

  -- Test 3: Admin can see all data
  SET LOCAL "request.jwt.claims" TO json_build_object('sub', admin_id::text)::text;
  
  ASSERT (
    SELECT COUNT(*) FROM cases
  ) > 0, 'Admin should see all data';

  RAISE NOTICE 'All RLS tests passed!';
END $$;
```

---

## 📈 Performance Monitoring

### **Query to Check RLS Overhead**
```sql
-- Compare query performance with/without RLS
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM cases WHERE user_id = 'user-uuid-here';

-- Check if RLS policies are using indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('cases', 'workflows', 'agent_sessions')
ORDER BY idx_scan DESC;
```

### **Policy Execution Stats**
```sql
-- See which policies are evaluated most
SELECT 
  polname AS policy_name,
  pg_get_expr(polqual, polrelid) AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS check_expression
FROM pg_policy
WHERE polrelid = 'cases'::regclass;
```

---

## 📚 Next Steps

1. **Review Current Policies:** Use the audit queries below
2. **Implement Phase 1 Fixes:** Critical security issues
3. **Add Test Suite:** Automated RLS verification
4. **Monitor Performance:** Check query plans
5. **Document Patterns:** Update this guide

---

## 🔍 Audit Queries

### **Find Tables Without RLS**
```sql
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename 
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE c.relrowsecurity = true
  )
ORDER BY tablename;
```

### **List All RLS Policies**
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### **Find Overly Permissive Policies**
```sql
-- Policies with "USING (true)" - might be too permissive
SELECT 
  tablename,
  policyname,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
  AND cmd != 'SELECT';  -- SELECT with true is often intentional
```

---

## ✅ Security Checklist

- [ ] All tables have RLS enabled
- [ ] Service role bypass exists for all tables
- [ ] Admin functions use SECURITY DEFINER
- [ ] No policies rely solely on JWT claims
- [ ] Immutable tables have update/delete protection
- [ ] Tenant isolation implemented
- [ ] Performance indexes on RLS columns
- [ ] Test suite covers all policies
- [ ] Documentation up to date
- [ ] Monitoring in place

---

**Last Updated:** December 1, 2025  
**Next Review:** January 1, 2026
