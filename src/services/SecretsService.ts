import { createProviderFromEnv } from '../config/secrets/ProviderFactory';
import type { ISecretProvider, SecretMetadata, SecretValue } from '../config/secrets/ISecretProvider';
import { logger } from '../lib/logger';
import { AuthorizationError } from './errors';
import { RbacService, RbacUser, SecretPermission } from './RbacService';

export class SecretsService {
  private provider: ISecretProvider;
  private rbac: RbacService;

  constructor(provider?: ISecretProvider, rbac?: RbacService) {
    this.provider = provider ?? createProviderFromEnv();
    this.rbac = rbac ?? new RbacService();
  }

  private enforce(user: RbacUser | undefined, permission: SecretPermission, tenantId: string): void {
    if (this.rbac.can(user, permission, tenantId)) {
      return;
    }

    logger.warn('Forbidden secret access attempt', {
      userId: user?.id,
      tenantId,
      permission,
      provider: this.provider.getProviderName(),
    });

    throw new AuthorizationError(`Forbidden: missing ${permission}`);
  }

  async getSecret(tenantId: string, secretKey: string, user?: RbacUser): Promise<SecretValue> {
    this.enforce(user, 'secrets:read', tenantId);
    return this.provider.getSecret(tenantId, secretKey, undefined, user?.id);
  }

  async listSecrets(tenantId: string, user?: RbacUser): Promise<string[]> {
    this.enforce(user, 'secrets:list', tenantId);
    return this.provider.listSecrets(tenantId, user?.id);
  }

  async setSecret(
    tenantId: string,
    secretKey: string,
    value: SecretValue,
    metadata: SecretMetadata,
    user?: RbacUser
  ): Promise<boolean> {
    this.enforce(user, 'secrets:write', tenantId);
    return this.provider.setSecret(tenantId, secretKey, value, metadata, user?.id);
  }

  async rotateSecret(tenantId: string, secretKey: string, user?: RbacUser): Promise<boolean> {
    this.enforce(user, 'secrets:rotate', tenantId);
    return this.provider.rotateSecret(tenantId, secretKey, user?.id);
  }

  async deleteSecret(tenantId: string, secretKey: string, user?: RbacUser): Promise<boolean> {
    this.enforce(user, 'secrets:delete', tenantId);
    return this.provider.deleteSecret(tenantId, secretKey, user?.id);
  }

  async secretExists(tenantId: string, secretKey: string, user?: RbacUser): Promise<boolean> {
    this.enforce(user, 'secrets:read', tenantId);
    return this.provider.secretExists(tenantId, secretKey, user?.id);
  }
}

export const secretsService = new SecretsService();
