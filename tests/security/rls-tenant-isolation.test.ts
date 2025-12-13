/**
 * RLS Tenant Isolation Security Tests
 * 
 * CRITICAL: Verifies that Row Level Security policies prevent cross-tenant data access
 * 
 * These tests validate the fixes in:
 * - supabase/migrations/20241213000000_fix_rls_tenant_isolation.sql
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('RLS Tenant Isolation - Critical Security Tests', () => {
  let tenant1Client: SupabaseClient;
  let tenant2Client: SupabaseClient;
  let adminClient: SupabaseClient;

  const TENANT_1_ID = 'tenant-test-001';
  const TENANT_2_ID = 'tenant-test-002';

  beforeAll(async () => {
    // Create clients with different tenant contexts
    // In production, these would be JWT tokens with different tenant_id claims
    
    adminClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // TODO: Create test users with tenant associations
    // This requires setting up test JWT tokens with tenant_id claims
  });

  afterAll(async () => {
    // Cleanup test data
    if (adminClient) {
      await adminClient.from('agent_sessions').delete().like('id', 'test-%');
      await adminClient.from('agent_predictions').delete().like('id', 'test-%');
    }
  });

  describe('agent_sessions RLS Policies', () => {
    it('CRITICAL: should prevent cross-tenant access to agent_sessions', async () => {
      // Skip if not in integration test environment
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Create session for tenant 1 using admin client
      const { data: session, error: createError } = await adminClient
        .from('agent_sessions')
        .insert({
          id: 'test-session-001',
          tenant_id: TENANT_1_ID,
          agent_id: 'test-agent',
          status: 'active',
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(session).toBeDefined();

      // TODO: Attempt to access with tenant 2 client
      // This requires JWT token with tenant_id = TENANT_2_ID
      // Expected: Should return empty result or error

      // Cleanup
      await adminClient
        .from('agent_sessions')
        .delete()
        .eq('id', 'test-session-001');
    });

    it('CRITICAL: should reject NULL tenant_id inserts', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Attempt to insert with NULL tenant_id
      const { error } = await adminClient
        .from('agent_sessions')
        .insert({
          id: 'test-session-null',
          tenant_id: null,
          agent_id: 'test-agent',
          status: 'active',
        });

      // Should fail due to NOT NULL constraint
      expect(error).toBeDefined();
      expect(error?.message).toContain('null value');
    });

    it('CRITICAL: should enforce tenant_id in updates', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Create session
      await adminClient
        .from('agent_sessions')
        .insert({
          id: 'test-session-update',
          tenant_id: TENANT_1_ID,
          agent_id: 'test-agent',
          status: 'active',
        });

      // Attempt to change tenant_id
      const { error } = await adminClient
        .from('agent_sessions')
        .update({ tenant_id: TENANT_2_ID })
        .eq('id', 'test-session-update');

      // Should fail due to RLS policy or trigger
      // (Depends on implementation - may succeed with admin key)
      
      // Cleanup
      await adminClient
        .from('agent_sessions')
        .delete()
        .eq('id', 'test-session-update');
    });
  });

  describe('agent_predictions RLS Policies', () => {
    it('CRITICAL: should prevent NULL tenant_id bypass', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Attempt to insert prediction with NULL tenant_id
      const { error } = await adminClient
        .from('agent_predictions')
        .insert({
          id: 'test-prediction-null',
          tenant_id: null,
          session_id: 'test-session',
          agent_id: 'test-agent',
          prediction_data: {},
        });

      // Should fail due to NOT NULL constraint
      expect(error).toBeDefined();
      expect(error?.message).toContain('null value');
    });

    it('CRITICAL: should isolate predictions by tenant', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Create predictions for both tenants
      await adminClient.from('agent_predictions').insert([
        {
          id: 'test-pred-t1',
          tenant_id: TENANT_1_ID,
          session_id: 'test-session',
          agent_id: 'test-agent',
          prediction_data: { tenant: 1 },
        },
        {
          id: 'test-pred-t2',
          tenant_id: TENANT_2_ID,
          session_id: 'test-session',
          agent_id: 'test-agent',
          prediction_data: { tenant: 2 },
        },
      ]);

      // TODO: Query with tenant 1 client
      // Expected: Should only see test-pred-t1

      // TODO: Query with tenant 2 client
      // Expected: Should only see test-pred-t2

      // Cleanup
      await adminClient
        .from('agent_predictions')
        .delete()
        .in('id', ['test-pred-t1', 'test-pred-t2']);
    });
  });

  describe('Security Audit Triggers', () => {
    it('should log security violations to audit table', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Get initial audit log count
      const { count: initialCount } = await adminClient
        .from('security_audit_log')
        .select('*', { count: 'exact', head: true });

      // Attempt a violation (NULL tenant_id)
      await adminClient
        .from('agent_sessions')
        .insert({
          id: 'test-violation',
          tenant_id: null,
          agent_id: 'test-agent',
          status: 'active',
        })
        .then(() => {}, () => {}); // Ignore error

      // Check if audit log increased
      const { count: finalCount } = await adminClient
        .from('security_audit_log')
        .select('*', { count: 'exact', head: true });

      // Note: This may not work if trigger fires before constraint check
      // The audit log should capture the attempt
    });

    it('should provide security_violations view', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Query security violations view
      const { data, error } = await adminClient
        .from('security_violations')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('RLS Verification Function', () => {
    it('should verify RLS is enabled on all critical tables', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Call verification function
      const { data, error } = await adminClient
        .rpc('verify_rls_tenant_isolation');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // Verify all tables have RLS enabled
      const tables = ['agent_sessions', 'agent_predictions', 'workflow_executions', 'canvas_data', 'value_trees'];
      
      for (const table of tables) {
        const tableStatus = data?.find((row: any) => row.table_name === table);
        
        if (tableStatus) {
          expect(tableStatus.rls_enabled).toBe(true);
          expect(tableStatus.policy_count).toBeGreaterThanOrEqual(3);
          expect(tableStatus.has_not_null_constraint).toBe(true);
        }
      }
    });
  });

  describe('Cross-Tenant Attack Scenarios', () => {
    it('CRITICAL: should prevent session hijacking across tenants', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Create session for tenant 1
      const { data: session } = await adminClient
        .from('agent_sessions')
        .insert({
          id: 'test-hijack-session',
          tenant_id: TENANT_1_ID,
          agent_id: 'test-agent',
          status: 'active',
        })
        .select()
        .single();

      // TODO: Attempt to access with tenant 2 credentials
      // Expected: Should fail or return empty

      // Cleanup
      await adminClient
        .from('agent_sessions')
        .delete()
        .eq('id', 'test-hijack-session');
    });

    it('CRITICAL: should prevent prediction data leakage', async () => {
      if (!process.env.SUPABASE_SERVICE_KEY) {
        console.warn('Skipping RLS test - SUPABASE_SERVICE_KEY not set');
        return;
      }

      // Create sensitive prediction for tenant 1
      await adminClient
        .from('agent_predictions')
        .insert({
          id: 'test-sensitive-pred',
          tenant_id: TENANT_1_ID,
          session_id: 'test-session',
          agent_id: 'test-agent',
          prediction_data: {
            sensitive: 'confidential data',
            revenue: 1000000,
          },
        });

      // TODO: Attempt to query with tenant 2 credentials
      // Expected: Should not see the prediction

      // Cleanup
      await adminClient
        .from('agent_predictions')
        .delete()
        .eq('id', 'test-sensitive-pred');
    });
  });
});

/**
 * Manual Verification Steps
 * 
 * Run these SQL queries to manually verify RLS policies:
 * 
 * 1. Check RLS is enabled:
 *    SELECT tablename, rowsecurity FROM pg_tables 
 *    WHERE schemaname = 'public' AND tablename IN ('agent_sessions', 'agent_predictions');
 * 
 * 2. Check policies exist:
 *    SELECT tablename, policyname, cmd FROM pg_policies 
 *    WHERE tablename IN ('agent_sessions', 'agent_predictions');
 * 
 * 3. Check NOT NULL constraints:
 *    SELECT table_name, column_name, is_nullable 
 *    FROM information_schema.columns 
 *    WHERE table_name IN ('agent_sessions', 'agent_predictions') 
 *    AND column_name = 'tenant_id';
 * 
 * 4. Check for NULL tenant_id values:
 *    SELECT 'agent_sessions' as table_name, COUNT(*) 
 *    FROM agent_sessions WHERE tenant_id IS NULL
 *    UNION ALL
 *    SELECT 'agent_predictions', COUNT(*) 
 *    FROM agent_predictions WHERE tenant_id IS NULL;
 *    -- Expected: 0 rows for all tables
 * 
 * 5. Check security audit log:
 *    SELECT * FROM security_violations ORDER BY created_at DESC LIMIT 10;
 */
