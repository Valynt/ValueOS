# Assigning Roles to Users in Supabase

This guide shows you how to assign roles to users using the Supabase Dashboard and test the role-based access control (RBAC) locally.

## Prerequisites

- Supabase project running (cloud or local)
- At least one authenticated user in your system
- Access to Supabase Dashboard

## Understanding the Role System

ValueOS uses a two-layer role system:

### 1. **System Roles** (stored in `roles` table)

Predefined roles with specific permissions:

- `system_admin` - Full system access
- `security_admin` - Security and audit management
- `tenant_owner` - Full tenant access
- `tenant_admin` - Tenant read/write access

### 2. **User Roles** (stored in `user_roles` table)

Links users to system roles within a tenant context.

## Database Schema

```sql
-- Roles table
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles table
CREATE TABLE public.user_roles (
    user_id TEXT NOT NULL,
    role_id UUID NOT NULL,
    tenant_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);
```

## Step 1: Access Supabase Dashboard SQL Editor

### For Local Development

1. Open your browser to: http://localhost:54323
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**

### For Cloud Project

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New query**

## Step 2: View Existing Roles

First, check what roles are available:

```sql
-- View all available roles
SELECT id, name, description, permissions
FROM roles
ORDER BY name;
```

Expected output:

```
id                                    | name            | description                        | permissions
--------------------------------------+-----------------+------------------------------------+------------------
uuid-here                             | security_admin  | Security administrator             | ["security.*", "audit.*"]
uuid-here                             | system_admin    | System administrator with full access | ["*"]
uuid-here                             | tenant_admin    | Tenant administrator               | ["tenant.read", "tenant.write"]
uuid-here                             | tenant_owner    | Tenant owner                       | ["tenant.*"]
```

## Step 3: Get User IDs

Find the user IDs you want to assign roles to:

```sql
-- View all users in auth.users
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

## Step 4: Get Tenant ID

If you're using multi-tenancy, get the appropriate tenant ID:

```sql
-- View all tenants
SELECT id, name, status
FROM tenants
WHERE status = 'active'
ORDER BY created_at DESC;
```

## Step 5: Assign Role to User

Now assign a role to a user. Choose the appropriate SQL based on your needs:

### Assign System Admin Role

```sql
-- Assign system_admin role to a user
-- Replace 'user-uuid-here' with the actual user UUID
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    'user-uuid-here'::text,  -- Replace with actual user ID
    id,                       -- Role ID (from roles table)
    NULL                      -- NULL for system-wide roles
FROM roles
WHERE name = 'system_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

### Assign Tenant-Specific Role

```sql
-- Assign tenant_admin role to a user for a specific tenant
-- Replace placeholders with actual values
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    'user-uuid-here'::text,    -- Replace with actual user ID
    r.id,                       -- Role ID
    'tenant-id-here'::text      -- Replace with actual tenant ID
FROM roles r
WHERE r.name = 'tenant_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

### Assign Multiple Roles

```sql
-- Assign multiple roles to a user at once
WITH user_info AS (
    SELECT 'user-uuid-here'::text AS user_id,
           'tenant-id-here'::text AS tenant_id
)
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    ui.user_id,
    r.id,
    ui.tenant_id
FROM user_info ui
CROSS JOIN roles r
WHERE r.name IN ('tenant_admin', 'security_admin')
ON CONFLICT (user_id, role_id) DO NOTHING;
```

## Step 6: Verify Role Assignment

Check that the role was assigned correctly:

```sql
-- View all roles for a specific user
SELECT
    ur.user_id,
    u.email,
    r.name AS role_name,
    r.permissions,
    ur.tenant_id,
    t.name AS tenant_name,
    ur.created_at
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN tenants t ON t.id = ur.tenant_id
WHERE ur.user_id = 'user-uuid-here'::text
ORDER BY ur.created_at DESC;
```

## Step 7: Test Permissions

You can test if a user has specific permissions:

```sql
-- Check if user has a specific permission
-- This is a helper query to understand what permissions a user has
WITH user_permissions AS (
    SELECT
        ur.user_id,
        jsonb_array_elements_text(r.permissions) AS permission
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = 'user-uuid-here'::text
)
SELECT
    user_id,
    permission,
    -- Check if permission matches pattern
    CASE
        WHEN permission = '*' THEN 'ALL PERMISSIONS'
        WHEN permission LIKE 'tenant.*' THEN 'ALL TENANT PERMISSIONS'
        WHEN permission LIKE 'security.*' THEN 'ALL SECURITY PERMISSIONS'
        ELSE permission
    END AS permission_scope
