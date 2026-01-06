#!/bin/bash
# Setup Test Environment
# Purpose: Configure tests to use local Supabase and seed test data

set -e

echo "🔧 Setting up test environment..."
echo "=================================="

# Use local Supabase for tests
export VITE_SUPABASE_URL="http://localhost:54321"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"

echo "✅ Environment configured for local Supabase"
echo ""

# Check if Supabase is running
echo "🔍 Checking Supabase connection..."
if curl -s http://localhost:54321/rest/v1/ -H "apikey: $VITE_SUPABASE_ANON_KEY" > /dev/null 2>&1; then
  echo "✅ Supabase is running"
else
  echo "❌ ERROR: Supabase is not running"
  echo "Please start Supabase with: supabase start"
  exit 1
fi

echo ""
echo "🌱 Seeding test data..."
echo "=================================="

# Seed test data using psql
psql "$DATABASE_URL" <<EOF
-- Ensure tenants table exists and has test data
INSERT INTO tenants (id, name, status, data_region)
VALUES 
  ('test-tenant-1', 'Test Tenant 1', 'active', 'us'),
  ('test-tenant-2', 'Test Tenant 2', 'active', 'us')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status;

-- Create test users in auth.users table
-- Delete existing test users first
DELETE FROM auth.users WHERE email IN ('tenant1-user@example.com', 'tenant2-user@example.com');

-- Insert test users with proper UUIDs
WITH user1 AS (
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role
  )
  VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'tenant1-user@example.com',
    crypt('test-password-123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  )
  RETURNING id
),
user2 AS (
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role
  )
  VALUES (
    '22222222-2222-2222-2222-222222222222'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'tenant2-user@example.com',
    crypt('test-password-123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  )
  RETURNING id
)
-- Link users to tenants
INSERT INTO user_tenants (user_id, tenant_id, role, status)
SELECT id, 'test-tenant-1', 'member', 'active' FROM user1
UNION ALL
SELECT id, 'test-tenant-2', 'member', 'active' FROM user2
ON CONFLICT (user_id, tenant_id) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- Ensure user_tenants table has proper structure
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_tenants' AND column_name='role') THEN
    ALTER TABLE user_tenants ADD COLUMN role TEXT DEFAULT 'member';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_tenants' AND column_name='status') THEN
    ALTER TABLE user_tenants ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END \$\$;

-- Verify tables exist
SELECT 'Tables check:' as status;
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'cases', 'messages', 'security_audit_events', 'user_tenants')
ORDER BY tablename;

-- Verify test tenants
SELECT 'Test tenants:' as status;
SELECT id, name FROM tenants WHERE id LIKE 'test-tenant-%';

EOF

echo ""
echo "✅ Test data seeded successfully"
echo ""
echo "=================================="
echo "✅ Test environment ready!"
echo ""
echo "You can now run tests with:"
echo "  npm test -- tests/compliance --run"
echo ""
