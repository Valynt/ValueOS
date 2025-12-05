import { describe, it, expect, vi } from 'vitest';
import type { ISecretProvider, SecretMetadata, SecretValue } from '../../config/secrets/ISecretProvider';
import { SecretsService } from '../SecretsService';
import { RbacService, RbacUser } from '../RbacService';
import { AuthorizationError } from '../errors';

class MockProvider implements ISecretProvider {
  name = 'mock';
  getSecret = vi.fn(async () => ({ value: 'secret' } as SecretValue));
  setSecret = vi.fn(async () => true);
  rotateSecret = vi.fn(async () => true);
  deleteSecret = vi.fn(async () => true);
  listSecrets = vi.fn(async () => ['key-1']);
  getSecretMetadata = vi.fn(async () => null as SecretMetadata | null);
  secretExists = vi.fn(async () => true);
  auditAccess = vi.fn(async () => {});
  getProviderName(): string {
    return this.name;
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }
}

const adminUser: RbacUser = { id: 'admin-1', roles: ['ROLE_ADMIN'] };
const viewerUser: RbacUser = { id: 'viewer-1', roles: ['ROLE_VIEWER'] };

describe('SecretsService RBAC enforcement', () => {
  it('allows authorized users to read secrets', async () => {
    const provider = new MockProvider();
    const rbac = new RbacService();
    const service = new SecretsService(provider, rbac);

    const result = await service.getSecret('tenant-1', 'api-key', adminUser);

    expect(result.value).toBe('secret');
    expect(provider.getSecret).toHaveBeenCalled();
  });

  it('blocks rotation for ROLE_VIEWER before hitting provider', async () => {
    const provider = new MockProvider();
    const rbac = new RbacService();
    const service = new SecretsService(provider, rbac);

    await expect(service.rotateSecret('tenant-1', 'api-key', viewerUser)).rejects.toBeInstanceOf(
      AuthorizationError
    );

    expect(provider.rotateSecret).not.toHaveBeenCalled();
  });

  it('permits write operations for roles with write permission', async () => {
    const provider = new MockProvider();
    const rbac = new RbacService();
    const service = new SecretsService(provider, rbac);

    const metadata: SecretMetadata = {
      tenantId: 'tenant-1',
      secretPath: 'path',
      version: 'v1',
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      sensitivityLevel: 'high',
    };

    const success = await service.setSecret('tenant-1', 'api-key', { value: 'x' }, metadata, adminUser);

    expect(success).toBe(true);
    expect(provider.setSecret).toHaveBeenCalled();
  });
});
