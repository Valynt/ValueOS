import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecretsManager } from '../secretsManager';
import { StructuredSecretAuditLogger } from '../secrets/SecretAuditLogger';

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  GetSecretValueCommand: vi.fn(),
  UpdateSecretCommand: vi.fn(),
  RotateSecretCommand: vi.fn()
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('SecretsManager (tenant-scoped)', () => {
  const baseSecrets = {
    TOGETHER_API_KEY: 'together',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_KEY: 'service',
    JWT_SECRET: 'jwt',
    DATABASE_URL: 'postgres://localhost',
    REDIS_URL: 'redis://localhost'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a tenant id for secret access', async () => {
    const manager = new SecretsManager({
      logAccess: vi.fn(),
      logRotation: vi.fn(),
      logDenied: vi.fn()
    } as any);

    await expect(manager.getSecrets('')).rejects.toThrow('Tenant ID is required for secret access');
  });

  it('denies cross-tenant access with 403 status', async () => {
    const auditLogger = {
      logAccess: vi.fn(),
      logRotation: vi.fn(),
      logDenied: vi.fn()
    } as any;
    const manager = new SecretsManager(auditLogger);

    await expect(manager.getSecrets('tenant-a', undefined, 'tenant-b')).rejects.toMatchObject({
      statusCode: 403
    });
    expect(auditLogger.logDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        action: 'READ',
        reason: 'TENANT_CONTEXT_MISMATCH'
      })
    );
  });

  it('uses tenant-scoped secret paths and audits access', async () => {
    const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
    const send = vi.fn().mockResolvedValue({ SecretString: JSON.stringify(baseSecrets) });
    (SecretsManagerClient as any).mockImplementation(() => ({ send }));

    const auditLogger = {
      logAccess: vi.fn(),
      logRotation: vi.fn(),
      logDenied: vi.fn()
    } as any;
    const manager = new SecretsManager(auditLogger);

    await manager.getSecrets('tenant-123', 'user-1');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ SecretId: expect.stringMatching(/tenants\/tenant-123\/config/) })
    );
    expect(auditLogger.logAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-123',
        userId: 'user-1',
        action: 'READ',
        result: 'SUCCESS'
      })
    );
  });

  describe('StructuredSecretAuditLogger', () => {
    it('masks secret keys and includes user and tenant ids', async () => {
      const { logger } = await import('../../lib/logger');
      const auditLogger = new StructuredSecretAuditLogger();

      await auditLogger.logAccess({
        tenantId: 'tenant-xyz',
        userId: 'user-123',
        secretKey: 'sk_live_sensitive_value',
        action: 'READ',
        result: 'SUCCESS'
      });

      expect(logger.info).toHaveBeenCalledWith(
        'SECRET_ACCESS',
        expect.objectContaining({
          tenantId: 'tenant-xyz',
          userId: 'user-123',
          action: 'READ',
          secretKey: expect.stringContaining('...'),
          secretFingerprint: expect.any(String)
        })
      );
      const payload = (logger.info as any).mock.calls[0][1];
      expect(payload.secretKey).not.toContain('sk_live_sensitive_value');
    });
  });
});
