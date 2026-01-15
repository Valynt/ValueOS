/**
 * Fallback Secret Provider
 *
 * Implements backup provider fallback pattern
 * Tries providers in order of preference, falling back to next on failure
 */

import { logger } from "../../lib/logger";
import type {
  AuditAction,
  AuditResult,
  ISecretProvider,
  SecretMetadata,
  SecretValue,
} from "./ISecretProvider";

export interface FallbackProviderConfig {
  primary: ISecretProvider;
  fallbacks: ISecretProvider[];
  retryPrimaryAfter?: number; // Time in ms to wait before retrying primary
}

/**
 * Fallback provider that tries multiple providers in order
 */
export class FallbackSecretProvider implements ISecretProvider {
  private primary: ISecretProvider;
  private fallbacks: ISecretProvider[];
  private retryPrimaryAfter: number;
  private lastPrimaryFailure = 0;
  private primaryRetries = 0;
  private maxRetries = 3;

  constructor(config: FallbackProviderConfig) {
    this.primary = config.primary;
    this.fallbacks = config.fallbacks;
    this.retryPrimaryAfter = config.retryPrimaryAfter || 300000; // 5 minutes default

    logger.info("Fallback secret provider initialized", {
      primaryProvider: this.primary.getProviderName(),
      fallbackCount: this.fallbacks.length,
      fallbackProviders: this.fallbacks.map((p) => p.getProviderName()),
      retryPrimaryAfter: this.retryPrimaryAfter,
    });
  }

  /**
   * Get all providers in order (primary first, then fallbacks)
   */
  private getProvidersInOrder(): ISecretProvider[] {
    // Check if we should retry primary
    const now = Date.now();
    const shouldRetryPrimary =
      now - this.lastPrimaryFailure > this.retryPrimaryAfter;

    if (shouldRetryPrimary && this.primaryRetries < this.maxRetries) {
      return [this.primary, ...this.fallbacks];
    }

    return [...this.fallbacks, this.primary];
  }

