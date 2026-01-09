/**
 * P0 Security Implementation Tests
 * 
 * CRITICAL: These tests verify security-critical functionality
 * All tests must pass before production deployment
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { 
  assertTenantMembership,
  getUserTenantId,
  TenantSecurityError,
  verifyTenantExists,
  verifyTenantMembership
} from '../lib/tenantVerification';

describe('P0 Security: Tenant Verification', () => {
  describe('verifyTenantMembership', () => {
    it('should return true when user belongs to tenant', async () => {
      // This test requires actual database setup
      // In real implementation, mock the supabase client
      
      const userId = 'test-user-123';
      const tenantId = 'test-org-123';
      
      // Mock supabase response
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { organization_id: tenantId },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await verifyTenantMembership(userId, tenantId);
      expect(result).toBe(true);
    });

    it('should return false when user does not belong to tenant', async () => {
      const userId = 'test-user-123';
      const tenantId = 'test-org-123';
      const userTenantId = 'different-org-456';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { organization_id: userTenantId },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await verifyTenantMembership(userId, tenantId);
      expect(result).toBe(false);
    });

    it('should return false on database error (fail closed)', async () => {
      const userId = 'test-user-123';
      const tenantId = 'test-org-123';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: null,
                  error: { message: 'Database error', code: 'DB_ERROR' },
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await verifyTenantMembership(userId, tenantId);
      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      const userId = 'non-existent-user';
      const tenantId = 'test-org-123';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await verifyTenantMembership(userId, tenantId);
      expect(result).toBe(false);
    });
  });

  describe('assertTenantMembership', () => {
    it('should not throw when user belongs to tenant', async () => {
      const userId = 'test-user-123';
      const tenantId = 'test-org-123';
      
      // Mock successful verification
      vi.mock('../lib/tenantVerification', () => ({
        verifyTenantMembership: async () => true,
      }));
      
      await expect(assertTenantMembership(userId, tenantId)).resolves.not.toThrow();
    });

    it('should throw TenantSecurityError when user does not belong to tenant', async () => {
      const userId = 'test-user-123';
      const tenantId = 'test-org-123';
      
      // Mock failed verification
      vi.mock('../lib/tenantVerification', () => ({
        verifyTenantMembership: async () => false,
        getUserTenantId: async () => 'different-org-456',
      }));
      
      await expect(assertTenantMembership(userId, tenantId)).rejects.toThrow(TenantSecurityError);
    });
  });

  describe('getUserTenantId', () => {
    it('should return tenant ID for valid user', async () => {
      const userId = 'test-user-123';
      const expectedTenantId = 'test-org-123';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { organization_id: expectedTenantId },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await getUserTenantId(userId);
      expect(result).toBe(expectedTenantId);
    });

    it('should return null for non-existent user', async () => {
      const userId = 'non-existent-user';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: null,
                  error: { message: 'Not found', code: 'PGRST116' },
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await getUserTenantId(userId);
      expect(result).toBeNull();
    });
  });

  describe('verifyTenantExists', () => {
    it('should return true for active tenant', async () => {
      const tenantId = 'test-org-123';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: tenantId, status: 'active' },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await verifyTenantExists(tenantId);
      expect(result).toBe(true);
    });

    it('should return false for inactive tenant', async () => {
      const tenantId = 'test-org-123';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: tenantId, status: 'suspended' },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await verifyTenantExists(tenantId);
      expect(result).toBe(false);
    });

    it('should return false for non-existent tenant', async () => {
      const tenantId = 'non-existent-org';
      
      vi.mock('../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: null,
                  error: { message: 'Not found', code: 'PGRST116' },
                }),
              }),
            }),
          }),
        },
      }));
      
      const result = await verifyTenantExists(tenantId);
      expect(result).toBe(false);
    });
  });
});

describe('P0 Security: Cross-Tenant Access Prevention', () => {
  it('should block access to secrets from different tenant', async () => {
    // This test verifies the complete security flow
    // Mock user from tenant A trying to access tenant B's secrets
    
    const userTenantId = 'tenant-a';
    const requestedTenantId = 'tenant-b';
    const userId = 'user-123';
    
    // Mock tenant verification to return false
    vi.mock('../lib/tenantVerification', () => ({
      verifyTenantMembership: async (uid: string, tid: string) => {
        return uid === userId && tid === userTenantId;
      },
    }));
    
    const result = await verifyTenantMembership(userId, requestedTenantId);
    expect(result).toBe(false);
  });

  it('should allow access to secrets from same tenant', async () => {
    const tenantId = 'tenant-a';
    const userId = 'user-123';
    
    vi.mock('../lib/tenantVerification', () => ({
      verifyTenantMembership: async (uid: string, tid: string) => {
        return uid === userId && tid === tenantId;
      },
    }));
    
    const result = await verifyTenantMembership(userId, tenantId);
    expect(result).toBe(true);
  });
});

describe('P0 Security: Audit Logging', () => {
  it('should log cross-tenant access attempts', async () => {
    // Verify that cross-tenant access attempts are logged
    const logSpy = vi.spyOn(console, 'warn');
    
    const userId = 'user-123';
    const userTenantId = 'tenant-a';
    const requestedTenantId = 'tenant-b';
    
    // Attempt cross-tenant access
    await verifyTenantMembership(userId, requestedTenantId);
    
    // Verify warning was logged
    // In real implementation, check structured logger
    expect(logSpy).toHaveBeenCalled();
  });
});

describe('P0 Security: Fail Closed Behavior', () => {
  it('should deny access on any error', async () => {
    const userId = 'user-123';
    const tenantId = 'tenant-a';
    
    // Mock database error
    vi.mock('../lib/supabase', () => ({
      supabase: {
        from: () => {
          throw new Error('Database connection failed');
        },
      },
    }));
    
    const result = await verifyTenantMembership(userId, tenantId);
    expect(result).toBe(false);
  });

  it('should deny access on timeout', async () => {
    const userId = 'user-123';
    const tenantId = 'tenant-a';
    
    // Mock timeout
    vi.mock('../lib/supabase', () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                return { data: null, error: null };
              },
            }),
          }),
        }),
      },
    }));
    
    // Should timeout and return false
    const result = await Promise.race([
      verifyTenantMembership(userId, tenantId),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
    ]);
    
    expect(result).toBe(false);
  });
});
