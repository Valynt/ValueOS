/**
 * Secret Provider Factory
 *
 * Factory for creating secret provider instances based on configuration.
 * Supported backends: AWS Secrets Manager, HashiCorp Vault, Infisical.
 */

import { logger } from "../../lib/logger.js"

import { AWSSecretProvider } from "./AWSSecretProvider.js"
import { FallbackSecretProvider } from "./FallbackSecretProvider.js"
import { InfisicalSecretProvider } from "./InfisicalSecretProvider.js"
import type {
  IProviderFactory,
  ISecretProvider,
  ProviderConfig,
} from "./ISecretProvider";
import { VaultSecretProvider } from "./VaultSecretProvider.js"


/**
 * Provider factory implementation
 */
export class ProviderFactory implements IProviderFactory {
  private static instance: ProviderFactory;
  private providers: Map<string, ISecretProvider> = new Map();

  private constructor() {
    logger.info("Provider factory initialized");
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
      logger.info("Returning cached provider", { provider: config.provider });
      return this.providers.get(providerKey)!;
    }

    // Create new provider
    let provider: ISecretProvider;

    switch (config.provider) {
      case "aws":
        provider = this.createAWSProvider(config);
        break;

      case "vault":
        provider = this.createVaultProvider(config);
        break;

      case "infisical":
        provider = this.createInfisicalProvider(config);
        break;

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }

    // Cache provider
    this.providers.set(providerKey, provider);

    logger.info("Created new provider", {
      provider: config.provider,
      cached: true,
    });