  async getSecret(
    tenantId: string,
    secretKey: string,
    version?: string,
    userId?: string
  ): Promise<SecretValue> {
    const providers = this.getProvidersInOrder();
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const result = await provider.getSecret(
          tenantId,
          secretKey,
          version,
          userId
        );

        // If we got result from fallback, log it
        if (provider !== this.primary) {
          logger.warn("Secret retrieved from fallback provider", {
            tenantId,
            secretKey,
            provider: provider.getProviderName(),
            primaryProvider: this.primary.getProviderName(),
          });
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        logger.warn("Provider failed, trying next", {
          tenantId,
          secretKey,
          failedProvider: provider.getProviderName(),
          error: err.message,
        });

        // Track primary failures
        if (provider === this.primary) {
          this.lastPrimaryFailure = Date.now();
          this.primaryRetries++;
        }

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    const errorMsg = `All secret providers failed for ${tenantId}:${secretKey}`;
    logger.error(errorMsg, {
      tenantId,
      secretKey,
      providersTried: providers.map((p) => p.getProviderName()),
      lastError: lastError?.message,
    });

    throw lastError || new Error(errorMsg);
  }

  async setSecret(
    tenantId: string,
    secretKey: string,
    value: SecretValue,
    metadata: SecretMetadata,
    userId?: string
  ): Promise<boolean> {
    // Always try primary first for writes
    try {
      const result = await this.primary.setSecret(
        tenantId,
        secretKey,
        value,
        metadata,
        userId
      );

      // Reset failure tracking on success
      this.primaryRetries = 0;

      return result;
    } catch (error) {
      logger.warn("Primary provider write failed, operation aborted", {
        tenantId,
        secretKey,
        provider: this.primary.getProviderName(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  async rotateSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    // Always try primary first for rotations
    try {
      const result = await this.primary.rotateSecret(
        tenantId,
        secretKey,
        userId
      );

      // Reset failure tracking on success
      this.primaryRetries = 0;

      return result;
    } catch (error) {
      logger.warn("Primary provider rotation failed, operation aborted", {
        tenantId,
        secretKey,
        provider: this.primary.getProviderName(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  async deleteSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    // Always try primary first for deletions
    try {
      const result = await this.primary.deleteSecret(
        tenantId,
        secretKey,
        userId
      );

      // Reset failure tracking on success
      this.primaryRetries = 0;

      return result;
    } catch (error) {
      logger.warn("Primary provider deletion failed, operation aborted", {
        tenantId,
        secretKey,
        provider: this.primary.getProviderName(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  async listSecrets(tenantId: string, userId?: string): Promise<string[]> {
    const providers = this.getProvidersInOrder();

    for (const provider of providers) {
      try {
        const result = await provider.listSecrets(tenantId, userId);

        // If we got result from fallback, log it
        if (provider !== this.primary) {
          logger.warn("Secrets listed from fallback provider", {
            tenantId,
            provider: provider.getProviderName(),
            primaryProvider: this.primary.getProviderName(),
            count: result.length,
          });
        }

        return result;
      } catch (error) {
        logger.warn("Provider list failed, trying next", {
          tenantId,
          failedProvider: provider.getProviderName(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
        continue;
      }
    }

    // All providers failed
    const errorMsg = `All secret providers failed to list secrets for ${tenantId}`;
    logger.error(errorMsg, {
      tenantId,
      providersTried: providers.map((p) => p.getProviderName()),
    });

    throw new Error(errorMsg);
  }

  async getSecretMetadata(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<SecretMetadata | null> {
    const providers = this.getProvidersInOrder();

    for (const provider of providers) {
      try {
        const result = await provider.getSecretMetadata(
          tenantId,
          secretKey,
          userId
        );

        // If we got result from fallback, log it
        if (provider !== this.primary && result) {
          logger.warn("Secret metadata retrieved from fallback provider", {
            tenantId,
            secretKey,
            provider: provider.getProviderName(),
            primaryProvider: this.primary.getProviderName(),
          });
        }

        return result;
      } catch (error) {
        logger.warn("Provider metadata failed, trying next", {
          tenantId,
          secretKey,
          failedProvider: provider.getProviderName(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
        continue;
      }
    }

    // All providers failed
    logger.warn("All providers failed to get secret metadata", {
      tenantId,
      secretKey,
      providersTried: providers.map((p) => p.getProviderName()),
    });

    return null; // Metadata is not critical, return null on failure
  }

  async secretExists(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    const providers = this.getProvidersInOrder();

    for (const provider of providers) {
      try {
        const result = await provider.secretExists(tenantId, secretKey, userId);

        // If we got result from fallback, log it
        if (provider !== this.primary && result) {
          logger.warn("Secret existence checked from fallback provider", {
            tenantId,
            secretKey,
            provider: provider.getProviderName(),
            primaryProvider: this.primary.getProviderName(),
          });
        }

        return result;
      } catch (error) {
        logger.warn("Provider exists check failed, trying next", {
          tenantId,
          secretKey,
          failedProvider: provider.getProviderName(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
        continue;
      }
    }

    // All providers failed, assume secret doesn't exist
    return false;
  }

  async auditAccess(
    tenantId: string,
    secretKey: string,
    action: AuditAction,
    result: AuditResult,
    userId?: string,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Always audit to primary provider
    await this.primary.auditAccess(
      tenantId,
      secretKey,
      action,
      result,
      userId,
      error,
      metadata
    );
  }

  getProviderName(): string {
    return `fallback(${this.primary.getProviderName()})`;
  }

  async healthCheck(): Promise<boolean> {
    const providers = [this.primary, ...this.fallbacks];
    let anyHealthy = false;

    for (const provider of providers) {
      try {
        const healthy = await provider.healthCheck();
        if (healthy) {
          anyHealthy = true;
          break;
        }
      } catch (error) {
        logger.warn("Provider health check failed", {
          provider: provider.getProviderName(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return anyHealthy;
  }

  /**
   * Get fallback status for monitoring
   */
  getFallbackStatus(): {
    primaryProvider: string;
    fallbackProviders: string[];
    isUsingFallback: boolean;
    primaryRetries: number;
    lastPrimaryFailure: number;
    retryPrimaryAfter: number;
  } {
    const now = Date.now();
    const shouldRetryPrimary =
      now - this.lastPrimaryFailure > this.retryPrimaryAfter;

    return {
      primaryProvider: this.primary.getProviderName(),
      fallbackProviders: this.fallbacks.map((p) => p.getProviderName()),
      isUsingFallback:
        !shouldRetryPrimary || this.primaryRetries >= this.maxRetries,
      primaryRetries: this.primaryRetries,
      lastPrimaryFailure: this.lastPrimaryFailure,
      retryPrimaryAfter: this.retryPrimaryAfter,
    };
  }
}
