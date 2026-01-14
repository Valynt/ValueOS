-- tests/database/negative_rls_check.test.sql
-- Negative RLS Verification: Ensure tenant separation

BEGIN;
SELECT plan(6); -- Number of tests

-- Setup: Create two tenants
INSERT INTO organizations (id, name) VALUES ('tenant_a', 'Tenant A'), ('tenant_b', 'Tenant B');

-- Setup: Create a case for Tenant A
INSERT INTO cases (id, organization_id, title) VALUES ('case_a', 'tenant_a', 'Private Case A');

-- Test 1: Tenant B cannot SELECT Tenant A's case
SET LOCAL "request.jwt.claims" = '{"sub": "user_b", "role": "authenticated", "app_metadata": {"organization_id": "tenant_b"}}';
SELECT is_empty(
    $$ SELECT * FROM cases WHERE id = 'case_a' $$,
    'Tenant B should not be able to see Tenant A''s case'
);

-- Test 2: Tenant B cannot UPDATE Tenant A's case
SELECT lives_ok(
    $$ UPDATE cases SET title = 'Hacked' WHERE id = 'case_a' $$,
    'Update attempt should not crash but should affect 0 rows (checked next)'
);
SELECT results_eq(
    $$ SELECT title FROM cases WHERE id = 'case_a' $$,
    $$ VALUES ('Private Case A') $$,
    'Tenant B should not have modified Tenant A''s case title'
);

-- Test 3: Tenant B cannot DELETE Tenant A's case
SELECT lives_ok(
    $$ DELETE FROM cases WHERE id = 'case_a' $$,
    'Delete attempt should not crash'
);
SELECT results_eq(
    $$ SELECT count(*) FROM cases WHERE id = 'case_a' $$,
    $$ VALUES (1::bigint) $$,
    'Tenant A''s case should still exist'
);

-- Test 4: Tenant A can see their own case
SET LOCAL "request.jwt.claims" = '{"sub": "user_a", "role": "authenticated", "app_metadata": {"organization_id": "tenant_a"}}';
SELECT results_eq(
    $$ SELECT title FROM cases WHERE id = 'case_a' $$,
    $$ VALUES ('Private Case A') $$,
    'Tenant A should be able to see their own case'
);

SELECT * FROM finish();
ROLLBACK;
