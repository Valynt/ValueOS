-- ============================================================================
-- RBAC Quick Demo Script
-- ============================================================================
-- This script demonstrates role assignment with a complete working example
-- Run this in Supabase SQL Editor: http://localhost:54323
--
-- What this script does:
-- 1. Creates a demo user (if needed)
-- 2. Creates a demo tenant
-- 3. Assigns roles to the user
-- 4. Demonstrates permission checking
-- 5. Shows you the results
-- ============================================================================

\echo '==========================================';
\echo 'RBAC Quick Demo';
\echo '==========================================';
\echo '';

-- ============================================================================
-- PART 1: Setup Demo Data
-- ============================================================================

\echo '📋 Part 1: Setting up demo data...';

-- Create demo tenant
DO $$
BEGIN
    INSERT INTO tenants (id, name, status)
    VALUES ('demo-tenant', 'Demo Tenant', 'active')
    ON CONFLICT (id) DO UPDATE
    SET name = 'Demo Tenant', status = 'active';

    RAISE NOTICE '✓ Demo tenant created: demo-tenant';
END $$;

-- Get or create a demo user
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'demo@valueos.local';
BEGIN
    -- Try to find existing user
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email;

    IF v_user_id IS NULL THEN
        -- Create the demo user
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            v_email,
            crypt('demo123', gen_salt('bf')),  -- Simple password for demo
            NOW(),
            NOW(),
            NOW()
        )
        RETURNING id INTO v_user_id;

        RAISE NOTICE '✓ Created demo user: %', v_user_id;
    ELSE
        RAISE NOTICE '✓ Demo user found: %', v_user_id;
    END IF;
END $$;

\echo '';

-- ============================================================================
-- PART 2: Show Available Users and Roles
-- ============================================================================

\echo '📋 Part 2: Available users and roles';
\echo '';
\echo '👤 Users in your system:';

SELECT
    id,
    email,
    created_at,
    email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

\echo '';
\echo '🎭 Available roles:';

SELECT
    name,
    description,
    permissions
FROM roles
ORDER BY name;

\echo '';

-- ============================================================================
-- PART 3: Assign Roles
-- ============================================================================

\echo '📋 Part 3: Assigning roles...';

-- Assign tenant_admin role to first user
DO $$
DECLARE
    v_user_id TEXT;
    v_role_id UUID;
    v_inserted INTEGER := 0;
