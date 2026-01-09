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

// ---------------------------------------------------------------------------
// Mocks: AWS SDK
// ---------------------------------------------------------------------------
vi.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: class MockSecretsManagerClient {
      send = vi.fn();
    },
    GetSecretValueCommand: vi.fn(),
    UpdateSecretCommand: vi.fn(),
    RotateSecretCommand: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mocks: Logger
// ---------------------------------------------------------------------------
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mocks: RBAC service
// ---------------------------------------------------------------------------
vi.mock('../../services/RbacService', () => {
  class MockRbacService {
    can = vi.fn().mockReturnValue(true);
    assertCan = vi.fn();
  }
  return { RbacService: MockRbacService };
});

// ---------------------------------------------------------------------------
// Mocks: Supabase client
//
// Use vi.hoisted so the chain object exists in a hoisted context and can be
// shared between the hoisted vi.mock call and individual tests.
// ---------------------------------------------------------------------------
const { mockSupabaseChain, mockSupabaseResponse, mockAuditInsert } = vi.hoisted(() => {
  const response = { data: [] as any[], error: null as any };

  // Dedicated insert mock for audit logs table
  const auditInsert = vi.fn().mockResolvedValue({ error: null });

  // A lightweight query builder that supports chaining.
  // It behaves like: from().select().eq().then(...) and from('secret_audit_logs').insert(...)
  const chain: any = {
    // builder ops
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),

    // allow `await supabase.from(...).select(...).eq(...)`
    then: (resolve: any) => resolve(response),
  };

  chain.from.mockImplementation((table: string) => {
    // For audit log writes we need insert to be called and captured separately.
    if (table === 'secret_audit_logs') {
      return { insert: auditInsert };
    }
    return chain;
  });

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);

  // single() should be explicitly set per test when tenant membership is checked.
  chain.single.mockResolvedValue({ data: null, error: null });

  // insert() on the general chain is not used for audit logs in our implementation,
  // but we keep it to avoid surprises.
  chain.insert.mockResolvedValue({ error: null });

  return { mockSupabaseChain: chain, mockSupabaseResponse: response, mockAuditInsert: auditInsert };
});

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabaseChain),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MultiTenantSecretsManager', () => {
  let secretsManager: MultiTenantSecretsManager;
  let rbacServiceMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock response for `then`-style awaits.
    mockSupabaseResponse.data = [];
    mockSupabaseResponse.error = null;

    // Re-apply chain return values (defensive).
    mockSupabaseChain.select.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.eq.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.insert.mockResolvedValue({ error: null });
    mockSupabaseChain.single.mockResolvedValue({ data: null, error: null });
    mockAuditInsert.mockResolvedValue({ error: null });

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
      expect(() => (secretsManager as any).getTenantSecretPath('', 'config')).toThrow(
        'Tenant ID is required'
      );
    });

    it('should validate tenant ID format', () => {
      const manager = secretsManager as any;
      expect(() => manager.getTenantSecretPath('tenant-123', 'config')).not.toThrow();
      expect(() => manager.getTenantSecretPath('tenant_with_special!@#', 'config')).toThrow(
        'Invalid tenant ID format'
      );
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
        tenantId: 'tenant-123',
      });
      manager.cache.set('tenant-456:all_secrets', {
        value: { test: 'value' },
        expiresAt: Date.now() + 1000000,
        tenantId: 'tenant-456',
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

    it('should use RbacService for regular users (role-backed)', async () => {
      const manager = secretsManager as any;

      // Simulate a user role lookup returning ROLE_EDITOR
      mockSupabaseResponse.data = [{ role: 'ROLE_EDITOR' }];

      const permCheck = await manager.checkPermission('user-123', 'tenant-123', 'WRITE');

      expect(permCheck.allowed).toBe(true);
      expect(rbacServiceMock.can).toHaveBeenCalled();
      const callArgs = rbacServiceMock.can.mock.calls[0];
      expect(callArgs[0]).toEqual({
        id: 'user-123',
        roles: ['ROLE_EDITOR'],
        tenantRoles: { 'tenant-123': ['ROLE_EDITOR'] },
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

    it('should allow regular users read access if belonging to tenant', async () => {
      const manager = secretsManager as any;

      // Configure the chained single() result for tenant membership lookup.
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: { organization_id: 'tenant-123' },
        error: null,
      });

      const readCheck = await manager.checkPermission('user-123', 'tenant-123', 'READ');
      expect(readCheck.allowed).toBe(true);
    });

    it('should deny regular users read access if NOT belonging to tenant', async () => {
      const manager = secretsManager as any;

      mockSupabaseChain.single.mockResolvedValueOnce({
        data: { organization_id: 'tenant-999' },
        error: null,
      });

      const readCheck = await manager.checkPermission('user-123', 'tenant-123', 'READ');

      expect(readCheck.allowed).toBe(false);
      expect(readCheck.reason).toContain('does not belong to tenant');
    });

    it('should deny regular users read access if user not found', async () => {
      const manager = secretsManager as any;

      mockSupabaseChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const readCheck = await manager.checkPermission('user-123', 'tenant-123', 'READ');

      expect(readCheck.allowed).toBe(false);
      expect(readCheck.reason).toContain('User not found');
    });

    it('should deny regular users read access if DB error occurs', async () => {
      const manager = secretsManager as any;

      (SupabaseLib.createServerSupabaseClient as any).mockImplementationOnce(() => {
        throw new Error('DB connection failed');
      });

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
        timestamp: new Date().toISOString(),
      });

      expect(logger.info).toHaveBeenCalledWith('SECRET_ACCESS', expect.anything());
      expect(mockAuditInsert).toHaveBeenCalled();
    });

    it('should mask secret keys in audit logs', () => {
      const manager = secretsManager as any;
      const masked = manager.maskSecretKey('database_credentials');
      expect(masked).toContain('...');
    });

    it('should write to secret_audit_logs table', async () => {
      const manager = secretsManager as any;

      const timestamp = new Date().toISOString();
      await manager.auditLog({
        tenantId: 'tenant-123',
        userId: 'user-456',
        secretKey: 'api_key',
        action: 'WRITE',
        result: 'SUCCESS',
        timestamp,
      });

      expect(mockSupabaseChain.from).toHaveBeenCalledWith('secret_audit_logs');
      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          user_id: 'user-456',
          secret_key: 'api_key',
          action: 'WRITE',
          result: 'SUCCESS',
          timestamp,
        })
      );
    });

    it('should handle database write errors gracefully', async () => {
      const manager = secretsManager as any;
      const { logger } = await import('../../lib/logger');

      mockAuditInsert.mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(
        manager.auditLog({
          tenantId: 'tenant-123',
          secretKey: 'api_key',
          action: 'READ',
          result: 'SUCCESS',
          timestamp: new Date().toISOString(),
        })
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to write to secret_audit_logs database',
        expect.any(Error),
        expect.anything()
      );
    });
  });

  describe('Security Features', () => {
    it('should prevent environment fallback in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const manager = new MultiTenantSecretsManager();

      expect(() => (manager as any).getSecretsFromEnv()).toThrow(
        'Cannot fallback to environment variables in production'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should validate all required secrets', async () => {
      const manager = secretsManager as any;

      vi.spyOn(manager, 'getSecrets').mockResolvedValue({
        TOGETHER_API_KEY: 'test-key',
        SUPABASE_URL: 'https://test.supabase.co',
        // Missing other required secrets
      } as any);

      const validation = await secretsManager.validateSecrets('tenant-123', 'system');
      expect(validation.valid).toBe(false);
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
        REDIS_URL: 'redis://localhost',
      };

      // First call - cache miss
      manager.client.send = vi.fn().mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets),
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
        metadata: { latency_ms: 42, source: 'aws' },
      });

      expect(logger.info).toHaveBeenCalledWith(
        'SECRET_ACCESS',
        expect.objectContaining({
          metadata: expect.objectContaining({
            latency_ms: 42,
            source: 'aws',
          }),
        })
      );
    });
  });
});


