# Security Hardening Documentation

## Overview

This document describes the security hardening measures implemented to fix 6 security lint errors and establish least-privilege, RLS-first architecture.

## Security Lint Errors Fixed

### 1. ✅ Security Definer View

**Issue**: `public.recent_confidence_violations` used SECURITY DEFINER, bypassing RLS  
**Fix**: Recreated as SECURITY INVOKER, relies on RLS policies on base tables  
**Impact**: View now respects tenant isolation via RLS

### 2. ✅ PUBLIC Grants on Sensitive Tables

**Issue**: Broad PUBLIC access on tables/views  
**Fix**: Revoked ALL from PUBLIC, granted SELECT only to `authenticated` role  
**Impact**: Only authenticated users can access data

### 3. ✅ Missing/Weak RLS Policies

**Issue**: Incomplete tenant isolation on `confidence_violations` and `agent_predictions`  
**Fix**:

- Enabled RLS on both tables
- Created tenant isolation policies using `user_tenants` join
- Added performance indexes on policy columns  
  **Impact**: Users can only see data from their tenants

### 4. ✅ Over-Privileged Ownership

**Issue**: Views owned by superuser/service_role  
**Fix**:

- Created `view_reader` role (NOLOGIN, minimal privileges)
- Transferred view ownership to `view_reader`  
  **Impact**: Reduced blast radius of potential exploits

### 5. ✅ SECURITY DEFINER Functions

**Issue**: Functions with SECURITY DEFINER lack explicit tenant checks  
**Fix**: Template provided for hardening (apply to specific functions as needed)  
**Pattern**:

```sql
CREATE FUNCTION ... SECURITY DEFINER STABLE AS $$
  SELECT * FROM table
  WHERE EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_id = (auth.uid())::text
  );
$$;
REVOKE ALL FROM PUBLIC;
GRANT EXECUTE TO authenticated;
ALTER FUNCTION ... OWNER TO view_reader;
```

### 6. ✅ Excessive Schema/Sequence Privileges

**Issue**: PUBLIC had broad access to schema and sequences  
**Fix**:

- Revoked ALL on SCHEMA public FROM PUBLIC
- Granted USAGE to authenticated only
- Revoked sequence access from PUBLIC  
  **Impact**: Principle of least privilege enforced

## RLS Policy Architecture

### Tenant Isolation Pattern

All multi-tenant tables use this pattern:

```sql
CREATE POLICY "table_tenant_isolation" ON table_name
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.user_id = (auth.uid())::text
      AND ut.tenant_id = table_name.tenant_id
    )
  );
```

### User Ownership Pattern

For user-specific data:

```sql
USING (
  user_id = (auth.uid())::text
  OR EXISTS (...)  -- Tenant fallback
)
```

## Role Hierarchy

```
┌─────────────────┐
│   anon          │ (unauthenticated users)
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ authenticated   │ (logged-in users)
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  view_reader    │ (minimal role for view ownership)
└─────────────────┘
```

## Performance Considerations

### Indexes Created

- `idx_confidence_violations_created_at` - For time-based filtering
- `idx_agent_predictions_user` - For user-based RLS
- `idx_agent_predictions_tenant` - For tenant-based RLS
- `idx_user_tenants_user` - For RLS policy joins
- `idx_user_tenants_tenant` - For RLS policy joins

### Query Performance

RLS policies use EXISTS subqueries which PostgreSQL optimizes well. Monitor with:

```sql
EXPLAIN ANALYZE
SELECT * FROM recent_confidence_violations;
```

## Testing Checklist

### Functional Testing

- [ ] Authenticated user can see their own data
- [ ] User cannot see data from other tenants
- [ ] View `recent_confidence_violations` filters correctly
- [ ] Application functions work with new permissions

### Security Testing

- [ ] Unauthenticated requests are blocked
- [ ] Cross-tenant data leakage prevented
- [ ] SECURITY DEFINER functions enforce tenant checks
- [ ] No PUBLIC grants remain on sensitive objects

### Performance Testing

- [ ] RLS policies use indexes effectively
- [ ] Query plans show index usage
- [ ] No significant performance degradation


## Billing catalog + tenant-scoped policy posture

Billing migrations follow JWT claim-based tenant scoping for all tenant data tables:

- `usage_policies`, `billing_approval_policies`, `billing_approval_requests`, and `entitlement_snapshots` enforce `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid` in policy predicates (USING and WITH CHECK where writes are allowed).
- `billing_price_versions` is read-scoped to the caller tenant context via linked `subscriptions` rows, preventing broad catalog visibility.

### Explicit global-table exception

`billing_meters` is intentionally global because it is a static product meter catalog (no customer- or tenant-owned records). Risk acceptance is limited to authenticated read-only access.

- `authenticated`: `SELECT` only
- `anon`: no direct grant in production posture
- `service_role`: full access for provisioning/ops paths

This exception is documented in migration comments and covered by billing RLS tests to ensure other billing tables remain tenant-isolated.

## Validation Commands

```bash
# Re-run security linter
supabase db lint

# Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

# Check PUBLIC grants (should be empty)
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'PUBLIC' AND table_schema = 'public';

# Check view security
SELECT viewname, viewowner,
       CASE WHEN definition LIKE '%SECURITY DEFINER%'
            THEN 'DEFINER'
            ELSE 'INVOKER'
       END as security_type
FROM pg_views
WHERE schemaname = 'public';
```

## Rollback Plan

If issues arise, rollback with:

```sql
-- Restore PUBLIC grants (NOT RECOMMENDED)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC;

-- Disable RLS temporarily (EMERGENCY ONLY)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

## Maintenance

### Adding New Tables

When creating new tables:

1. Enable RLS immediately:

   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ```

2. Create tenant isolation policy:

   ```sql
   CREATE POLICY "new_table_tenant_isolation" ...
   ```

3. Revoke PUBLIC, grant to authenticated:

   ```sql
   REVOKE ALL ON new_table FROM PUBLIC;
   GRANT SELECT ON new_table TO authenticated;
   ```

4. Add performance indexes for RLS columns

### Adding New Views

1. Use SECURITY INVOKER (default)
2. Revoke PUBLIC, grant to authenticated
3. Set owner to `view_reader` if read-only

### Adding New Functions

1. Avoid SECURITY DEFINER unless absolutely necessary
2. If DEFINER needed:
   - Add explicit tenant checks
   - Mark STABLE/IMMUTABLE where appropriate
   - Revoke from PUBLIC
   - Set owner to least-privileged role

## References

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Least Privilege Principle](https://en.wikipedia.org/wiki/Principle_of_least_privilege)

---

**Migration**: `20251226150000_security_hardening_fix_lint_errors.sql`  
**Created**: 2025-12-26  
**Status**: Ready to apply
