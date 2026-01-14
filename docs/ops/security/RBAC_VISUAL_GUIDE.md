# Visual Guide: Assign Roles in Supabase Dashboard

This is a step-by-step visual guide showing exactly what to click and where in the Supabase Dashboard.

## Step-by-Step Instructions

### Step 1: Open Supabase Dashboard

**Local Development:**

```
http://localhost:54323
```

**Cloud:**

```
https://app.supabase.com
```

### Step 2: Navigate to SQL Editor

```
Dashboard Home
    └─ Left Sidebar
        └─ Click "SQL Editor" 📝
```

### Step 3: Create New Query

```
SQL Editor Page
    └─ Top Right Corner
        └─ Click "New query" button
```

### Step 4: Get Your User ID

Copy and paste this query:

```sql
-- Find your user ID
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

Click **Run** (or press Ctrl+Enter / Cmd+Enter)

**Example Output:**

```
┌──────────────────────────────────────┬─────────────────────┬────────────────────┐
│ id                                   │ email               │ created_at         │
├──────────────────────────────────────┼─────────────────────┼────────────────────┤
│ a1b2c3d4-e5f6-7890-abcd-ef1234567890 │ user@example.com    │ 2025-12-29 10:00:00│
└──────────────────────────────────────┴─────────────────────┴────────────────────┘
```

**📋 Copy the `id` value** - you'll need it in the next step!

### Step 5: Get Available Roles

Copy and paste this query:

```sql
-- View all available roles
SELECT id, name, description, permissions
FROM roles
ORDER BY name;
```

Click **Run**

**Example Output:**

```
┌──────────────────────────────────────┬────────────────┬─────────────────────┬──────────────────────┐
│ id                                   │ name           │ description         │ permissions          │
├──────────────────────────────────────┼────────────────┼─────────────────────┼──────────────────────┤
│ uuid-1                               │ system_admin   │ Full access         │ ["*"]                │
│ uuid-2                               │ security_admin │ Security access     │ ["security.*", ...]  │
│ uuid-3                               │ tenant_admin   │ Tenant admin        │ ["tenant.read", ...] │
│ uuid-4                               │ tenant_owner   │ Tenant owner        │ ["tenant.*"]         │
└──────────────────────────────────────┴────────────────┴─────────────────────┴──────────────────────┘
```

**Note which role you want to assign**

### Step 6: Assign Role to User

Replace `YOUR-USER-UUID` with the ID from Step 4:

#### For Global Roles (like system_admin):

```sql
-- Assign system_admin role
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    'YOUR-USER-UUID'::text,  -- 👈 Replace this!
    id,
    NULL  -- NULL means global/system-wide
FROM roles
WHERE name = 'system_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

#### For Tenant Roles (like tenant_admin):

First, get your tenant ID:

```sql
-- Get tenant ID
SELECT id, name FROM tenants LIMIT 5;
```

Then assign the role:

```sql
-- Assign tenant_admin role
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    'YOUR-USER-UUID'::text,     -- 👈 Replace this!
    r.id,
    'YOUR-TENANT-ID'::text      -- 👈 Replace this!
FROM roles r
WHERE r.name = 'tenant_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

Click **Run**

**Expected Result:**

```
Success. No rows returned
```

or

```
1 row inserted
```

### Step 7: Verify Role Assignment

```sql
-- Verify the role was assigned
SELECT
    u.email,
    r.name AS role_name,
    r.permissions,
    ur.tenant_id,
    ur.created_at AS assigned_at
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = 'YOUR-USER-UUID'  -- 👈 Replace this!
ORDER BY ur.created_at DESC;
```

**Expected Output:**

```
┌──────────────────┬──────────────┬─────────────────┬─────────────┬─────────────────────┐
│ email            │ role_name    │ permissions     │ tenant_id   │ assigned_at         │
├──────────────────┼──────────────┼─────────────────┼─────────────┼─────────────────────┤
│ user@example.com │ system_admin │ ["*"]           │ null        │ 2025-12-29 10:00:00 │
└──────────────────┴──────────────┴─────────────────┴─────────────┴─────────────────────┘
```

## Common Examples

### Example 1: Make User a System Administrator

```sql
-- Step 1: Get user ID
SELECT id, email FROM auth.users WHERE email = 'admin@company.com';
-- Result: a1b2c3d4-e5f6-7890-abcd-ef1234567890

-- Step 2: Assign system_admin role
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id, NULL
FROM roles WHERE name = 'system_admin'
ON CONFLICT DO NOTHING;

-- Step 3: Verify
SELECT u.email, r.name
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

### Example 2: Make User a Tenant Owner

```sql
-- Step 1: Get user ID
SELECT id, email FROM auth.users WHERE email = 'tenant.owner@company.com';
-- Result: b2c3d4e5-f6a7-8901-bcde-f12345678901

-- Step 2: Get tenant ID
SELECT id, name FROM tenants WHERE name = 'ACME Corp';
-- Result: acme-corp

-- Step 3: Assign tenant_owner role
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'b2c3d4e5-f6a7-8901-bcde-f12345678901', id, 'acme-corp'
FROM roles WHERE name = 'tenant_owner'
ON CONFLICT DO NOTHING;

-- Step 4: Also link in user_tenants table
INSERT INTO user_tenants (tenant_id, user_id, role)
VALUES ('acme-corp', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'owner')
ON CONFLICT DO NOTHING;

-- Step 5: Verify
SELECT u.email, r.name, ur.tenant_id, t.name
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN tenants t ON t.id = ur.tenant_id
WHERE ur.user_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
```

