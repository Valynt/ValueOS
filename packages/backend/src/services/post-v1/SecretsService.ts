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

  constructor() {
    this.provider = createProviderFromEnv();
    this.rbac = new RbacService();
  }

  async getSecret(user: RbacUser, key: string): Promise<SecretValue> {
    if (!this.rbac.can(user, SecretPermission.READ, key)) {
      throw new AuthorizationError("Insufficient permissions to read secret");
    }

    return await this.provider.getSecret(key);
  }

  async setSecret(
    user: RbacUser,
    key: string,
    value: SecretValue,
    metadata?: SecretMetadata
  ): Promise<void> {
    if (!this.rbac.can(user, SecretPermission.WRITE, key)) {
      throw new AuthorizationError("Insufficient permissions to write secret");
    }

    await this.provider.setSecret(key, value, metadata);
  }

  async deleteSecret(user: RbacUser, key: string): Promise<void> {
    if (!this.rbac.can(user, SecretPermission.DELETE, key)) {
      throw new AuthorizationError("Insufficient permissions to delete secret");
    }

    await this.provider.deleteSecret(key);
  }

  async listSecrets(user: RbacUser): Promise<string[]> {
    if (!this.rbac.can(user, SecretPermission.LIST, "*")) {
      throw new AuthorizationError("Insufficient permissions to list secrets");
    }

    return await this.provider.listSecrets();
  }
}