FROM user_permissions;
```

## Common Role Assignment Patterns

### Pattern 1: New Tenant Owner Setup

```sql
-- When creating a new tenant, assign the creator as tenant_owner
WITH new_user AS (
    SELECT
        'user-uuid-here'::text AS user_id,
        'tenant-id-here'::text AS tenant_id
)
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    nu.user_id,
    r.id,
    nu.tenant_id
FROM new_user nu
CROSS JOIN roles r
WHERE r.name = 'tenant_owner';
```

### Pattern 2: Promote User to Admin

```sql
-- Promote existing member to tenant_admin
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    'user-uuid-here'::text,
    r.id,
    'tenant-id-here'::text
FROM roles r
WHERE r.name = 'tenant_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

### Pattern 3: Demote User (Remove Role)

```sql
-- Remove a role from a user
DELETE FROM user_roles
WHERE user_id = 'user-uuid-here'::text
  AND role_id = (SELECT id FROM roles WHERE name = 'tenant_admin')
  AND tenant_id = 'tenant-id-here'::text;
```

## Managing Custom Roles

### Create Custom Role

```sql
-- Create a new custom role
INSERT INTO roles (name, description, permissions)
VALUES (
    'content_manager',
    'Can manage content and workflows',
    '["data.read", "data.create", "data.update", "workflows.execute"]'::jsonb
)
RETURNING *;
```

### Update Role Permissions

```sql
-- Update permissions for an existing role
UPDATE roles
SET permissions = '["data.read", "data.create", "data.update", "data.delete"]'::jsonb,
    description = 'Updated description'
WHERE name = 'content_manager'
RETURNING *;
```

## Troubleshooting

### Issue: Role assignment fails with foreign key constraint

**Problem**: `ERROR: insert or update on table "user_roles" violates foreign key constraint`

**Solutions**:

1. Verify the user exists: `SELECT id FROM auth.users WHERE id = 'user-uuid-here';`
2. Verify the role exists: `SELECT id FROM roles WHERE name = 'role-name';`
3. Verify the tenant exists (if using tenant_id): `SELECT id FROM tenants WHERE id = 'tenant-id';`

### Issue: Cannot see roles assigned

**Problem**: Roles are assigned but not appearing in queries

**Solutions**:

1. Check RLS policies are not blocking access
2. Use service_role key for admin operations
3. Verify you're querying the correct user_id format (UUID vs text)

### Issue: Duplicate key value violates unique constraint

**Problem**: `ERROR: duplicate key value violates unique constraint "user_roles_pkey"`

**Solution**: The user already has this role. Use `ON CONFLICT DO NOTHING` or check existing roles first.

## Security Best Practices

1. **Principle of Least Privilege**: Assign minimum necessary permissions
2. **Regular Audits**: Review role assignments quarterly
3. **Tenant Isolation**: Always specify tenant_id for non-system roles
4. **Audit Logging**: Log all role assignment changes
5. **Use Transactions**: Wrap multiple role assignments in transactions

## Next Steps

After assigning roles:

1. Test the permissions in your application
2. Verify RLS policies respect the roles
3. Check audit logs for role assignments
4. Document which users have which roles
5. Set up monitoring for permission denials

## Related Documentation

- [RBAC Implementation Guide](./rbac-guide.md)
- [Security Audit Guide](./SECURITY_AUDIT.md)
- [Permission System Documentation](./permissions.md)

## Example: Complete User Onboarding Flow

```sql
-- Complete example: Create tenant, add user, assign roles
BEGIN;

-- 1. Create tenant
INSERT INTO tenants (id, name, status)
VALUES ('acme-corp', 'ACME Corporation', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Get the user ID (assuming user exists in auth.users)
-- User ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890

-- 3. Link user to tenant
INSERT INTO user_tenants (tenant_id, user_id, role)
VALUES ('acme-corp', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'owner');

-- 4. Assign tenant_owner role
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::text,
    id,
    'acme-corp'
FROM roles
WHERE name = 'tenant_owner';

-- 5. Verify
SELECT
    u.email,
    ut.role AS tenant_role,
    r.name AS system_role,
    r.permissions
FROM user_tenants ut
JOIN auth.users u ON u.id::text = ut.user_id
LEFT JOIN user_roles ur ON ur.user_id = ut.user_id AND ur.tenant_id = ut.tenant_id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE ut.user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

COMMIT;
```
