import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StructuredSecretAuditLogger } from '../secrets/SecretAuditLogger.js'
import {
  MultiTenantSecretsManager,
  SecretsManager,
} from '../secretsManager.js'

const {
  canMock,
  createServerSupabaseClientMock,
  fromMock,
  insertMock,
  sendMock,
} = vi.hoisted(() => ({
  sendMock: vi.fn(),
  insertMock: vi.fn(),
  fromMock: vi.fn(() => ({ insert: insertMock })),
  createServerSupabaseClientMock: vi.fn(() => ({ from: fromMock })),
  canMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    send = sendMock;
  },
  GetSecretValueCommand: vi.fn().mockImplementation(function GetSecretValueCommand(input) {
    return input;
  }),
  UpdateSecretCommand: vi.fn().mockImplementation(function UpdateSecretCommand(input) {
    return input;
  }),
  RotateSecretCommand: vi.fn().mockImplementation(function RotateSecretCommand(input) {
    return input;
  }),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

vi.mock('../../services/auth/RbacService.js', () => ({
  RbacService: class {
    can = canMock;
  },
}));

describe('SecretsManager compatibility alias', () => {
  const baseSecrets = {
    TOGETHER_API_KEY: 'together',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    JWT_SECRET: 'jwt',
    DATABASE_URL: 'postgres://localhost',
    REDIS_URL: 'redis://localhost',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockReset();
    insertMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockClear();
    createServerSupabaseClientMock.mockClear();
    canMock.mockReset().mockReturnValue(false);
  });

  it('exports SecretsManager as an alias of MultiTenantSecretsManager', () => {
    expect(SecretsManager).toBe(MultiTenantSecretsManager);
  });

  it('requires a tenant id for secret access', async () => {
    const manager = new SecretsManager();

    await expect(manager.getSecrets('', 'system')).rejects.toThrow('Tenant ID is required for secret access');
  });

  it('denies unauthenticated secret reads and audits the denial', async () => {
    const manager = new SecretsManager();
    const { logger } = await import('../../lib/logger');

    await expect(manager.getSecrets('tenant-a')).rejects.toThrow(
      'Permission denied: User ID required for authentication'
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'SECRET_ACCESS_DENIED',
      expect.objectContaining({
        tenantId: 'tenant-a',
        action: 'READ',
        result: 'FAILURE',
        error: 'User ID required for authentication',
      })
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-a',
        action: 'READ',
        result: 'FAILURE',
      })
    );
  });

  it('uses tenant-scoped secret paths and audits access', async () => {
    sendMock.mockResolvedValue({ SecretString: JSON.stringify(baseSecrets) });
    const manager = new SecretsManager();
    const { logger } = await import('../../lib/logger');

    await manager.getSecrets('tenant-123', 'admin-user-1');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ SecretId: expect.stringMatching(/tenants\/tenant-123\/config$/) })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'SECRET_ACCESS',
      expect.objectContaining({
        tenantId: 'tenant-123',
        userId: 'admin-user-1',
        action: 'READ',
        result: 'SUCCESS',
      })
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-123',
        user_id: 'admin-user-1',
        action: 'READ',
        result: 'SUCCESS',
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
        result: 'SUCCESS',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'SECRET_ACCESS',
        expect.objectContaining({
          tenantId: 'tenant-xyz',
          userId: 'user-123',
          action: 'READ',
          secretKey: expect.stringContaining('...'),
          secretFingerprint: expect.any(String),
        })
      );
      const payload = (logger.info as any).mock.calls[0][1];
      expect(payload.secretKey).not.toContain('sk_live_sensitive_value');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-xyz',
          user_id: 'user-123',
          secret_key: 'sk_live_sensitive_value',
        })
      );
    });
  });
});
