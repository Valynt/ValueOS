# RLS Policy Quick Reference Card

**Keep this handy when writing policies!** 🔒

---

## 🎯 Core Patterns (Copy & Paste)

### **Pattern 1: User Owns Data**
```sql
-- Users can only access their own records
CREATE POLICY "users_own_data"
  ON table_name FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```
**Use for:** `cases`, `workflows`, `messages`, `agent_sessions`

---

### **Pattern 2: Service Role Bypass (ALWAYS INCLUDE)**
```sql
-- Backend can do anything (add to ALL tables)
CREATE POLICY "service_role_bypass"
  ON table_name FOR ALL
  TO service_role
  USING (true);
```
**Use for:** **EVERY TABLE** (add as first policy)

---

### **Pattern 3: Admin Only**
```sql
-- Only admins can manage
CREATE POLICY "admin_full_access"
  ON table_name FOR ALL
  USING (public.is_admin());

-- Everyone can read
CREATE POLICY "public_read"
  ON table_name FOR SELECT
  TO authenticated
  USING (true);
```
**Use for:** `agents`, `policy_rules`, `feature_flags`, `cost_alerts`

---

### **Pattern 4: Tenant Isolation**
```sql
-- Multi-tenant access control
CREATE POLICY "tenant_access"
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
        AND role IN ('owner', 'admin', 'member')
    )
  );
```
**Use for:** `value_cases`, `company_profiles`, `value_trees`

---

### **Pattern 5: Immutable Audit Logs**
```sql
-- Allow inserts only, block updates/deletes
CREATE POLICY "insert_only"
  ON audit_table FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "read_own_logs"
  ON audit_table FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "block_updates"
  ON audit_table FOR UPDATE
  USING (false);

CREATE POLICY "block_deletes"
  ON audit_table FOR DELETE
  USING (false);
```
**Use for:** `agent_audit_log`, `sof_audit_events`, `secret_audit_logs`

---

### **Pattern 6: Shared Resources**
```sql
-- Read: public/shared/own
-- Write: own only
CREATE POLICY "shared_read"
  ON table_name FOR SELECT
  TO authenticated
  USING (
    visibility = 'public' OR
    visibility = 'shared' OR
    user_id = auth.uid()
  );

CREATE POLICY "creator_write"
  ON table_name FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```
**Use for:** `capabilities`, `benchmarks`, `use_cases`

---

## 🛠️ Helper Functions

### **Create Once, Use Everywhere**

```sql
-- Check if user is admin (SECURITY DEFINER = trusted)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'service_role')
  );
END;
$$;

-- Check tenant membership
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  );
END;
$$;

-- Check if user owns record
CREATE OR REPLACE FUNCTION public.user_owns_record(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN auth.uid() = p_user_id;
END;
$$;
```

**Usage in policies:**
```sql
USING (public.is_admin())
USING (public.is_tenant_member(tenant_id))
USING (public.user_owns_record(user_id))
```

---

## ⚡ Performance Tips

### **1. Add Indexes on RLS Columns**
```sql
-- Index columns used in USING/WITH CHECK clauses
CREATE INDEX idx_table_user_id ON table_name(user_id);
CREATE INDEX idx_table_tenant_id ON table_name(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
```

### **2. Use Materialized Views for Complex Joins**
```sql
-- Instead of nested EXISTS in every query
CREATE MATERIALIZED VIEW user_access AS
SELECT 
  resource_id,
  user_id
FROM resources r
JOIN permissions p ON p.resource_id = r.id;

CREATE INDEX ON user_access(user_id, resource_id);

-- Simpler policy
CREATE POLICY "user_access"
  ON resources FOR SELECT
  USING (
    id IN (
      SELECT resource_id FROM user_access
      WHERE user_id = auth.uid()
    )
  );
```

### **3. Avoid Multiple Policies per Operation**
```sql
-- ❌ BAD: Multiple SELECT policies (slower)
CREATE POLICY "p1" ON t FOR SELECT USING (condition1);
CREATE POLICY "p2" ON t FOR SELECT USING (condition2);

-- ✅ GOOD: Single policy with OR
CREATE POLICY "select_policy" ON t FOR SELECT
  USING (condition1 OR condition2);
```

---

## ❌ Common Mistakes

### **1. No Service Role Bypass**
```sql
-- ❌ Backend can't access data!
CREATE POLICY "users_only"
  ON table_name FOR ALL
  USING (auth.uid() = user_id);

-- ✅ Always add service role bypass
CREATE POLICY "service_role_bypass"
  ON table_name FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "users_own_data"
  ON table_name FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);
```

---

### **2. Using JWT Claims Directly**
```sql
-- ❌ INSECURE: Client can manipulate JWT
USING (auth.jwt() ->> 'role' = 'admin')

-- ✅ SECURE: Use SECURITY DEFINER function
USING (public.is_admin())
```

---

### **3. Forgetting WITH CHECK**
```sql
-- ❌ Can insert data for other users!
CREATE POLICY "p"
  ON table_name FOR INSERT
  USING (auth.uid() = user_id);  -- Only checks reads!

-- ✅ Use WITH CHECK for inserts/updates
CREATE POLICY "p"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

### **4. Overly Permissive Policies**
```sql
-- ❌ DANGEROUS: Anyone can insert anything
CREATE POLICY "allow_all"
  ON feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ✅ Restrict to admins
CREATE POLICY "admin_only"
  ON feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
```

---

## 🧪 Testing Your Policies

### **Quick Test Template**
```sql
-- Simulate user
SET LOCAL "request.jwt.claims" TO 
  json_build_object('sub', 'user-uuid-here')::text;

-- Test: Can user see only their data?
SELECT COUNT(*) FROM table_name;  -- Should be limited

-- Test: Can user insert for another user?
INSERT INTO table_name (user_id, ...) 
VALUES ('other-user-uuid', ...);  -- Should fail

-- Reset
RESET "request.jwt.claims";
```

---

## 📊 Audit Commands

### **Find Tables Without RLS**
```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE c.relrowsecurity = true
  );
```

### **List All Policies**
```sql
SELECT 
  tablename,
  policyname,
  cmd,
  qual AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### **Find Overly Permissive Policies**
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
```

---

## 🎯 Checklist for New Tables

- [ ] Enable RLS: `ALTER TABLE t ENABLE ROW LEVEL SECURITY;`
- [ ] Add service role bypass (FIRST!)
- [ ] Add user/tenant isolation policy
- [ ] Add read policy (if different from write)
- [ ] Add admin policy (if needed)
- [ ] Create indexes on RLS columns
- [ ] Test with multiple users
- [ ] Check query performance
- [ ] Document in migration

---

## 🔗 Quick Links

- **Full Guide:** `docs/RLS_POLICY_REFINEMENTS.md`
- **Migration:** `supabase/migrations/20251201000000_rls_refinements_phase1.sql`
- **Tests:** `test/rls_tests.sql`
- **Audit:** `scripts/audit-rls-policies.sql`

---

## 💡 Remember

1. **ALWAYS** add service role bypass FIRST
2. **NEVER** trust JWT claims directly
3. **ALWAYS** use `WITH CHECK` for writes
4. **NEVER** use `USING (true)` for writes
5. **ALWAYS** test with real users
6. **NEVER** forget indexes on RLS columns

---

**Last Updated:** December 1, 2025  
**Keep this card accessible!** Pin it, print it, bookmark it! 📌
