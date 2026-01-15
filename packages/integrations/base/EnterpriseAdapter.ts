/**
 * Abstract base class for enterprise adapters
 *
 * Rules:
 * - Shared logic only (retry, logging hooks, metrics)
 * - No app-specific logic
 */

import type {
  FetchOptions,
  IEnterpriseAdapter,
} from "./IEnterpriseAdapter.js";
import type {
  IntegrationConfig,
  IntegrationCredentials,
  NormalizedEntity,
  SyncResult,
} from "./types.js";
import { RateLimiter } from "./RateLimiter.js";
import { ConnectionError, IntegrationError } from "./errors.js";

export abstract class EnterpriseAdapter implements IEnterpriseAdapter {
  abstract readonly provider: string;

  protected credentials: IntegrationCredentials | null = null;
  protected readonly rateLimiter: RateLimiter;
  protected readonly config: IntegrationConfig;

  constructor(config: IntegrationConfig, rateLimiter: RateLimiter) {
    this.config = config;
    this.rateLimiter = rateLimiter;
  }

  async connect(credentials: IntegrationCredentials): Promise<void> {
    this.credentials = credentials;
    await this.doConnect();
  }

  async disconnect(): Promise<void> {
    await this.doDisconnect();
    this.credentials = null;
  }

  abstract validate(): Promise<boolean>;

  abstract fetchEntities(
    entityType: string,
    options?: FetchOptions
  ): Promise<NormalizedEntity[]>;

  abstract fetchEntity(
    entityType: string,
    externalId: string
  ): Promise<NormalizedEntity | null>;

  abstract pushUpdate(
    entityType: string,
    externalId: string,
    data: Record<string, unknown>
  ): Promise<void>;

  async sync(entityTypes: string[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncResult["errors"] = [];
    let entitiesProcessed = 0;

    for (const entityType of entityTypes) {
      try {
        const entities = await this.fetchEntities(entityType);
        entitiesProcessed += entities.length;
      } catch (error) {
        if (error instanceof IntegrationError) {
          errors.push({
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      entitiesProcessed,
      errors,
      duration: Date.now() - startTime,
    };
  }

  protected abstract doConnect(): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;

  protected ensureConnected(): void {
    if (!this.credentials) {
      throw new ConnectionError(
        this.provider,
        "Adapter not connected. Call connect() first."
      );
    }
  }

  protected async withRateLimit<T>(
    tenantId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await this.rateLimiter.acquire(tenantId);
    return fn();
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    attempts: number = this.config.retryAttempts ?? 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (error instanceof IntegrationError && !error.retryable) {
          throw error;
        }
        await this.delay(Math.pow(2, i) * 1000);
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
