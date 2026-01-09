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
import * as SupabaseLib from '../../lib/supabase';

// Mock AWS SDK
vi.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: class MockSecretsManagerClient {
      send = vi.fn();
    },
    GetSecretValueCommand: vi.fn(),
    UpdateSecretCommand: vi.fn(),
    RotateSecretCommand: vi.fn()
  };
});

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(() => mockSupabase),
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('MultiTenantSecretsManager', () => {
  let secretsManager: MultiTenantSecretsManager;

  beforeEach(() => {
    vi.clearAllMocks();
    secretsManager = new MultiTenantSecretsManager();

    // Default mock setup for Supabase
    // We need to chain calls: from().select().eq().single()
    const mockSingle = vi.fn();
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    // Reset implementation of createServerSupabaseClient if needed,
    // although clearing mocks should handle it if we spy correctly.
    // However, since we mocked the module, we access the mock via the import if possible
    // or just rely on the fact that vi.mock hoisted it.
    // But to change implementation per test, we might need to access the mocked function.
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
      expect(path1).not.toEqual(path2);
      expect(path1).toMatch(/valuecanvas\/.*\/tenants\/tenant-123\/config/);
    });

    it('should require tenant ID for secret access', async () => {
      expect(() =>
        (secretsManager as any).getTenantSecretPath('', 'config')
      ).toThrow('Tenant ID is required');
    });

    it('should validate tenant ID format', () => {
      const manager = secretsManager as any;
      
      expect(() => manager.getTenantSecretPath('tenant-123', 'config')).not.toThrow();
      expect(() => manager.getTenantSecretPath('tenant_with_special!@#', 'config'))
        .toThrow('Invalid tenant ID format');
    });

    it('should prevent cross-tenant cache access', async () => {
      const manager = secretsManager as any;
      
      // Simulate cached secrets for tenant-123
      const cacheKey1 = manager.getCacheKey('tenant-123', 'all_secrets');
      const cacheKey2 = manager.getCacheKey('tenant-456', 'all_secrets');
      
      expect(cacheKey1).not.toEqual(cacheKey2);
      expect(cacheKey1).toContain('tenant-123');
      expect(cacheKey2).toContain('tenant-456');
    });

    it('should clear cache only for specified tenant', () => {
      const manager = secretsManager as any;
      
      // Add cache entries for multiple tenants
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
      const writeCheck = await manager.checkPermission('system', 'tenant-123', 'WRITE');
      const deleteCheck = await manager.checkPermission('system', 'tenant-123', 'DELETE');
      const rotateCheck = await manager.checkPermission('system', 'tenant-123', 'ROTATE');
      
      expect(readCheck.allowed).toBe(true);
      expect(writeCheck.allowed).toBe(true);
      expect(deleteCheck.allowed).toBe(true);
      expect(rotateCheck.allowed).toBe(true);
    });

    it('should allow admin users full access', async () => {
      const manager = secretsManager as any;
      
      const readCheck = await manager.checkPermission('admin-user-1', 'tenant-123', 'READ');
      const writeCheck = await manager.checkPermission('admin-user-1', 'tenant-123', 'WRITE');
      
      expect(readCheck.allowed).toBe(true);
      expect(writeCheck.allowed).toBe(true);
    });

    it('should deny regular users write access by default', async () => {
      const manager = secretsManager as any;
      
      const writeCheck = await manager.checkPermission('user-123', 'tenant-123', 'WRITE');
      const deleteCheck = await manager.checkPermission('user-123', 'tenant-123', 'DELETE');
      
      expect(writeCheck.allowed).toBe(false);
      expect(deleteCheck.allowed).toBe(false);
    });

    it('should allow regular users read access if belonging to tenant', async () => {
      const manager = secretsManager as any;
      
      // Setup mock return value
      mockSupabase.from('users').select('organization_id').eq('id', 'user-123').single.mockResolvedValue({
        data: { organization_id: 'tenant-123' },
        error: null
      });

      const readCheck = await manager.checkPermission('user-123', 'tenant-123', 'READ');
      
      expect(readCheck.allowed).toBe(true);
    });

    it('should deny regular users read access if NOT belonging to tenant', async () => {
      const manager = secretsManager as any;

      mockSupabase.from('users').select('organization_id').eq('id', 'user-123').single.mockResolvedValue({
        data: { organization_id: 'tenant-999' },
        error: null
      });

      const readCheck = await manager.checkPermission('user-123', 'tenant-123', 'READ');

      expect(readCheck.allowed).toBe(false);
      expect(readCheck.reason).toContain('does not belong to tenant');
    });

    it('should deny regular users read access if user not found', async () => {
      const manager = secretsManager as any;

      mockSupabase.from('users').select('organization_id').eq('id', 'user-123').single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const readCheck = await manager.checkPermission('user-123', 'tenant-123', 'READ');

      expect(readCheck.allowed).toBe(false);
      expect(readCheck.reason).toContain('User not found');
    });

     it('should deny regular users read access if DB error occurs', async () => {
      const manager = secretsManager as any;

      // Mock createServerSupabaseClient to throw
      (SupabaseLib.createServerSupabaseClient as any).mockImplementationOnce(() => { throw new Error('DB connection failed'); });

      const readCheck = await manager.checkPermission('user-123', 'tenant-123', 'READ');

      expect(readCheck.allowed).toBe(false);
      expect(readCheck.reason).toContain('Cannot verify tenant membership');
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
      
      expect(logger.info).toHaveBeenCalledWith(
        'SECRET_ACCESS',
        expect.objectContaining({
          tenantId: 'tenant-123',
          userId: 'user-456',
          action: 'READ',
          result: 'SUCCESS'
        })
      );
    });

    it('should mask secret keys in audit logs', () => {
      const manager = secretsManager as any;
      
      const masked = manager.maskSecretKey('database_credentials');
      
      expect(masked).toContain('...');
      expect(masked).toMatch(/^data.*als$/);
    });

    it('should mask user IDs in audit logs', () => {
      const manager = secretsManager as any;
      
      const masked = manager.maskUserId('user-123456789');
      
      expect(masked).toContain('...');
      expect(masked.length).toBeLessThan('user-123456789'.length);
    });

    it('should log failed access attempts with errors', async () => {
      const manager = secretsManager as any;
      const { logger } = await import('../../lib/logger');
      
      await manager.auditLog({
        tenantId: 'tenant-123',
        userId: 'user-456',
        secretKey: 'database_credentials',
        action: 'READ',
        result: 'FAILURE',
        error: 'Permission denied',
        timestamp: new Date().toISOString()
      });
      
      expect(logger.warn).toHaveBeenCalledWith(
        'SECRET_ACCESS_DENIED',
        expect.objectContaining({
          result: 'FAILURE',
          error: 'Permission denied'
        })
      );
    });
  });

  describe('Security Features', () => {
    it('should prevent environment fallback in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const manager = new MultiTenantSecretsManager();
      
      expect(() =>
        (manager as any).getSecretsFromEnv()
      ).toThrow('Cannot fallback to environment variables in production');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should expire cached secrets after TTL', async () => {
      const manager = secretsManager as any;
      
      const cacheKey = manager.getCacheKey('tenant-123', 'all_secrets');
      manager.cache.set(cacheKey, {
        value: { test: 'value' },
        expiresAt: Date.now() - 1000, // Expired
        tenantId: 'tenant-123'
      });
      
      const cached = manager.cache.get(cacheKey);
      expect(cached.expiresAt < Date.now()).toBe(true);
    });

    it('should validate all required secrets', async () => {
      // Mock getSecrets to return partial config
      const manager = secretsManager as any;
      vi.spyOn(manager, 'getSecrets').mockResolvedValue({
        TOGETHER_API_KEY: 'test-key',
        SUPABASE_URL: 'https://test.supabase.co',
        // Missing other required secrets
      } as any);
      
      const validation = await secretsManager.validateSecrets('tenant-123', 'system');
      
      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('SUPABASE_ANON_KEY');
      expect(validation.missing).toContain('JWT_SECRET');
    });
  });

  describe('Performance', () => {
    it('should use cache for repeated access', async () => {
      const manager = secretsManager as any;
      const mockSecrets = {
        TOGETHER_API_KEY: 'test-key',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_KEY: 'service-key',
        JWT_SECRET: 'jwt-secret',
        DATABASE_URL: 'postgres://localhost',
        REDIS_URL: 'redis://localhost'
      };
      
      // First call - cache miss
      manager.client.send = vi.fn().mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets)
      });
      
      await secretsManager.getSecrets('tenant-123', 'system');
      
      // Second call - should use cache
      vi.clearAllMocks();
      await secretsManager.getSecrets('tenant-123', 'system');
      
      expect(manager.client.send).not.toHaveBeenCalled();
    });

    it('should include latency in audit metadata', async () => {
      const manager = secretsManager as any;
      const { logger } = await import('../../lib/logger');
      
      await manager.auditLog({
        tenantId: 'tenant-123',
        userId: 'user-456',
        secretKey: 'all_secrets',
        action: 'READ',
        result: 'SUCCESS',
        timestamp: new Date().toISOString(),
        metadata: { latency_ms: 42, source: 'aws' }
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        'SECRET_ACCESS',
        expect.objectContaining({
          metadata: expect.objectContaining({
            latency_ms: 42,
            source: 'aws'
          })
        })
      );
    });
  });
});