    return provider;
  }

  /**
   * Create AWS Secrets Manager provider
   */
  private createAWSProvider(config: ProviderConfig): AWSSecretProvider {
    const region = config.region || process.env.AWS_REGION || "us-east-1";
    const cacheTTL = config.cacheTTL || 300000; // 5 minutes

    logger.info("Creating AWS Secrets Manager provider", { region });

    return new AWSSecretProvider(region, cacheTTL);
  }

  /**
   * Create HashiCorp Vault provider
   */
  private createVaultProvider(config: ProviderConfig): VaultSecretProvider {
    const vaultAddress = config.vaultAddress || process.env.VAULT_ADDR;
    const vaultNamespace =
      config.vaultNamespace || process.env.VAULT_NAMESPACE || "valuecanvas";
    const kubernetesRole = process.env.VAULT_K8S_ROLE;
    const cacheTTL = config.cacheTTL || 300000; // 5 minutes

    if (!vaultAddress) {
      throw new Error(
        "Vault address not configured. Set VAULT_ADDR or provide vaultAddress in config."
      );
    }

    logger.info("Creating HashiCorp Vault provider", {
      address: vaultAddress,
      namespace: vaultNamespace,
    });

    const provider = new VaultSecretProvider(
      vaultAddress,
      vaultNamespace,
      kubernetesRole,
      cacheTTL
    );

    // Initialize Vault client asynchronously
    provider.initialize().catch((error) => {
      logger.error("Failed to initialize Vault provider", error);
    });

    return provider;
  }

  /**
   * Create Infisical provider
   */
  private createInfisicalProvider(config: ProviderConfig): InfisicalSecretProvider {
    const siteUrl =
      config.infisicalSiteUrl ||
      process.env.INFISICAL_SITE_URL ||
      "https://app.infisical.com";
    const clientId =
      config.infisicalClientId || process.env.INFISICAL_CLIENT_ID;
    const clientSecret =
      config.infisicalClientSecret || process.env.INFISICAL_CLIENT_SECRET;
    const projectId =
      config.infisicalProjectId || process.env.INFISICAL_PROJECT_ID;
    const environment = config.environment || process.env.NODE_ENV || "prod";
    const cacheTTL = config.cacheTTL || 300000;

    if (!clientId || !clientSecret) {
      throw new Error(
        "Infisical credentials not configured. Set INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET."
      );
    }

    if (!projectId) {
      throw new Error(
        "Infisical project ID not configured. Set INFISICAL_PROJECT_ID."
      );
    }

    logger.info("Creating Infisical provider", {
      siteUrl,
      projectId,
      environment,
    });

    return new InfisicalSecretProvider({
      siteUrl,
      clientId,
      clientSecret,
      projectId,
      environment,
      cacheTTL,
    });
  }

  /**
   * Get provider key for caching
   */
  private getProviderKey(config: ProviderConfig): string {
    switch (config.provider) {
      case "aws":
        return `aws:${config.region || "us-east-1"}`;
      case "vault":
        return `vault:${config.vaultAddress}`;
      case "infisical":
        return `infisical:${config.infisicalSiteUrl || "cloud"}`;
      default:
        return config.provider ?? "unknown";
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return ["aws", "vault", "infisical"];
  }

  /**
   * Clear provider cache (for testing)
   */
  clearCache(): void {
    this.providers.clear();
    logger.info("Provider cache cleared");
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
 * Supports fallback providers for high availability
 */
export function createProviderFromEnv(): ISecretProvider {
  const primaryProviderType =
    (process.env.SECRETS_PROVIDER as "aws" | "vault" | "infisical") || "aws";
  const enableFallback = process.env.SECRETS_FALLBACK_ENABLED !== "false";

  const config: ProviderConfig = {
    provider: primaryProviderType,
    region: process.env.AWS_REGION,
    vaultAddress: process.env.VAULT_ADDR,
    vaultNamespace: process.env.VAULT_NAMESPACE,
    infisicalSiteUrl: process.env.INFISICAL_SITE_URL,
    infisicalClientId: process.env.INFISICAL_CLIENT_ID,
    infisicalClientSecret: process.env.INFISICAL_CLIENT_SECRET,
    infisicalProjectId: process.env.INFISICAL_PROJECT_ID,
    cacheTTL: parseInt(process.env.SECRETS_CACHE_TTL || "300000", 10),
    auditEnabled: process.env.AUDIT_LOG_ENABLED !== "false",
  };

  const factory = ProviderFactory.getInstance();
  const primaryProvider = factory.createProvider(config);

  // If fallback is disabled, return primary provider only
  if (!enableFallback) {
    logger.info("Creating single provider (fallback disabled)", {
      provider: primaryProviderType,
      auditEnabled: config.auditEnabled,
    });
    return primaryProvider;
  }

  // Create fallback providers
  const fallbackProviders: ISecretProvider[] = [];

  // Add AWS as fallback if not primary
  if (primaryProviderType !== "aws" && process.env.AWS_REGION) {
    try {
      const awsConfig: ProviderConfig = {
        ...config,
        provider: "aws",
      };
      const awsProvider = factory.createProvider(awsConfig);
      fallbackProviders.push(awsProvider);
    } catch (error) {
      logger.warn("Failed to create AWS fallback provider", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Add Vault as fallback if not primary
  if (primaryProviderType !== "vault" && process.env.VAULT_ADDR) {
    try {
      const vaultConfig: ProviderConfig = {
        ...config,
        provider: "vault",
      };
      const vaultProvider = factory.createProvider(vaultConfig);
      fallbackProviders.push(vaultProvider);
    } catch (error) {
      logger.warn("Failed to create Vault fallback provider", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Add Infisical as fallback if not primary
  if (primaryProviderType !== "infisical" && process.env.INFISICAL_CLIENT_ID) {
    try {
      const infisicalConfig: ProviderConfig = {
        ...config,
        provider: "infisical",
      };
      const infisicalProvider = factory.createProvider(infisicalConfig);
      fallbackProviders.push(infisicalProvider);
    } catch (error) {
      logger.warn("Failed to create Infisical fallback provider", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // If no fallback providers available, return primary only
  if (fallbackProviders.length === 0) {
    logger.info("No fallback providers available, using primary only", {
      primaryProvider: primaryProviderType,
    });
    return primaryProvider;
  }

  // Create fallback provider
  const retryPrimaryAfter = parseInt(
    process.env.SECRETS_RETRY_PRIMARY_AFTER || "300000",
    10
  ); // 5 minutes default

  const fallbackProvider = new FallbackSecretProvider({
    primary: primaryProvider,
    fallbacks: fallbackProviders,
    retryPrimaryAfter,
  });

  logger.info("Created fallback provider configuration", {
    primaryProvider: primaryProviderType,
    fallbackProviders: fallbackProviders.map((p) => p.getProviderName()),
    retryPrimaryAfter,
  });

  return fallbackProvider;
}

/**
 * Get singleton provider factory
 */
export const providerFactory = ProviderFactory.getInstance();
export const defaultProvider = createProviderFromEnv();
