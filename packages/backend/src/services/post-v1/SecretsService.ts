import type {
  ISecretProvider,
  SecretMetadata,
  SecretValue,
} from "../../config/secrets/ISecretProvider.js";
import { createProviderFromEnv } from "../../config/secrets/ProviderFactory.js";

import { AuthorizationError } from "./errors.js";
import { RbacService, RbacUser, SecretPermission } from "./RbacService.js";

// Re-export for backward compatibility
export type { SecretPermissionType as SecretPermission } from "./RbacService.js";

export class SecretsService {
  private provider: ISecretProvider;
  private rbac: RbacService;

  /**
   * @param provider - Secret provider (defaults to env-configured provider)
   * @param rbac - RBAC service (defaults to new RbacService())
   */
  constructor(provider?: ISecretProvider, rbac?: RbacService) {
    this.provider = provider ?? createProviderFromEnv();
    this.rbac = rbac ?? new RbacService();
  }

  async getSecret(tenantId: string, key: string, user: RbacUser): Promise<SecretValue> {
    if (!this.rbac.can(user, SecretPermission.READ, key)) {
      throw new AuthorizationError("Insufficient permissions to read secret");
    }

    return await this.provider.getSecret(tenantId, key, undefined, user.id);
  }

  async setSecret(
    tenantId: string,
    key: string,
    value: SecretValue,
    metadata: SecretMetadata,
    user?: RbacUser
  ): Promise<boolean> {
    if (!user) {
      throw new AuthorizationError("User context is required to write a secret");
    }
    if (!this.rbac.can(user, SecretPermission.WRITE, key)) {
      throw new AuthorizationError("Insufficient permissions to write secret");
    }

    return await this.provider.setSecret(tenantId, key, value, metadata, user.id);
  }

  async rotateSecret(tenantId: string, key: string, user: RbacUser): Promise<boolean> {
    if (!this.rbac.can(user, SecretPermission.WRITE, key)) {
      throw new AuthorizationError("Insufficient permissions to rotate secret");
    }

    return await this.provider.rotateSecret(tenantId, key, user.id);
  }

  async deleteSecret(tenantId: string, key: string, user: RbacUser): Promise<void> {
    if (!this.rbac.can(user, SecretPermission.DELETE, key)) {
      throw new AuthorizationError("Insufficient permissions to delete secret");
    }

    await this.provider.deleteSecret(tenantId, key, user.id);
  }

  async listSecrets(tenantId: string, user: RbacUser): Promise<string[]> {
    if (!this.rbac.can(user, SecretPermission.LIST, "*")) {
      throw new AuthorizationError("Insufficient permissions to list secrets");
    }

    return await this.provider.listSecrets(tenantId, user.id);
  }
}