BEGIN
    -- Get first user
    SELECT id::text INTO v_user_id
    FROM auth.users
    ORDER BY created_at
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE '⚠ No users found. Please create a user first.';
        RETURN;
    END IF;

    -- Get tenant_admin role
    SELECT id INTO v_role_id
    FROM roles
    WHERE name = 'tenant_admin';

    IF v_role_id IS NULL THEN
        RAISE NOTICE '⚠ tenant_admin role not found. Please run migrations.';
        RETURN;
    END IF;

    -- Assign role
    INSERT INTO user_roles (user_id, role_id, tenant_id)
    VALUES (v_user_id, v_role_id, 'demo-tenant')
    ON CONFLICT (user_id, role_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted > 0 THEN
        RAISE NOTICE '✓ Assigned tenant_admin role to user %', v_user_id;
    ELSE
        RAISE NOTICE '↷ User % already has tenant_admin role', v_user_id;
    END IF;

    -- Also link user to tenant
    INSERT INTO user_tenants (tenant_id, user_id, role)
    VALUES ('demo-tenant', v_user_id, 'admin')
    ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = 'admin';

    RAISE NOTICE '✓ Linked user to demo-tenant';
END $$;

\echo '';

-- ============================================================================
-- PART 4: Verify Role Assignments
-- ============================================================================

\echo '📋 Part 4: Current role assignments';
\echo '';
\echo '✅ Roles assigned to users:';

SELECT
    u.email AS user_email,
    u.id AS user_id,
    r.name AS role_name,
    r.description,
    ur.tenant_id,
    t.name AS tenant_name,
    ur.created_at AS assigned_at
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN tenants t ON t.id = ur.tenant_id
ORDER BY ur.created_at DESC
LIMIT 10;

\echo '';

-- ============================================================================
-- PART 5: Permission Analysis
-- ============================================================================

\echo '📋 Part 5: Permission analysis';
\echo '';
\echo '🔑 Permissions by user:';

SELECT
    u.email,
    r.name AS role_name,
    jsonb_array_elements_text(r.permissions) AS permission,
    ur.tenant_id,
    CASE
        WHEN jsonb_array_elements_text(r.permissions) = '*' THEN 'FULL ACCESS'
        WHEN jsonb_array_elements_text(r.permissions) LIKE '%.*' THEN 'WILDCARD'
        ELSE 'SPECIFIC'
    END AS permission_type
FROM user_roles ur
JOIN auth.users u ON u.id::text = ur.user_id
JOIN roles r ON r.id = ur.role_id
ORDER BY u.email, r.name;

\echo '';

-- ============================================================================
-- PART 6: Test Permission Checking
-- ============================================================================

\echo '📋 Part 6: Testing permission checks';

-- Create a test function if it doesn't exist
CREATE OR REPLACE FUNCTION check_permission(
    p_user_id TEXT,
    p_permission TEXT,
    p_tenant_id TEXT DEFAULT NULL
)
RETURNS TABLE(
    has_permission BOOLEAN,
    granted_by TEXT,
    via_role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE as has_permission,
        CASE
            WHEN r.permissions ? '*' THEN 'Full Access (*)'
            WHEN r.permissions ? split_part(p_permission, '.', 1) || '.*'
                THEN 'Wildcard (' || split_part(p_permission, '.', 1) || '.*)'
            ELSE 'Direct Permission'
        END as granted_by,
        r.name as via_role
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND (p_tenant_id IS NULL OR ur.tenant_id = p_tenant_id OR ur.tenant_id IS NULL)
      AND (
          r.permissions ? p_permission
          OR r.permissions ? split_part(p_permission, '.', 1) || '.*'
          OR r.permissions ? '*'
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

\echo '';
\echo '🧪 Testing permissions for first user:';

-- Test permissions for the first user
DO $$
DECLARE
    v_user_id TEXT;
    v_result RECORD;
BEGIN
    -- Get first user
    SELECT id::text INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE '⚠ No users found';
        RETURN;
    END IF;

    -- Test various permissions
    RAISE NOTICE 'Testing permissions for user: %', v_user_id;
    RAISE NOTICE '';

    -- Test 1: tenant.read
    SELECT * INTO v_result FROM check_permission(v_user_id, 'tenant.read', 'demo-tenant');
    IF v_result.has_permission THEN
        RAISE NOTICE '✓ Has permission: tenant.read (via: %)', v_result.via_role;
    ELSE
        RAISE NOTICE '✗ Does NOT have permission: tenant.read';
    END IF;

    -- Test 2: tenant.write
    SELECT * INTO v_result FROM check_permission(v_user_id, 'tenant.write', 'demo-tenant');
    IF v_result.has_permission THEN
        RAISE NOTICE '✓ Has permission: tenant.write (via: %)', v_result.via_role;
    ELSE
        RAISE NOTICE '✗ Does NOT have permission: tenant.write';
    END IF;

    -- Test 3: tenant.delete
    SELECT * INTO v_result FROM check_permission(v_user_id, 'tenant.delete', 'demo-tenant');
    IF v_result.has_permission THEN
        RAISE NOTICE '✓ Has permission: tenant.delete (via: %)', v_result.via_role;
    ELSE
        RAISE NOTICE '✗ Does NOT have permission: tenant.delete';
    END IF;

    -- Test 4: security.read
    SELECT * INTO v_result FROM check_permission(v_user_id, 'security.read');
    IF v_result.has_permission THEN
        RAISE NOTICE '✓ Has permission: security.read (via: %)', v_result.via_role;
    ELSE
        RAISE NOTICE '✗ Does NOT have permission: security.read';
    END IF;

END $$;

\echo '';

-- ============================================================================
-- PART 7: Summary
-- ============================================================================

\echo '📋 Part 7: Summary';
\echo '';

SELECT
    'Summary' AS section,
    (SELECT COUNT(*) FROM roles) AS total_roles,
    (SELECT COUNT(*) FROM user_roles) AS total_assignments,
    (SELECT COUNT(DISTINCT user_id) FROM user_roles) AS users_with_roles,
    (SELECT COUNT(*) FROM auth.users) AS total_users;

\echo '';
\echo '==========================================';
\echo '✅ Demo Complete!';
\echo '==========================================';
\echo '';
\echo 'What was demonstrated:';
\echo '  1. Created demo tenant';
\echo '  2. Listed available users and roles';
\echo '  3. Assigned tenant_admin role to user';
\echo '  4. Verified role assignments';
\echo '  5. Analyzed permissions';
\echo '  6. Tested permission checking';
\echo '';
\echo 'Next steps:';
\echo '  • Review the assigned roles above';
\echo '  • Test in your application';
\echo '  • Assign roles to more users';
\echo '  • See ASSIGN_ROLES_GUIDE.md for more details';
\echo '';

-- ============================================================================
-- CLEANUP (Optional - Uncomment to remove demo data)
-- ============================================================================

/*
\echo 'Cleaning up demo data...';

-- Remove demo role assignments
DELETE FROM user_roles WHERE tenant_id = 'demo-tenant';

-- Remove demo user-tenant links
DELETE FROM user_tenants WHERE tenant_id = 'demo-tenant';

-- Remove demo tenant
DELETE FROM tenants WHERE id = 'demo-tenant';

-- Drop test function
DROP FUNCTION IF EXISTS check_permission(TEXT, TEXT, TEXT);

\echo '✓ Demo data cleaned up';
*/

-- ============================================================================
-- TO USE THIS DEMO:
-- ============================================================================
-- 1. Copy this entire script
-- 2. Open Supabase Dashboard: http://localhost:54323
-- 3. Go to SQL Editor
-- 4. Paste and click Run
-- 5. Review the output in the Results panel
-- ============================================================================
