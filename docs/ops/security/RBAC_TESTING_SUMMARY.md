# RBAC Setup & Testing - Complete Summary

## What Was Created

I've created a complete set of documentation and testing tools for assigning roles to users in Supabase and testing locally:

### 📚 Documentation (4 files)

1. **[ASSIGN_ROLES_GUIDE.md](./ASSIGN_ROLES_GUIDE.md)** - Comprehensive guide
   - Step-by-step instructions for assigning roles via Supabase Dashboard
   - Database schema reference
   - Common role assignment patterns
   - Troubleshooting tips
   - Security best practices

2. **[RBAC_QUICK_REFERENCE.md](./RBAC_QUICK_REFERENCE.md)** - Quick reference card
   - One-page cheat sheet
   - Common SQL commands
   - Quick troubleshooting
   - Environment variables

3. **[rbac-guide.md](./rbac-guide.md)** - Existing RBAC implementation guide
   - Middleware usage
   - Route protection patterns
   - Permission matrix

### 🧪 Test Files (2 files)

4. **[/supabase/tests/rbac_local_test.sql](../../supabase/tests/rbac_local_test.sql)** - SQL test script
   - Automated test data creation
   - Role assignment examples
   - Permission verification
   - Clean-up scripts
   - Can be run directly in Supabase SQL Editor

5. **[/src/test/rbac.local.test.ts](../../src/test/rbac.local.test.ts)** - TypeScript test suite
   - Vitest-based test suite
   - Role management tests
   - Permission checking tests
   - Multi-role scenarios
   - Helper function for permission checking

### 🚀 Helper Scripts (1 file)

6. **[/scripts/test-rbac.sh](../../scripts/test-rbac.sh)** - Interactive test script
   - Guides you through testing process
   - Opens Supabase Dashboard
   - Runs test suites
   - Provides summary and next steps

## Quick Start

### Option 1: Interactive Script (Recommended)

```bash
./scripts/test-rbac.sh
```

### Option 2: Manual SQL Testing

1. Open http://localhost:54323 (Supabase Dashboard)
2. Navigate to **SQL Editor**
3. Open/paste: `supabase/tests/rbac_local_test.sql`
4. Click **Run**

### Option 3: TypeScript Testing

```bash
npm test -- rbac.local.test.ts
```

## Understanding the Role System

ValueOS uses a **two-layer RBAC system**:

### Layer 1: System Roles (`roles` table)

Predefined roles with specific permissions:

| Role             | Scope  | Permissions                       | Use Case                    |
| ---------------- | ------ | --------------------------------- | --------------------------- |
| `system_admin`   | Global | `["*"]`                           | Full system access          |
| `security_admin` | Global | `["security.*", "audit.*"]`       | Security & audit management |
| `tenant_owner`   | Tenant | `["tenant.*"]`                    | Full tenant control         |
| `tenant_admin`   | Tenant | `["tenant.read", "tenant.write"]` | Tenant management           |

### Layer 2: User Roles (`user_roles` table)

Links users to system roles within a tenant context:

```sql
user_roles (
  user_id TEXT,      -- References auth.users.id
  role_id UUID,      -- References roles.id
  tenant_id TEXT     -- References tenants.id (NULL for global)
)
```

## Database Schema

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ auth.users   │      │  user_roles  │      │    roles     │
├──────────────┤      ├──────────────┤      ├──────────────┤
│ id (UUID)    │◄─────│ user_id      │      │ id (UUID)    │
│ email        │      │ role_id      │─────►│ name         │
└──────────────┘      │ tenant_id    │      │ permissions  │
                      └──────────────┘      └──────────────┘
                             │
                             │
                             ▼
                      ┌──────────────┐
                      │   tenants    │
                      ├──────────────┤
                      │ id (TEXT)    │
                      │ name         │
                      │ status       │
                      └──────────────┘
```

## Common Tasks

### 1. View Available Roles

```sql
SELECT id, name, description, permissions
FROM roles
ORDER BY name;
```

### 2. Assign Tenant Admin Role

```sql
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'YOUR-USER-UUID', id, 'YOUR-TENANT-ID'
FROM roles WHERE name = 'tenant_admin'
ON CONFLICT DO NOTHING;
```

### 3. Assign System Admin (Global)

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
  AND tenant_id = 'YOUR-TENANT-ID';
```

