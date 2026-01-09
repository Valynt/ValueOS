/**
 * Multi-Tenant Secrets Manager Tests
 * 
 * Tests for SEC-001, SEC-002, SEC-003 compliance
 * 
 * Created: 2024-11-29
 * Sprint 1: Critical Security Fixes
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiTenantSecretsManager } from '../secretsManager.v2';
import { RbacService } from '../../services/RbacService';

// Mock AWS SDK
vi.mock('@aws-sdk/client-secrets-manager', () => {
  class MockSecretsManagerClient {
    send = vi.fn();
  }
  return {
    SecretsManagerClient: MockSecretsManagerClient,
    GetSecretValueCommand: vi.fn(),
    UpdateSecretCommand: vi.fn(),
    RotateSecretCommand: vi.fn()
  };
});

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock Supabase client
// Use vi.hoisted so that mockSupabaseChain and mockSupabaseResponse are created in a hoisted
// context and can be shared between hoisted vi.mock calls and the tests, avoiding ordering
// issues caused by Vitest's mock hoisting.
const { mockSupabaseChain, mockSupabaseResponse } = vi.hoisted(() => {
  const response = { data: [] as any[], error: null as any };
  const chain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    then: (resolve: any) => resolve(response)
  };

  // Setup circular references for chaining
  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.insert.mockResolvedValue({ error: null });

  return { mockSupabaseChain: chain, mockSupabaseResponse: response };
});

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabaseChain)
}));

// Mock RbacService
vi.mock('../../services/RbacService', () => {
  class MockRbacService {
    can = vi.fn().mockReturnValue(true);
    assertCan = vi.fn();
  }
  return { RbacService: MockRbacService };
});

describe('MultiTenantSecretsManager', () => {
  let secretsManager: MultiTenantSecretsManager;
  let rbacServiceMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock response
    mockSupabaseResponse.data = [];
    mockSupabaseResponse.error = null;

    // Ensure methods return the chain (vi.clearAllMocks might clear return values if they were set via .mockReturnValue, but here they are set in hoisted)
    // Actually vi.clearAllMocks() clears usage data, usually.
    // But to be safe re-apply return values
    mockSupabaseChain.from.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.select.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.eq.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.insert.mockResolvedValue({ error: null });

    secretsManager = new MultiTenantSecretsManager();
    rbacServiceMock = (secretsManager as any).rbacService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('[SEC-001] Tenant Isolation', () => {
    it('should generate tenant-isolated secret paths', () => {
      const manager = secretsManager as any;
      const path1 = manager.getTenantSecretPath('tenant-123', 'config');
      const path2 = manager.getTenantSecretPath('tenant-456', 'config');
      expect(path1).toContain('tenant-123');
      expect(path2).toContain('tenant-456');
    });

    it('should require tenant ID for secret access', async () => {
        try {
            (secretsManager as any).getTenantSecretPath('', 'config');
            throw new Error('Should have thrown');
        } catch (e: any) {
            expect(e.message).toContain('Tenant ID is required');
        }
    });

    it('should validate tenant ID format', () => {
      const manager = secretsManager as any;
      expect(() => manager.getTenantSecretPath('tenant-123', 'config')).not.toThrow();
      expect(() => manager.getTenantSecretPath('tenant_with_special!@#', 'config'))
        .toThrow('Invalid tenant ID format');
    });

    it('should prevent cross-tenant cache access', async () => {
      const manager = secretsManager as any;
      const cacheKey1 = manager.getCacheKey('tenant-123', 'all_secrets');
      const cacheKey2 = manager.getCacheKey('tenant-456', 'all_secrets');
      expect(cacheKey1).not.toEqual(cacheKey2);
    });

    it('should clear cache only for specified tenant', () => {
      const manager = secretsManager as any;
      manager.cache.set('tenant-123:all_secrets', {
        value: { test: 'value' },
        expiresAt: Date.now() + 1000000,
        tenantId: 'tenant-123'
      });
      manager.cache.set('tenant-456:all_secrets', {
        value: { test: 'value' },
        expiresAt: Date.now() + 1000000,
        tenantId: 'tenant-456'
      });
      secretsManager.clearCache('tenant-123');
      expect(manager.cache.has('tenant-123:all_secrets')).toBe(false);
      expect(manager.cache.has('tenant-456:all_secrets')).toBe(true);
    });
  });

  describe('[SEC-002] RBAC Integration', () => {
    it('should deny access without user ID', async () => {
      const manager = secretsManager as any;
      const permCheck = await manager.checkPermission(undefined, 'tenant-123', 'READ');
      expect(permCheck.allowed).toBe(false);
      expect(permCheck.reason).toContain('User ID required');
    });

    it('should allow system user full access', async () => {
      const manager = secretsManager as any;
      const readCheck = await manager.checkPermission('system', 'tenant-123', 'READ');
      expect(readCheck.allowed).toBe(true);
    });

    it('should allow admin users full access', async () => {
      const manager = secretsManager as any;
      const readCheck = await manager.checkPermission('admin-user-1', 'tenant-123', 'READ');
      expect(readCheck.allowed).toBe(true);
    });

    it('should use RbacService for regular users', async () => {
      const manager = secretsManager as any;
      
      // Setup mock response for this test
      mockSupabaseResponse.data = [{ role: 'ROLE_EDITOR' }];

      const permCheck = await manager.checkPermission('user-123', 'tenant-123', 'WRITE');
      
      expect(permCheck.allowed).toBe(true);
      expect(rbacServiceMock.can).toHaveBeenCalled();
      const callArgs = rbacServiceMock.can.mock.calls[0];
      expect(callArgs[0]).toEqual({
        id: 'user-123',
        roles: ['ROLE_EDITOR'],
        tenantRoles: { 'tenant-123': ['ROLE_EDITOR'] }
      });
      expect(callArgs[1]).toBe('secrets:write');
      expect(callArgs[2]).toBe('tenant-123');
    });

    it('should deny if RbacService denies', async () => {
        const manager = secretsManager as any;

        mockSupabaseResponse.data = [{ role: 'ROLE_VIEWER' }];
        rbacServiceMock.can.mockReturnValue(false);

        const permCheck = await manager.checkPermission('user-123', 'tenant-123', 'WRITE');

        expect(permCheck.allowed).toBe(false);
        expect(permCheck.reason).toContain('lacks permission');
    });
  });

  describe('[SEC-003] Audit Logging', () => {
    it('should log all secret access attempts', async () => {
      const manager = secretsManager as any;
      const { logger } = await import('../../lib/logger');
      
      await manager.auditLog({
        tenantId: 'tenant-123',
        userId: 'user-456',
        secretKey: 'database_credentials',
        action: 'READ',
        result: 'SUCCESS',
        timestamp: new Date().toISOString()
      });
      
      expect(logger.info).toHaveBeenCalledWith('SECRET_ACCESS', expect.anything());
      expect(mockSupabaseChain.insert).toHaveBeenCalled();
    });

    it('should mask secret keys in audit logs', () => {
      const manager = secretsManager as any;
      const masked = manager.maskSecretKey('database_credentials');
      expect(masked).toContain('...');
    });
  });

  describe('Security Features', () => {
    it('should prevent environment fallback in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const manager = new MultiTenantSecretsManager();
      try {
        (manager as any).getSecretsFromEnv();
        throw new Error('Should have thrown');
      } catch (e: any) {
          expect(e.message).toContain('Cannot fallback');
      }
      process.env.NODE_ENV = originalEnv;
    });

    it('should validate all required secrets', async () => {
      const manager = secretsManager as any;
      vi.spyOn(manager, 'getSecrets').mockResolvedValue({
        TOGETHER_API_KEY: 'test-key',
        SUPABASE_URL: 'https://test.supabase.co',
      });
      const validation = await secretsManager.validateSecrets('tenant-123', 'system');
      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('JWT_SECRET');
    });
  });
});
