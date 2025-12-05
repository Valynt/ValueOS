/**
 * Secret Provider Factory
 * 
 * Factory for creating secret provider instances based on configuration
 * Supports AWS Secrets Manager, HashiCorp Vault, and Azure Key Vault
 * 
 * Sprint 2: Provider Abstraction
 * Created: 2024-11-29
 */

import type { ISecretProvider, IProviderFactory, ProviderConfig } from './ISecretProvider';
import { AWSSecretProvider } from './AWSSecretProvider';
import { VaultSecretProvider } from './VaultSecretProvider';
import { logger } from '../../lib/logger';

/**
 * Provider factory implementation
 */
export class ProviderFactory implements IProviderFactory {
  private static instance: ProviderFactory;
  private providers: Map<string, ISecretProvider> = new Map();

  private constructor() {
    logger.info('Provider factory initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  /**
   * Create a secret provider based on configuration
   */
  createProvider(config: ProviderConfig): ISecretProvider {
    const providerKey = this.getProviderKey(config);

    // Return cached provider if exists
    if (this.providers.has(providerKey)) {
      logger.info('Returning cached provider', { provider: config.provider });
      return this.providers.get(providerKey)!;
    }

    // Create new provider
    let provider: ISecretProvider;

    switch (config.provider) {
      case 'aws':
        provider = this.createAWSProvider(config);
        break;

      case 'vault':
        provider = this.createVaultProvider(config);
        break;

      case 'azure':
        throw new Error('Azure Key Vault provider not yet implemented (Sprint 4)');

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }

    // Cache provider
    this.providers.set(providerKey, provider);

    logger.info('Created new provider', {
      provider: config.provider,
      cached: true
    });

    return provider;
  }

  /**
   * Create AWS Secrets Manager provider
   */
  private createAWSProvider(config: ProviderConfig): AWSSecretProvider {
    const region = config.region || process.env.AWS_REGION || 'us-east-1';
    const cacheTTL = config.cacheTTL || 300000; // 5 minutes

    logger.info('Creating AWS Secrets Manager provider', { region });

    return new AWSSecretProvider(region, cacheTTL);
  }

  /**
   * Create HashiCorp Vault provider
   */
  private createVaultProvider(config: ProviderConfig): VaultSecretProvider {
    const vaultAddress = config.vaultAddress || process.env.VAULT_ADDR;
    const vaultNamespace = config.vaultNamespace || process.env.VAULT_NAMESPACE || 'valuecanvas';
    const kubernetesRole = process.env.VAULT_K8S_ROLE;
    const cacheTTL = config.cacheTTL || 300000; // 5 minutes

    if (!vaultAddress) {
      throw new Error('Vault address not configured. Set VAULT_ADDR or provide vaultAddress in config.');
    }

    logger.info('Creating HashiCorp Vault provider', {
      address: vaultAddress,
      namespace: vaultNamespace
    });

    const provider = new VaultSecretProvider(
      vaultAddress,
      vaultNamespace,
      kubernetesRole,
      cacheTTL
    );

    // Initialize Vault client asynchronously
    provider.initialize().catch(error => {
      logger.error('Failed to initialize Vault provider', error);
    });

    return provider;
  }

  /**
   * Get provider key for caching
   */
  private getProviderKey(config: ProviderConfig): string {
    switch (config.provider) {
      case 'aws':
        return `aws:${config.region || 'us-east-1'}`;
      case 'vault':
        return `vault:${config.vaultAddress}`;
      case 'azure':
        return `azure:${config.azureKeyVaultName}`;
      default:
        return config.provider;
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return ['aws', 'vault', 'azure (coming soon)'];
  }

  /**
   * Clear provider cache (for testing)
   */
  clearCache(): void {
    this.providers.clear();
    logger.info('Provider cache cleared');
  }

  /**
   * Get provider from cache
   */
  getProvider(providerKey: string): ISecretProvider | undefined {
    return this.providers.get(providerKey);
  }
}

/**
 * Create provider from environment configuration
 * 
 * Reads SECRETS_PROVIDER environment variable to determine which provider to use
 */
export function createProviderFromEnv(): ISecretProvider {
  const providerType = process.env.SECRETS_PROVIDER as 'aws' | 'vault' | 'azure' || 'aws';
  
  const config: ProviderConfig = {
    provider: providerType,
    region: process.env.AWS_REGION,
    vaultAddress: process.env.VAULT_ADDR,
    vaultNamespace: process.env.VAULT_NAMESPACE,
    azureKeyVaultName: process.env.AZURE_KEY_VAULT_NAME,
    cacheTTL: parseInt(process.env.SECRETS_CACHE_TTL || '300000', 10),
    auditEnabled: process.env.AUDIT_LOG_ENABLED !== 'false'
  };

  logger.info('Creating provider from environment', {
    provider: providerType,
    auditEnabled: config.auditEnabled
  });

  const factory = ProviderFactory.getInstance();
  return factory.createProvider(config);
}

/**
 * Get singleton provider factory
 */
export const providerFactory = ProviderFactory.getInstance();

/**
 * Get default provider (reads from environment)
 */
export const defaultProvider = createProviderFromEnv();
