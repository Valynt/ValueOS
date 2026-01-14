-- ValueOS RBAC Local Testing Script
-- This script helps you test role assignments and permissions locally
-- Run this in Supabase SQL Editor (http://localhost:54323)

-- =============================================================================
-- SETUP: Create Test Data
-- =============================================================================

BEGIN;

-- Clean up any existing test data (optional)
DELETE FROM user_roles WHERE tenant_id LIKE 'test-%';
DELETE FROM user_tenants WHERE tenant_id LIKE 'test-%';
DELETE FROM tenants WHERE id LIKE 'test-%';

-- Create test tenant
INSERT INTO tenants (id, name, status)
VALUES 
    ('test-tenant-1', 'Test Tenant One', 'active'),
    ('test-tenant-2', 'Test Tenant Two', 'active')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, status = EXCLUDED.status;

COMMIT;

-- =============================================================================
-- STEP 1: View Available Roles
-- =============================================================================

SELECT 
    id,
    name,
    description,
    permissions,
    created_at
FROM roles
ORDER BY name;

-- Expected output: system_admin, security_admin, tenant_owner, tenant_admin

-- =============================================================================
-- STEP 2: View Current Users
-- =============================================================================

SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    -- Show if user has any roles
    (SELECT COUNT(*) FROM user_roles WHERE user_id = auth.users.id::text) AS role_count
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================================
-- STEP 3: Assign Roles to Users
-- =============================================================================

-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with an actual user ID from Step 2
-- Example user ID format: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

-- Test 1: Assign tenant_admin role to first user
DO $$
DECLARE
    v_user_id TEXT;
    v_role_id UUID;
BEGIN
    -- Get the first user (or manually set your user ID)
    SELECT id::text INTO v_user_id 
    FROM auth.users 
    ORDER BY created_at 
    LIMIT 1;
    
    -- Get tenant_admin role ID
    SELECT id INTO v_role_id 
    FROM roles 
    WHERE name = 'tenant_admin';
    
    -- Assign role
    IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id, tenant_id)
        VALUES (v_user_id, v_role_id, 'test-tenant-1')
        ON CONFLICT (user_id, role_id) DO NOTHING;
        
        RAISE NOTICE 'Assigned tenant_admin role to user % for tenant test-tenant-1', v_user_id;
    ELSE
        RAISE NOTICE 'No users found or role does not exist';
    END IF;
END $$;

-- Test 2: Assign system_admin role (global, no tenant)
DO $$
DECLARE
    v_user_id TEXT;
    v_role_id UUID;
BEGIN
    -- Get the first user
    SELECT id::text INTO v_user_id 
    FROM auth.users 
    ORDER BY created_at 
    LIMIT 1;
    
    -- Get system_admin role ID
    SELECT id INTO v_role_id 
    FROM roles 
    WHERE name = 'system_admin';
    
    -- Assign role
    IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id, tenant_id)
        VALUES (v_user_id, v_role_id, NULL)
        ON CONFLICT (user_id, role_id) DO NOTHING;
        
        RAISE NOTICE 'Assigned system_admin role to user % (global)', v_user_id;
    ELSE
        RAISE NOTICE 'No users found or role does not exist';
    END IF;
END $$;

-- =============================================================================
-- STEP 4: Verify Role Assignments
-- =============================================================================

-- View all role assignments with user details
SELECT 
    u.email,
    ur.user_id,
    r.name AS role_name,
    r.description AS role_description,
    r.permissions,
    ur.tenant_id,
    t.name AS tenant_name,
    ur.created_at AS assigned_at
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN tenants t ON t.id = ur.tenant_id
ORDER BY ur.created_at DESC;

-- =============================================================================
-- STEP 5: Test Permission Checks
-- =============================================================================

-- Function to check if a user has a specific permission
-- Returns: permission breakdown for a user
SELECT 
    ur.user_id,
    u.email,
    r.name AS role_name,
    jsonb_array_elements_text(r.permissions) AS permission,
    ur.tenant_id,
    CASE 
        WHEN jsonb_array_elements_text(r.permissions) = '*' THEN 'FULL ACCESS'
        WHEN jsonb_array_elements_text(r.permissions) LIKE '%.%' THEN 'SPECIFIC PERMISSION'
        WHEN jsonb_array_elements_text(r.permissions) LIKE '%.*' THEN 'WILDCARD PERMISSION'
        ELSE 'CUSTOM'
    END AS permission_type
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
ORDER BY u.email, r.name;

-- =============================================================================
-- STEP 6: Test User-Tenant Relationships
-- =============================================================================

-- Ensure users are linked to tenants via user_tenants table
-- This is separate from user_roles and required for RLS policies
DO $$
DECLARE
    v_user_id TEXT;
BEGIN
    -- Get the first user
    SELECT id::text INTO v_user_id 
    FROM auth.users 
    ORDER BY created_at 
    LIMIT 1;
    
    -- Add user to tenant
    IF v_user_id IS NOT NULL THEN
        INSERT INTO user_tenants (tenant_id, user_id, role)
        VALUES 
            ('test-tenant-1', v_user_id, 'admin'),
            ('test-tenant-2', v_user_id, 'member')
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
        
        RAISE NOTICE 'Added user % to test tenants', v_user_id;
    END IF;
END $$;

-- Verify user-tenant links
SELECT 
    u.email,
    ut.tenant_id,
    t.name AS tenant_name,
    ut.role AS tenant_role,
    ut.created_at
FROM user_tenants ut
JOIN auth.users u ON u.id::text = ut.user_id
JOIN tenants t ON t.id = ut.tenant_id
WHERE ut.tenant_id LIKE 'test-%'
ORDER BY u.email, ut.tenant_id;

