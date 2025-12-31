/**
 * Secret Provider Interface
 * 
 * Provider-agnostic interface for secrets management.
 * Supports multiple backends: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
 * 
 * Sprint 2: Provider Abstraction
 * Created: 2024-11-29
 */

/**
 * Secret value with metadata
 */
export interface SecretValue {
  [key: string]: string | undefined;
}

/**
 * Secret metadata for tracking and compliance
 */
export interface SecretMetadata {
  tenantId: string;
  secretPath: string;
  version: string;
  createdAt: string;
  lastAccessed: string;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  rotationPolicy?: RotationPolicy;
  tags?: Record<string, string>;
}

/**
 * Rotation policy configuration
 */
export interface RotationPolicy {
  enabled: boolean;
  intervalDays: number;
  gracePeriodHours: number;
  notifyStakeholders?: string[];
  autoRotate?: boolean;
}

/**
 * Audit action types
 */
export type AuditAction = 'READ' | 'WRITE' | 'DELETE' | 'ROTATE' | 'LIST';

/**
 * Audit result types
 */
export type AuditResult = 'SUCCESS' | 'FAILURE';

/**
 * Provider-agnostic secret manager interface
 * 
 * All secret providers must implement this interface to ensure
 * consistent behavior across AWS, Vault, Azure, etc.
 */
export interface ISecretProvider {
  /**
   * Get a secret value for a tenant
   * 
   * @param tenantId - Tenant identifier for isolation
   * @param secretKey - Key identifying the secret
   * @param version - Optional version (for versioned providers)
   * @param userId - User making the request (for RBAC)
   * @returns Secret value with metadata
   */
  getSecret(
    tenantId: string,
    secretKey: string,
    version?: string,
    userId?: string
  ): Promise<SecretValue>;

  /**
   * Set a secret value for a tenant
   * 
   * @param tenantId - Tenant identifier
   * @param secretKey - Key for the secret
   * @param value - Secret value to store
   * @param metadata - Metadata about the secret
   * @param userId - User making the request
   * @returns Success indicator
   */
  setSecret(
    tenantId: string,
    secretKey: string,
    value: SecretValue,
    metadata: SecretMetadata,
    userId?: string
  ): Promise<boolean>;

  /**
   * Rotate a secret (generate new value)
   * 
   * @param tenantId - Tenant identifier
   * @param secretKey - Key for the secret to rotate
   * @param userId - User making the request
   * @returns Success indicator
   */
  rotateSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean>;

  /**
   * Delete a secret permanently
   * 
   * @param tenantId - Tenant identifier
   * @param secretKey - Key for the secret to delete
   * @param userId - User making the request
   * @returns Success indicator
   */
  deleteSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean>;

  /**
   * List all secrets for a tenant (keys only, not values)
   * 
   * @param tenantId - Tenant identifier
   * @param userId - User making the request
   * @returns Array of secret keys
   */
  listSecrets(
    tenantId: string,
    userId?: string
  ): Promise<string[]>;

  /**
   * Get secret metadata without retrieving the value
   * 
   * @param tenantId - Tenant identifier
   * @param secretKey - Key for the secret
   * @param userId - User making the request
   * @returns Secret metadata
   */
  getSecretMetadata(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<SecretMetadata | null>;

  /**
   * Check if a secret exists
   * 
   * @param tenantId - Tenant identifier
   * @param secretKey - Key to check
   * @param userId - User making the request
   * @returns True if secret exists
   */
  secretExists(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean>;

  /**
   * Audit log for compliance
   * 
   * @param tenantId - Tenant identifier
   * @param secretKey - Key that was accessed
   * @param action - Action performed
   * @param result - Success or failure
   * @param userId - User who performed the action
   * @param error - Error message if failed
   * @param metadata - Additional context
   */
  auditAccess(
    tenantId: string,
    secretKey: string,
    action: AuditAction,
    result: AuditResult,
    userId?: string,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Check if provider is healthy
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Provider factory configuration
 */
export interface ProviderConfig {
  provider: 'aws' | 'vault' | 'azure';
  region?: string;
  vaultAddress?: string;
  vaultNamespace?: string;
  azureKeyVaultName?: string;
  cacheTTL?: number;
  auditEnabled?: boolean;
}

/**
 * Provider factory for creating secret providers
 */
export interface IProviderFactory {
  /**
   * Create a secret provider based on configuration
   * 
   * @param config - Provider configuration
   * @returns Secret provider instance
   */
  createProvider(config: ProviderConfig): ISecretProvider;

  /**
   * Get available providers
   */
  getAvailableProviders(): string[];
}
