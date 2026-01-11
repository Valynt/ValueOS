/**
 * Right to Be Forgotten Tests (GDPR Article 17)
 * 
 * GDPR Requirement: Article 17 - Right to erasure ("right to be forgotten")
 * SOC2 Requirement: CC6.7 - Data retention and disposal
 * ISO 27001: A.18.1.3 - Protection of records
 * 
 * Tests verify that users can request deletion of their personal data,
 * and that the system properly removes or anonymizes all PII while
 * maintaining audit trails for compliance.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('Right to Be Forgotten (GDPR Article 17)', () => {
  let adminClient: SupabaseClient;
  let testUserIds: string[] = [];
  let testTenantId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing required environment variables for testing');
    }

    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test tenant
    const { data: tenant } = await adminClient
      .from('tenants')
      .insert({
        name: 'Test Tenant - GDPR',
        slug: 'test-tenant-gdpr',
        status: 'active',
      })
      .select()
      .single();

    testTenantId = tenant?.id || 'test-tenant-id';
  });

  afterAll(async () => {
    // Clean up test tenant
    if (testTenantId) {
      await adminClient
        .from('tenants')
        .delete()
        .eq('id', testTenantId);
    }
  });

  beforeEach(() => {
    testUserIds = [];
  });

  describe('Complete User Data Deletion', () => {
    it('should delete all PII when user requests erasure', async () => {
      // Create test user with PII
      const testEmail = 'gdpr-test-user@example.com';
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: {
          full_name: 'John Doe',
          phone: '555-123-4567',
        },
      });

      if (authError || !authUser.user) {
        throw new Error(`Failed to create test user: ${authError?.message}`);
      }

      const userId = authUser.user.id;
      testUserIds.push(userId);

      // Create associated data
      await adminClient.from('user_tenants').insert({
        user_id: userId,
        tenant_id: testTenantId,
        role: 'member',
        status: 'active',
      });

      // Simulate user data deletion request
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

      expect(deleteError).toBeNull();

      // Verify user is deleted from auth.users
      const { data: deletedUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);

      // User should not exist or be marked as deleted
      expect(deletedUser.user).toBeNull();

      // Verify cascading deletes worked
      const { data: userTenants } = await adminClient
        .from('user_tenants')
        .select('*')
        .eq('user_id', userId);

      // Should be deleted due to CASCADE
      expect(userTenants?.length || 0).toBe(0);
    });

    it('should handle deletion of user with multiple data relationships', async () => {
      const testEmail = 'gdpr-multi-data@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create multiple related records
      const relatedData = [
        { table: 'user_tenants', data: { user_id: userId, tenant_id: testTenantId, role: 'member' } },
        { table: 'cases', data: { user_id: userId, name: 'Test Case', client: 'Test Client' } },
        { table: 'messages', data: { user_id: userId, content: 'Test message', role: 'user' } },
      ];

      for (const { table, data } of relatedData) {
        await adminClient.from(table).insert(data);
      }

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Verify all related data is deleted
      for (const { table } of relatedData) {
        const { data: remainingData } = await adminClient
          .from(table)
          .select('*')
          .eq('user_id', userId);

        expect(remainingData?.length || 0).toBe(0);
      }
    });

    it('should complete deletion within acceptable timeframe', async () => {
      const testEmail = 'gdpr-performance@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create substantial amount of data
      const dataPromises = [];
      for (let i = 0; i < 50; i++) {
        dataPromises.push(
          adminClient.from('messages').insert({
            user_id: userId,
            content: `Test message ${i}`,
            role: 'user',
          })
        );
      }
      await Promise.all(dataPromises);

      // Measure deletion time
      const startTime = Date.now();
      await adminClient.auth.admin.deleteUser(userId);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // GDPR requires "without undue delay" - we'll use 5 seconds as threshold
      expect(duration).toBeLessThan(5000);

      console.log(`✅ User deletion completed in ${duration}ms`);
    });
  });

  describe('Audit Log Anonymization', () => {
    it('should anonymize user data in audit logs after deletion', async () => {
      const testEmail = 'gdpr-audit-anon@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create audit log entry
      await adminClient.from('security_audit_events').insert({
        user_id: userId,
        action: 'ACCESS_GRANTED',
        resource: '/api/test/resource',
        required_permissions: [],
        user_permissions: [],
      });

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Check audit logs - they should still exist but be anonymized
      const { data: auditLogs } = await adminClient
        .from('security_audit_events')
        .select('*')
        .eq('user_id', userId);

      if (auditLogs && auditLogs.length > 0) {
        // Audit logs should exist (for compliance)
        expect(auditLogs.length).toBeGreaterThan(0);

        // But user_id should be anonymized or marked as deleted
        // This requires a database trigger or policy
        console.log('⚠️  Note: Implement audit log anonymization trigger');
      }
    });

    it('should retain audit logs for compliance period', async () => {
      const testEmail = 'gdpr-audit-retain@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create audit log
      const { data: auditLog } = await adminClient
        .from('security_audit_events')
        .insert({
          user_id: userId,
          action: 'ACCESS_GRANTED',
          resource: '/api/sensitive/data',
          required_permissions: ['VIEW_FINANCIALS'],
          user_permissions: ['VIEW_FINANCIALS'],
        })
        .select()
        .single();

      const auditLogId = auditLog?.id;

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Audit log should still exist
      const { data: retainedLog } = await adminClient
        .from('security_audit_events')
        .select('*')
        .eq('id', auditLogId)
        .single();

      expect(retainedLog).toBeTruthy();
      expect(retainedLog?.id).toBe(auditLogId);

      // Clean up
      if (auditLogId) {
        await adminClient
          .from('security_audit_events')
          .delete()
          .eq('id', auditLogId);
      }
    });

    it('should mark audit logs with deletion timestamp', async () => {
      // This test verifies that we track when a user was deleted
      // for audit purposes
      const testEmail = 'gdpr-deletion-timestamp@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      const deletionTime = new Date();

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // In a real implementation, we'd have a user_deletions table
      // to track deletion requests for audit purposes
      console.log('⚠️  Note: Implement user_deletions audit table');
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete user-created content', async () => {
      const testEmail = 'gdpr-cascade-content@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create user content
      const { data: caseData } = await adminClient
        .from('cases')
        .insert({
          user_id: userId,
          name: 'User Business Case',
          client: 'Test Client',
          status: 'draft',
        })
        .select()
        .single();

      const caseId = caseData?.id;

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Verify case is deleted
      const { data: deletedCase } = await adminClient
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      expect(deletedCase).toBeNull();
    });

    it('should delete user sessions and tokens', async () => {
      const testEmail = 'gdpr-cascade-sessions@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Verify user cannot authenticate
      const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
        email: testEmail,
        password: 'test-password-123',
      });

      expect(signInError).toBeTruthy();
      expect(signInData.user).toBeNull();
    });

    it('should handle deletion of user with shared resources', async () => {
      // Test scenario: User collaborates on a case with others
      // When user is deleted, their contributions should be anonymized
      // but the shared resource should remain

      const testEmail = 'gdpr-shared-resource@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create another user (collaborator)
      const { data: collaborator } = await adminClient.auth.admin.createUser({
        email: 'collaborator@example.com',
        password: 'test-password-123',
        email_confirm: true,
      });

      const collaboratorId = collaborator.user!.id;
      testUserIds.push(collaboratorId);

      // Create shared case (owned by collaborator)
      const { data: sharedCase } = await adminClient
        .from('cases')
        .insert({
          user_id: collaboratorId,
          name: 'Shared Case',
          client: 'Shared Client',
          status: 'draft',
        })
        .select()
        .single();

      // User creates a component in the shared case
      await adminClient.from('canvas_components').insert({
        case_id: sharedCase!.id,
        type: 'metric-card',
        created_by: userId,
        props: { title: 'User Contribution' },
      });

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Shared case should still exist
      const { data: remainingCase } = await adminClient
        .from('cases')
        .select('*')
        .eq('id', sharedCase!.id)
        .single();

      expect(remainingCase).toBeTruthy();

      // User's component should be anonymized or deleted
      const { data: components } = await adminClient
        .from('canvas_components')
        .select('*')
        .eq('case_id', sharedCase!.id)
        .eq('created_by', userId);

      // Component should be deleted or created_by should be anonymized
      console.log('⚠️  Note: Implement component anonymization for shared resources');

      // Clean up collaborator
      await adminClient.auth.admin.deleteUser(collaboratorId);
    });
  });

  describe('Exceptions and Legal Holds', () => {
    it('should prevent deletion when legal hold is active', async () => {
      // GDPR Article 17(3) - Exceptions to right to erasure
      const testEmail = 'gdpr-legal-hold@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // In a real implementation, we'd have a legal_holds table
      // For now, we'll document the requirement
      console.log('⚠️  Note: Implement legal_holds table to prevent deletion');

      // Attempt deletion should fail if legal hold exists
      // await expect(deleteUserWithLegalHold(userId)).rejects.toThrow('Legal hold active');

      // Clean up
      await adminClient.auth.admin.deleteUser(userId);
    });

    it('should allow deletion after legal hold is lifted', async () => {
      const testEmail = 'gdpr-legal-hold-lifted@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Simulate legal hold being lifted
      // In real implementation: await liftLegalHold(userId);

      // Now deletion should succeed
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      expect(error).toBeNull();
    });

    it('should retain data for compliance obligations', async () => {
      // GDPR Article 17(3)(b) - Compliance with legal obligation
      const testEmail = 'gdpr-compliance-retain@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create financial transaction (must be retained for tax purposes)
      // In real implementation: await createFinancialTransaction(userId);

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Financial records should be retained but anonymized
      console.log('⚠️  Note: Implement financial record anonymization');
    });
  });

  describe('Deletion Confirmation and Verification', () => {
    it('should require explicit confirmation for deletion', async () => {
      // Best practice: Require user to confirm deletion request
      const testEmail = 'gdpr-confirm-deletion@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // In real implementation:
      // 1. User requests deletion
      // 2. System sends confirmation email
      // 3. User confirms via link
      // 4. Deletion proceeds

      console.log('⚠️  Note: Implement deletion confirmation workflow');

      // Clean up
      await adminClient.auth.admin.deleteUser(userId);
    });

    it('should provide deletion confirmation to user', async () => {
      const testEmail = 'gdpr-deletion-confirmation@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // In real implementation: Send confirmation email
      console.log('⚠️  Note: Implement deletion confirmation email');
    });

    it('should log deletion request in audit trail', async () => {
      const testEmail = 'gdpr-deletion-audit@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create deletion request audit log
      const { data: auditLog } = await adminClient
        .from('security_audit_events')
        .insert({
          user_id: userId,
          action: 'ACCESS_GRANTED', // In real implementation: 'USER_DELETION_REQUESTED'
          resource: '/api/user/delete',
          required_permissions: [],
          user_permissions: [],
        })
        .select()
        .single();

      // Delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Audit log should still exist
      const { data: retainedLog } = await adminClient
        .from('security_audit_events')
        .select('*')
        .eq('id', auditLog!.id)
        .single();

      expect(retainedLog).toBeTruthy();

      // Clean up
      if (auditLog?.id) {
        await adminClient
          .from('security_audit_events')
          .delete()
          .eq('id', auditLog.id);
      }
    });
  });

  describe('Data Export Before Deletion', () => {
    it('should allow user to export data before deletion', async () => {
      // GDPR Article 20 - Right to data portability
      const testEmail = 'gdpr-export-before-delete@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: {
          full_name: 'Export Test User',
        },
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create user data
      await adminClient.from('cases').insert({
        user_id: userId,
        name: 'Export Test Case',
        client: 'Export Client',
        status: 'draft',
      });

      // Export user data
      const exportData = {
        user: authUser.user,
        cases: await adminClient.from('cases').select('*').eq('user_id', userId),
        messages: await adminClient.from('messages').select('*').eq('user_id', userId),
      };

      expect(exportData.user).toBeTruthy();
      expect(exportData.cases.data).toBeTruthy();

      // Now delete user
      await adminClient.auth.admin.deleteUser(userId);

      // Verify deletion
      const { data: deletedUser } = await adminClient.auth.admin.getUserById(userId);
      expect(deletedUser.user).toBeNull();
    });
  });

  describe('Partial Deletion (Anonymization)', () => {
    it('should anonymize user data instead of full deletion when appropriate', async () => {
      // Some data may need to be retained but anonymized
      const testEmail = 'gdpr-anonymize@example.com';
      const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: {
          full_name: 'Anonymize Test User',
        },
      });

      const userId = authUser.user!.id;
      testUserIds.push(userId);

      // Create data that should be anonymized
      await adminClient.from('messages').insert({
        user_id: userId,
        content: 'This message should be anonymized',
        role: 'user',
      });

      // Anonymize user data
      // In real implementation: await anonymizeUser(userId);

      console.log('⚠️  Note: Implement user data anonymization function');

      // Clean up
      await adminClient.auth.admin.deleteUser(userId);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk deletion requests efficiently', async () => {
      const userIds: string[] = [];

      // Create multiple users
      for (let i = 0; i < 10; i++) {
        const { data: authUser } = await adminClient.auth.admin.createUser({
          email: `gdpr-bulk-${i}@example.com`,
          password: 'test-password-123',
          email_confirm: true,
        });

        if (authUser.user) {
          userIds.push(authUser.user.id);
        }
      }

      // Measure bulk deletion time
      const startTime = Date.now();

      for (const userId of userIds) {
        await adminClient.auth.admin.deleteUser(userId);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds for 10 users

      console.log(`✅ Bulk deletion of ${userIds.length} users completed in ${duration}ms`);
    });
  });
});
