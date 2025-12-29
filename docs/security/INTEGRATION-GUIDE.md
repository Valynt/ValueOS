# Zero Trust Security - Complete Integration Guide

## ✅ Implementation Status: COMPLETE

All three P0 completion tasks have been successfully implemented:

### 1. ✅ AuthContext Updated with UserClaims

**File**: `/src/contexts/AuthContext.tsx`

**Changes**:

- Added `UserClaims` type with `permissions` array
- Automatically computes permissions from `user_metadata.roles`
- Updates on session restore and auth state changes
- Maintains backward compatibility with existing code

**New Interface**:

```typescript
interface AuthContextType {
  user: User | null; // Original Supabase user
  userClaims: UserClaims | null; // NEW: With permissions
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean; // NEW: Convenience flag
  // ... auth methods
}
```

---

### 2. ✅ Security Audit API Endpoint Created

**File**: `/app/api/security/audit/route.ts`

**Endpoints**:

- `POST /api/security/audit` - Persist audit events (public, used by client)
- `GET /api/security/audit` - Retrieve audit logs (admin only)

**Features**:

- IP address capture from request headers
- User agent logging
- Query parameters (userId, action, limit)
- RLS enforcement for GET requests
- Fire-and-forget response (always returns 200)

**Database Migration**: `/supabase/migrations/20241229150000_security_audit_events.sql`

---

### 3. ⚠️ Supabase Auth Integration (Partial - Manual Steps Required)

**Auto-Configured**:

- ✅ Supabase client integration
- ✅ Permission computation from roles
- ✅ Session management
- ✅ Auth state change listeners

**Manual Steps Required**:

#### Step 1: Run Database Migration

```bash
# Apply the security_audit_events table migration
npx supabase db push

# Or manually run the SQL:
psql $DATABASE_URL < supabase/migrations/20241229150000_security_audit_events.sql
```

#### Step 2: Configure User Roles

In Supabase Dashboard → Authentication → Users:

**For each user, set `user_metadata`:**

```json
{
  "roles": ["CFO"], // Or ["ADMIN"], ["DEVELOPER"], etc.
  "org_id": "your-org-id"
}
```

**Example SQL for bulk update:**

```sql
-- Grant CFO role to specific user
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{roles}',
  '["CFO"]'
)
WHERE email = 'cfo@example.com';

-- Grant ADMIN role to admin users
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{roles}',
  '["ADMIN"]'
)
WHERE email LIKE '%@valueos.admin';
```

#### Step 3: Test Authentication Flow

**a) Login Test:**

```typescript
// In your app, login as test user
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, isAuthenticated } = useAuth();

  console.log("User Claims:", user);
  console.log("Permissions:", user?.permissions);
  console.log("Authenticated:", isAuthenticated);
}
```

**b) Protected Component Test:**

```typescript
import { ProtectedComponent } from '@/components/security';

<ProtectedComponent
  requiredPermissions={['VIEW_FINANCIALS']}
  resourceName="Test Dashboard"
>
  <div>You can see this if you have VIEW_FINANCIALS permission!</div>
</ProtectedComponent>
```

**c) Verify Audit Logging:**

