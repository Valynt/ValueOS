/**
 * Multi-Tenant Secrets Manager Tests
 * 
 * Tests for SEC-001, SEC-002, SEC-003 compliance
 * 
 * Created: 2024-11-29
 * Sprint 1: Critical Security Fixes
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MultiTenantSecretsManager } from '../secretsManager.v2';

// Mock AWS SDK
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  GetSecretValueCommand: vi.fn(),
  UpdateSecretCommand: vi.fn(),
  RotateSecretCommand: vi.fn()
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
    secretsManager = new MultiTenantSecretsManager();
    vi.clearAllMocks();
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
      await expect(
        (secretsManager as any).getTenantSecretPath('', 'config')
      ).rejects.toThrow('Tenant ID is required');
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
      
      const permCheck = manager.checkPermission(undefined, 'tenant-123', 'READ');
      
      expect(permCheck.allowed).toBe(false);
      expect(permCheck.reason).toContain('User ID required');
    });

    it('should allow system user full access', () => {
      const manager = secretsManager as any;
      
      const readCheck = manager.checkPermission('system', 'tenant-123', 'READ');
      const writeCheck = manager.checkPermission('system', 'tenant-123', 'WRITE');
      const deleteCheck = manager.checkPermission('system', 'tenant-123', 'DELETE');
      const rotateCheck = manager.checkPermission('system', 'tenant-123', 'ROTATE');
      
      expect(readCheck.allowed).toBe(true);
      expect(writeCheck.allowed).toBe(true);
      expect(deleteCheck.allowed).toBe(true);
      expect(rotateCheck.allowed).toBe(true);
    });

    it('should allow admin users full access', () => {
      const manager = secretsManager as any;
      
      const readCheck = manager.checkPermission('admin-user-1', 'tenant-123', 'READ');
      const writeCheck = manager.checkPermission('admin-user-1', 'tenant-123', 'WRITE');
      
      expect(readCheck.allowed).toBe(true);
      expect(writeCheck.allowed).toBe(true);
    });

    it('should deny regular users write access by default', () => {
      const manager = secretsManager as any;
      
      const writeCheck = manager.checkPermission('user-123', 'tenant-123', 'WRITE');
      const deleteCheck = manager.checkPermission('user-123', 'tenant-123', 'DELETE');
      
      expect(writeCheck.allowed).toBe(false);
      expect(deleteCheck.allowed).toBe(false);
    });

    it('should allow regular users read access', () => {
      const manager = secretsManager as any;
      
      const readCheck = manager.checkPermission('user-123', 'tenant-123', 'READ');
      
      expect(readCheck.allowed).toBe(true);
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
      
      await expect(
        (manager as any).getSecretsFromEnv()
      ).rejects.toThrow('Cannot fallback to environment variables in production');
      
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
      });
      
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
      vi.spyOn(manager.client, 'send').mockResolvedValue({
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