## Testing Workflow

1. **Start Supabase** (if not already running)

   ```bash
   npm run supabase:start
   ```

2. **Open Supabase Dashboard**
   - Local: http://localhost:54323
   - Cloud: https://app.supabase.com

3. **Run SQL Test Script**
   - Navigate to **SQL Editor**
   - Open `supabase/tests/rbac_local_test.sql`
   - Click **Run**
   - Review output

4. **Run TypeScript Tests** (optional)

   ```bash
   npm test -- rbac.local.test.ts
   ```

5. **Assign Roles to Real Users**
   - Get user ID from **Authentication** → **Users**
   - Get tenant ID from database
   - Run assignment SQL in **SQL Editor**

6. **Verify in Application**
   - Login as the user
   - Test permission-protected features
   - Check audit logs

## Permission Checking

### In SQL

```sql
-- Check if user has permission
SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = 'USER-UUID'
      AND (
        r.permissions ? 'specific.permission'
        OR r.permissions ? 'specific.*'
        OR r.permissions ? '*'
      )
) AS has_permission;
```

### In TypeScript

```typescript
import { checkUserPermission } from "@/test/rbac.local.test";

const canDelete = await checkUserPermission(
  supabase,
  userId,
  "data.delete",
  tenantId
);

if (canDelete) {
  // Perform deletion
}
```

## Troubleshooting

| Issue                | Solution                                   |
| -------------------- | ------------------------------------------ |
| No users found       | Create user via Auth UI or signup          |
| Roles don't exist    | Run migrations: `npm run supabase:migrate` |
| Foreign key error    | Verify user_id, role_id, tenant_id exist   |
| Duplicate error      | User already has role - this is OK         |
| RLS blocks query     | Use service_role key for admin ops         |
| Dashboard won't open | Check Supabase is running on port 54323    |

## Security Best Practices

1. ✅ **Least Privilege**: Grant minimum required permissions
2. ✅ **Tenant Isolation**: Always specify tenant_id for tenant roles
3. ✅ **Audit Everything**: Log all role assignments
4. ✅ **Regular Reviews**: Audit roles quarterly
5. ✅ **No Shared Accounts**: One user = one account
6. ✅ **Strong Passwords**: Enforce password policies
7. ✅ **MFA**: Enable for admin accounts

## File Locations

```
ValueOS/
├── docs/security/
│   ├── ASSIGN_ROLES_GUIDE.md       ← Full guide
│   ├── RBAC_QUICK_REFERENCE.md     ← Quick reference
│   ├── rbac-guide.md               ← Implementation guide
│   └── RBAC_TESTING_SUMMARY.md     ← This file
├── supabase/tests/
│   └── rbac_local_test.sql         ← SQL test script
├── src/test/
│   └── rbac.local.test.ts          ← TypeScript tests
└── scripts/
    └── test-rbac.sh                ← Interactive script
```

## Next Steps

After testing:

1. ✅ Review the full documentation
2. ✅ Assign roles to your actual users
3. ✅ Test permissions in the application
4. ✅ Verify RLS policies work correctly
5. ✅ Set up monitoring for permission denials
6. ✅ Document your role assignment process
7. ✅ Train team members on RBAC usage

## Example: Complete User Setup

```sql
-- Complete example: New tenant + user + role
BEGIN;

-- 1. Create tenant
INSERT INTO tenants (id, name, status)
VALUES ('acme-corp', 'ACME Corporation', 'active');

-- 2. Link user to tenant
INSERT INTO user_tenants (tenant_id, user_id, role)
VALUES ('acme-corp', 'a1b2c3d4-...', 'owner');

-- 3. Assign tenant_owner role
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'a1b2c3d4-...', id, 'acme-corp'
FROM roles WHERE name = 'tenant_owner';

-- 4. Verify
SELECT u.email, r.name, r.permissions
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = 'a1b2c3d4-...';

COMMIT;
```

## Support & Resources

- **Documentation**: `/docs/security/`
- **Supabase Dashboard**: http://localhost:54323
- **Supabase Logs**: Check dashboard for errors
- **Database**: Use SQL Editor to inspect tables
- **Tests**: Run test suites for verification

---

**Created**: 2025-12-29  
**Author**: Antigravity AI  
**Version**: 1.0