-- =============================================================================
-- STEP 7: Test RLS Policies
-- =============================================================================

-- Test if RLS allows the user to see their tenant data
-- This simulates what happens when a user makes a request
DO $$
DECLARE
    v_user_id UUID;
    v_tenant_count INTEGER;
BEGIN
    -- Get first user ID
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Set the session to act as this user
        PERFORM set_config('request.jwt.claims', json_build_object(
            'sub', v_user_id::text,
            'role', 'authenticated'
        )::text, true);
        
        -- Try to count tenants the user can see
        SELECT COUNT(*) INTO v_tenant_count
        FROM tenants
        WHERE id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = v_user_id::text
        );
        
        RAISE NOTICE 'User % can see % tenants', v_user_id, v_tenant_count;
    END IF;
END $$;

-- =============================================================================
-- STEP 8: Permission Testing Examples
-- =============================================================================

-- Create a helper function to test if user has permission
-- This simulates the backend permission check
CREATE OR REPLACE FUNCTION test_user_permission(
    p_user_id TEXT,
    p_permission TEXT,
    p_tenant_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN := FALSE;
BEGIN
    -- Check if user has the exact permission or wildcard
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND (
              -- Exact match
              r.permissions ? p_permission
              -- Wildcard match (e.g., "tenant.*" matches "tenant.read")
              OR r.permissions ? split_part(p_permission, '.', 1) || '.*'
              -- Full access
              OR r.permissions ? '*'
          )
          AND (p_tenant_id IS NULL OR ur.tenant_id = p_tenant_id OR ur.tenant_id IS NULL)
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Test the permission function
DO $$
DECLARE
    v_user_id TEXT;
    v_can_read BOOLEAN;
    v_can_delete BOOLEAN;
    v_is_admin BOOLEAN;
BEGIN
    -- Get first user
    SELECT id::text INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Test various permissions
        v_can_read := test_user_permission(v_user_id, 'tenant.read', 'test-tenant-1');
        v_can_delete := test_user_permission(v_user_id, 'tenant.delete', 'test-tenant-1');
        v_is_admin := test_user_permission(v_user_id, '*');
        
        RAISE NOTICE 'User %:', v_user_id;
        RAISE NOTICE '  Can read tenant: %', v_can_read;
        RAISE NOTICE '  Can delete tenant: %', v_can_delete;
        RAISE NOTICE '  Is system admin: %', v_is_admin;
    END IF;
END $$;

-- =============================================================================
-- STEP 9: Advanced Testing - Multiple Role Assignment
-- =============================================================================

-- Assign multiple roles to demonstrate permission aggregation
DO $$
DECLARE
    v_user_id TEXT;
    v_admin_role_id UUID;
    v_security_role_id UUID;
BEGIN
    SELECT id::text INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'tenant_admin';
    SELECT id INTO v_security_role_id FROM roles WHERE name = 'security_admin';
    
    IF v_user_id IS NOT NULL THEN
        -- Assign both roles
        INSERT INTO user_roles (user_id, role_id, tenant_id)
        VALUES 
            (v_user_id, v_admin_role_id, 'test-tenant-1'),
            (v_user_id, v_security_role_id, NULL)
        ON CONFLICT (user_id, role_id) DO NOTHING;
        
        RAISE NOTICE 'Assigned multiple roles to user %', v_user_id;
    END IF;
END $$;

-- View aggregated permissions for user
SELECT 
    ur.user_id,
    u.email,
    array_agg(DISTINCT r.name) AS roles,
    array_agg(DISTINCT jsonb_array_elements_text(r.permissions)) AS all_permissions
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
GROUP BY ur.user_id, u.email;

-- =============================================================================
-- STEP 10: Clean-Up Test Data (Optional)
-- =============================================================================

-- Uncomment to clean up test data after testing
/*
BEGIN;

-- Remove test role assignments
DELETE FROM user_roles WHERE tenant_id LIKE 'test-%';

-- Remove test user-tenant links
DELETE FROM user_tenants WHERE tenant_id LIKE 'test-%';

-- Remove test tenants
DELETE FROM tenants WHERE id LIKE 'test-%';

-- Drop test function
DROP FUNCTION IF EXISTS test_user_permission(TEXT, TEXT, TEXT);

COMMIT;

SELECT 'Test data cleaned up successfully' AS status;
*/

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT 
    'RBAC Test Summary' AS section,
    (SELECT COUNT(*) FROM roles) AS total_roles,
    (SELECT COUNT(*) FROM user_roles) AS total_role_assignments,
    (SELECT COUNT(DISTINCT user_id) FROM user_roles) AS users_with_roles,
    (SELECT COUNT(*) FROM tenants WHERE id LIKE 'test-%') AS test_tenants_created;

-- =============================================================================
-- NEXT STEPS
-- =============================================================================

/*
After running this test script:

1. ✅ Verify all role assignments appear in the output
2. ✅ Test the test_user_permission function with different permissions
3. ✅ Check that RLS policies respect the role assignments
4. ✅ Try accessing data through your application with different user roles
5. ✅ Review the security audit logs for any permission denials
6. ✅ Clean up test data when finished (uncomment Step 10)

Troubleshooting:
- If no users are found, create a test user first via Supabase Auth
- If roles don't exist, check that migrations have been applied
- If RLS blocks queries, ensure you're using the correct JWT claims

For production use:
- Replace test data with actual user IDs
- Remove the test tenant prefix
- Set appropriate tenant context
- Enable audit logging for all role changes
*/

SELECT 'RBAC Local Testing Script Complete! Review the output above.' AS status;