```bash
# As ADMIN user, check audit logs
curl http://localhost:3000/api/security/audit?limit=10 \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

#### Step 4: Test Different Roles

| Test User        | Role      | Should See Financials? | Should See Tech Debt? |
| ---------------- | --------- | ---------------------- | --------------------- |
| cfo@test.com     | CFO       | ✅ Yes                 | ❌ No                 |
| dev@test.com     | DEVELOPER | ❌ No                  | ✅ Yes                |
| analyst@test.com | ANALYST   | ✅ Yes                 | ✅ Yes                |
| admin@test.com   | ADMIN     | ✅ Yes                 | ✅ Yes                |

---

## File Summary

### Core Implementation (11 files)

1. `/src/types/security.ts` - Permission types, UserClaims, role matrix
2. `/src/services/security/auditLogger.ts` - Audit logger with reliable delivery
3. `/src/components/security/ProtectedComponent.tsx` - Zero Trust wrapper
4. `/src/components/security/index.ts` - Barrel exports
5. `/src/contexts/AuthContext.tsx` - Updated with UserClaims
6. `/src/hooks/useAuth.ts` - Adapter for ProtectedComponent
7. `/app/api/security/audit/route.ts` - Security audit API
8. `/supabase/migrations/20241229150000_security_audit_events.sql` - DB schema
9. `/src/components/security/__tests__/ProtectedComponent.test.tsx` - Unit tests
10. `/src/components/templates/ProtectedTrinityDashboard.tsx` - Example usage
11. `/src/__tests__/integration/zero-trust-security.test.ts` - Integration tests

### Documentation (2 files)

12. `/docs/security/P0-ZERO-TRUST-WRAPPER.md` - Full documentation
13. `/workspaces/ValueOS/docs/security/INTEGRATION-GUIDE.md` - This file

---

## Permission Matrix

```typescript
ROLE_PERMISSIONS = {
  CFO: ["VIEW_FINANCIALS", "APPROVE_RISK"],
  ADMIN: [
    "VIEW_FINANCIALS",
    "VIEW_TECHNICAL_DEBT",
    "EXECUTE_AGENT",
    "APPROVE_RISK",
    "ADMIN_SYSTEM",
  ],
  DEVELOPER: ["VIEW_TECHNICAL_DEBT", "EXECUTE_AGENT"],
  ANALYST: ["VIEW_FINANCIALS", "VIEW_TECHNICAL_DEBT"],
  AGENT: ["EXECUTE_AGENT"],
};
```

---

## Testing Checklist

- [x] Permission computation logic tested
- [x] ProtectedComponent unit tests (15+ cases)
- [x] AuthContext updated with UserClaims
- [x] Security audit API endpoint created
- [x] Database migration script created
- [x] Integration test suite created
- [ ] Database migration applied _(manual step required)_
- [ ] Test users created with roles _(manual step required)_
- [ ] End-to-end auth flow tested _(manual step required)_
- [ ] Audit logs verified in database _(manual step required)_

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Run database migration on production Supabase
- [ ] Assign roles to all existing users
- [ ] Test with production Auth0/Okta (if using external OIDC)
- [ ] Configure rate limiting on `/api/security/audit`
- [ ] Set up monitoring for security events

### Post-Deployment

- [ ] Verify audit events are being logged
- [ ] Monitor failed permission checks
- [ ] Review access patterns for anomalies
- [ ] Generate SOC 2 compliance report from audit logs

---

## Troubleshooting

### Issue: "Permission denied for table security_audit_events"

**Solution**: Re-run the migration with service role key or correct RLS policies

### Issue: User always sees "Access Restricted"

**Solution**: Check `user_metadata.roles` in Supabase Dashboard → Authentication → Users

### Issue: Permissions not updating after role change

**Solution**: User must log out and log back in to get fresh session with new permissions

### Issue: Audit events not appearing in database

**Solution**: Check browser network tab for failed POST to `/api/security/audit`, verify RLS policies

---

## SOC 2 Compliance Evidence

### CC6.1 - Access Control

✅ Implemented: Render-level permission checks prevent unauthorized UI access  
✅ Implemented: Granular permissions based on roles  
✅ Implemented: Deny-by-default security model

### CC6.8 - Audit Logging

✅ Implemented: All access denials logged with:

- Timestamp (ISO 8601)
- User ID
- Resource name
- Required vs actual permissions
- Action result
- IP address
- User agent

**Audit Query for Compliance Report:**

```sql
SELECT
  action,
  resource,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users
FROM security_audit_events
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY action, resource
ORDER BY event_count DESC;
```

---

## Next Steps

1. **Apply Migration**: Run `npx supabase db push` or execute SQL manually
2. **Configure Roles**: Set `user_metadata.roles` for all users
3. **Test Locally**: Follow Step 3 testing instructions above
4. **Monitor Production**: Set up alerts for high rate of ACCESS_DENIED events
5. **Generate Reports**: Create monthly SOC 2 compliance reports from audit logs

---

**Implementation Date**: December 29, 2025  
**Status**: ✅ Code Complete | ⚠️ Manual Configuration Required  
**Next Reviewer**: Security Team + SOC 2 Auditor