### Example 3: Assign Multiple Roles

```sql
-- Assign both tenant_admin and security_admin to a user
WITH user_info AS (
    SELECT 'c3d4e5f6-a7b8-9012-cdef-123456789012'::text AS user_id,
           'acme-corp'::text AS tenant_id
)
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
    ui.user_id,
    r.id,
    CASE
        WHEN r.name = 'security_admin' THEN NULL  -- Global
        ELSE ui.tenant_id  -- Tenant-specific
    END
FROM user_info ui
CROSS JOIN roles r
WHERE r.name IN ('tenant_admin', 'security_admin')
ON CONFLICT (user_id, role_id) DO NOTHING;
```

## Troubleshooting in Dashboard

### ❌ Error: "insert or update on table violates foreign key constraint"

**Cause:** User ID, Role ID, or Tenant ID doesn't exist

**Solution:**

1. Verify user exists: `SELECT id FROM auth.users WHERE id = 'YOUR-UUID';`
2. Verify role exists: `SELECT id FROM roles WHERE name = 'role-name';`
3. Verify tenant exists: `SELECT id FROM tenants WHERE id = 'tenant-id';`

### ❌ Error: "duplicate key value violates unique constraint"

**Cause:** User already has this role

**Solution:** This is actually OK! The user already has the role. To verify:

```sql
SELECT * FROM user_roles WHERE user_id = 'YOUR-UUID';
```

### ❌ Error: "permission denied for table"

**Cause:** Using anon key instead of service_role key

**Solution:**

1. Go to **Settings** → **API**
2. Copy the `service_role` key (not `anon` key)
3. Use service_role key for admin operations

### ⚠️ Query returns no results

**Cause:** User doesn't have any roles yet

**Solution:** This is normal for new users. Go ahead and assign a role!

## Visual Flow Chart

```
┌─────────────────────────────────────────────────────────────┐
│                   START: Assign Role                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Open Supabase Dashboard                            │
│  → http://localhost:54323 (local)                           │
│  → https://app.supabase.com (cloud)                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Navigate to SQL Editor                             │
│  → Click "SQL Editor" in left sidebar                       │
│  → Click "New query" button                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Get User ID                                        │
│  → Run: SELECT id, email FROM auth.users;                   │
│  → Copy the user's UUID                                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: View Available Roles                               │
│  → Run: SELECT * FROM roles;                                │
│  → Choose which role to assign                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Assign Role                                        │
│  → Run INSERT INTO user_roles query                         │
│  → Replace YOUR-USER-UUID with actual UUID                  │
│  → Replace YOUR-TENANT-ID if needed                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Verify Assignment                                  │
│  → Run: SELECT from user_roles JOIN ...                     │
│  → Confirm role appears in results                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Test in Application                                │
│  → Login as the user                                        │
│  → Try accessing protected features                         │
│  → Verify permissions work                                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        DONE! ✅                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Copy-Paste Template

```sql
-- RBAC ASSIGNMENT TEMPLATE
-- Replace ALL-CAPS values with your actual data

-- 1. Get User ID
SELECT id, email FROM auth.users WHERE email = 'USER-EMAIL-HERE';
-- Copy the id: __________________________________

-- 2. Get Tenant ID (if needed)
SELECT id, name FROM tenants LIMIT 5;
-- Copy the id: __________________________________

-- 3. Assign Role (choose one):

-- Option A: System Admin (Global)
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'USER-ID-HERE', id, NULL
FROM roles WHERE name = 'system_admin'
ON CONFLICT DO NOTHING;

-- Option B: Tenant Admin (Tenant-specific)
INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT 'USER-ID-HERE', id, 'TENANT-ID-HERE'
FROM roles WHERE name = 'tenant_admin'
ON CONFLICT DO NOTHING;

-- 4. Verify
SELECT u.email, r.name, ur.tenant_id
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = 'USER-ID-HERE';
```

## Next Steps

After assigning roles via dashboard:

1. ✅ Test permissions in your application
2. ✅ Review [ASSIGN_ROLES_GUIDE.md](./ASSIGN_ROLES_GUIDE.md) for more details
3. ✅ Run [rbac_local_test.sql](../../supabase/tests/rbac_local_test.sql) for automated testing
4. ✅ Check audit logs for security events

---

**Need Help?**

- Full Guide: [ASSIGN_ROLES_GUIDE.md](./ASSIGN_ROLES_GUIDE.md)
- Quick Reference: [RBAC_QUICK_REFERENCE.md](./RBAC_QUICK_REFERENCE.md)
- Testing Summary: [RBAC_TESTING_SUMMARY.md](./RBAC_TESTING_SUMMARY.md)
