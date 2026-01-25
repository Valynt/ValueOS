# RBAC Quick Reference Card

## Quick Links

- **Supabase Dashboard (Local)**: http://localhost:54323
- **Full Guide**: [ASSIGN_ROLES_GUIDE.md](./ASSIGN_ROLES_GUIDE.md)
- **RBAC Implementation**: [rbac-guide.md](./rbac-guide.md)

## Available Roles

| Role             | Scope  | Permissions                                           |
| ---------------- | ------ | ----------------------------------------------------- |
| `system_admin`   | Global | `["*"]` - Full system access                          |
| `security_admin` | Global | `["security.*", "audit.*"]` - Security & auditing     |
| `tenant_owner`   | Tenant | `["tenant.*"]` - Full tenant access                   |
| `tenant_admin`   | Tenant | `["tenant.read", "tenant.write"]` - Tenant management |

## Quick Commands

### 1. View All Roles

```sql
SELECT id, name, description, permissions FROM roles ORDER BY name;
```

### 2. View All Users

```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 10;
```

### 3. Assign Role to User

**Tenant-specific role:**

```sql
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'YOUR-USER-UUID', id, 'YOUR-TENANT-ID'
FROM roles WHERE name = 'tenant_admin'
ON CONFLICT DO NOTHING;
```

**Global role:**

```sql
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'YOUR-USER-UUID', id, NULL
FROM roles WHERE name = 'system_admin'
ON CONFLICT DO NOTHING;
```

### 4. View User's Roles

```sql
SELECT u.email, r.name, r.permissions, ur.tenant_id
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = 'YOUR-USER-UUID';
```

### 5. Remove Role from User

```sql
DELETE FROM user_roles
WHERE user_id = 'YOUR-USER-UUID'
  AND role_id = (SELECT id FROM roles WHERE name = 'role-name')
  AND tenant_id = 'YOUR-TENANT-ID'; -- or IS NULL for global
```

## Testing Locally

### Option 1: SQL Test Script

```bash
# 1. Open Supabase Dashboard
open http://localhost:54323

# 2. Go to SQL Editor
# 3. Open: /workspaces/ValueOS/supabase/tests/rbac_local_test.sql
# 4. Run the entire script
```

### Option 2: TypeScript Tests

```bash
# Run RBAC test suite
pnpm run test -- rbac.local.test.ts

# Or with watch mode
pnpm run test -- rbac.local.test.ts --watch
```

### Option 3: Manual Dashboard Testing

1. Open http://localhost:54323
2. Navigate to **Authentication** → **Users**
3. Note a user ID
4. Navigate to **SQL Editor**
5. Run assignment queries above

## Common Patterns

### Create New Tenant + Assign Owner

```sql
BEGIN;

-- Create tenant
INSERT INTO tenants (id, name, status)
VALUES ('my-tenant', 'My Tenant', 'active');

-- Link user to tenant
INSERT INTO user_tenants (tenant_id, user_id, role)
VALUES ('my-tenant', 'USER-UUID', 'owner');

-- Assign tenant_owner role
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'USER-UUID', id, 'my-tenant'
FROM roles WHERE name = 'tenant_owner';

COMMIT;
```

### Promote User to Admin

```sql
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'USER-UUID', id, 'TENANT-ID'
FROM roles WHERE name = 'tenant_admin'
ON CONFLICT DO NOTHING;
```

### Check User Permissions

```sql
SELECT
    jsonb_array_elements_text(r.permissions) as permission
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = 'USER-UUID'
  AND (ur.tenant_id = 'TENANT-ID' OR ur.tenant_id IS NULL);
```

## Environment Variables

Make sure these are set in your `.env.local`:

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find keys at: http://localhost:54323/project/default/settings/api

## Troubleshooting

| Problem                 | Solution                                                  |
| ----------------------- | --------------------------------------------------------- |
| "No users found"        | Create a user via Supabase Auth or signup flow            |
| "Role does not exist"   | Check migrations are applied: `pnpm run db:push`  |
| "Foreign key violation" | Verify user_id, role_id, and tenant_id all exist          |
| "Duplicate key error"   | User already has this role - use `ON CONFLICT DO NOTHING` |
| "RLS blocks query"      | Use service role key for admin operations                 |

## Permission Patterns

| Pattern        | SQL Example                      |
| -------------- | -------------------------------- | --------------------------------- |
| Exact match    | `permissions @> '["data.read"]'` |
| Wildcard match | `permissions @> '["data.*"]'`    |
| Full access    | `permissions @> '["*"]'`         |
| Multiple perms | `permissions ?                   | array['data.read', 'data.write']` |

## TypeScript Helper

```typescript
import { checkUserPermission } from "@/test/rbac.local.test";

const hasPermission = await checkUserPermission(
  supabase,
  userId,
  "data.create",
  tenantId
);

if (hasPermission) {
  // Allow operation
}
```

## Files Created

1. **Guide**: `/docs/security/ASSIGN_ROLES_GUIDE.md` - Comprehensive documentation
2. **SQL Test**: `/supabase/tests/rbac_local_test.sql` - SQL testing script
3. **TS Test**: `/src/test/rbac.local.test.ts` - TypeScript test suite
4. **Quick Ref**: `/docs/security/RBAC_QUICK_REFERENCE.md` - This file

## Next Steps

1. ✅ Read the [full guide](./ASSIGN_ROLES_GUIDE.md)
2. ✅ Run the SQL test script
3. ✅ Test with TypeScript tests
4. ✅ Assign roles to your users
5. ✅ Verify permissions in your app
6. ✅ Check audit logs

## Security Reminders

- ⚠️ **Always** use least privilege principle
- ⚠️ **Never** assign system_admin to regular users
- ⚠️ **Always** specify tenant_id for tenant-scoped roles
- ⚠️ **Always** audit role assignments
- ⚠️ **Regularly** review and remove unused roles

## Support

- Documentation: `/docs/security/`
- Issues: Check Supabase logs at http://localhost:54323
- Debug: Use SQL Editor to inspect tables directly
