/**
 * AWS Secrets Manager Provider
 *
 * Implementation of ISecretProvider for AWS Secrets Manager
 * Refactored from secretsManager.v2.ts to use provider interface
 *
 * Sprint 2: Provider Abstraction
 * Created: 2024-11-29
 */

import {
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  PutSecretValueCommand,
  RotateSecretCommand,
  SecretsManagerClient,
  type GetSecretValueCommandOutput,
} from "@aws-sdk/client-secrets-manager";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import type { Redis as RedisClientType } from 'ioredis';

import { logger } from "../../lib/logger.js"
import { getRedisClient } from "../../lib/redisClient";
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
} from "../../lib/resilience/CircuitBreaker.js";

import { awsCacheMonitor } from "./CachePerformanceMonitor.js"

function createConfigurableCircuitBreaker(config: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}
import { InputValidator } from "./InputValidator.js"
import type {
  AuditAction,
  AuditResult,
  ISecretProvider,
  SecretMetadata,
  SecretValue,
} from "./ISecretProvider";
import {
  SecretAuditEvent,
  StructuredSecretAuditLogger,
} from "./SecretAuditLogger";
import { config } from "./SecretConfig.js"

/**
 * AWS Secrets Manager provider implementation
 */
export class AWSSecretProvider implements ISecretProvider {
  private client: { send: (cmd: unknown) => Promise<unknown> };
  private environment: string;
  private cache: Map<string, { value: SecretValue; expiresAt: number }> =
    new Map();
  private redisClient: RedisClientType | null = null;
  private cacheTTL: number;
  private auditLogger: StructuredSecretAuditLogger;
  private redisEnabled: boolean;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second base delay
  private encryptionKey: Buffer;
  private circuitBreaker: { execute: <T>(fn: () => Promise<T>) => Promise<T> };

  constructor(
    region: string = "us-east-1",
    cacheTTL: number = 300000 // 5 minutes
  ) {
    // Configure AWS client with connection pooling
    this.client = new SecretsManagerClient({
      region,
      maxAttempts: this.maxRetries,
      requestHandler: {
        // Connection pooling configuration
        socketTimeout: 60000, // 60 seconds
        connectionTimeout: 10000, // 10 seconds
        keepAlive: true,
        maxSockets: 50, // Connection pool size
      },
    });
    this.environment = process.env.NODE_ENV || "development";
    this.cacheTTL = cacheTTL;
    this.auditLogger = new StructuredSecretAuditLogger();
    this.redisEnabled = process.env.REDIS_URL ? true : false;
    // Generate a random encryption key for cache encryption
    this.encryptionKey = randomBytes(32);
    // Initialize circuit breaker for external API calls
    this.circuitBreaker = createConfigurableCircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30_000,
      monitoringPeriod: 60_000,
      successThreshold: 3,
    });

    // Initialize Redis client for distributed caching
    if (this.redisEnabled) {
      Promise.resolve(getRedisClient())
        .then((client) => {
          this.redisClient = client;
          logger.info(
            "Redis client initialized for distributed secret caching"
          );
        })
        .catch((error) => {
          logger.warn(
            "Failed to initialize Redis client, falling back to in-memory cache",
            error
          );
          this.redisEnabled = false;
        });
    }

    logger.info("AWS Secret Provider initialized", {
      provider: "aws",
      region,
      environment: this.environment,
      distributedCache: this.redisEnabled,
    });
  }

  /**
   * Encrypt data for secure cache storage
   */
  private encrypt(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", this.encryptionKey, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  /**
   * Decrypt data from secure cache storage
   */
  private decrypt(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Generate tenant-isolated AWS secret path
   */
  private getTenantSecretPath(tenantId: string, secretKey: string): string {
    if (!tenantId || !secretKey) {
      throw new Error("Tenant ID and secret key are required");
    }

    // Validate format
    if (!/^[a-zA-Z0-9-_]+$/.test(tenantId)) {
      throw new Error("Invalid tenant ID format");
    }

    return `valuecanvas/${this.environment}/tenants/${tenantId}/${secretKey}`;
  }

  /**
   * Get cache key
   */
  private getCacheKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  /**
   * Get secret from Redis cache
   */
  private async getFromRedisCache(
    cacheKey: string
  ): Promise<SecretValue | null> {
    if (!this.redisClient || !this.redisEnabled) {
      return null;
    }

    const startTime = Date.now();

    try {
      const cached = await this.redisClient.get(`secret:${cacheKey}`);
      const latency = Date.now() - startTime;

      if (!cached) {
        awsCacheMonitor.recordOperation({
          operation: "get",
          cacheType: "redis",
          hit: false,
          latency,
        });
        return null;
      }

      const parsed = JSON.parse(cached);
      if (parsed.expiresAt > Date.now()) {
        const decryptedValue = JSON.parse(
          this.decrypt(parsed.value)
        ) as SecretValue;

        awsCacheMonitor.recordOperation({
          operation: "get",
          cacheType: "redis",
          hit: true,
          latency,
        });

        return decryptedValue;
      } else {
        // Cache expired, remove it
        await this.redisClient.del(`secret:${cacheKey}`);

        awsCacheMonitor.recordOperation({
          operation: "get",
          cacheType: "redis",
          hit: false,
          latency,
        });

        return null;
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      awsCacheMonitor.recordOperation({
        operation: "get",
        cacheType: "redis",
        hit: false,
        latency,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.warn(
        "Failed to get secret from Redis cache",
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Set secret in Redis cache
   */
  private async setInRedisCache(
    cacheKey: string,
    value: SecretValue
  ): Promise<void> {
    if (!this.redisClient || !this.redisEnabled) {
      return;
    }

    try {
      const cacheData = {
        value: this.encrypt(JSON.stringify(value)),
        expiresAt: Date.now() + this.cacheTTL,
      };
      await this.redisClient.setex(
        `secret:${cacheKey}`,
        Math.floor(this.cacheTTL / 1000),
        JSON.stringify(cacheData)
      );
    } catch (error) {
      logger.warn(
        "Failed to set secret in Redis cache",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Invalidate a key in the Redis cache
   */
  private async invalidateRedisCache(cacheKey: string): Promise<void> {
    if (!this.redisClient || !this.redisEnabled) return;
    try {
      await this.redisClient.del(`secret:${cacheKey}`);
    } catch (error) {
      logger.warn('Failed to invalidate Redis cache key', { cacheKey, error: String(error) });
    }
  }

  /**
   * Retry wrapper with exponential backoff for AWS SDK calls
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    tenantId?: string,
    secretKey?: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          logger.warn(`${operationName} failed with non-retryable error`, {
            attempt,
            error: lastError.message,
            tenantId,
            secretKey,
          });
          throw lastError;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
            attempt,
            maxRetries: this.maxRetries,
            delay,
            error: lastError.message,
            tenantId,
            secretKey,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          logger.error(`${operationName} failed after all retries`, {
            attempts: this.maxRetries,
            error: lastError.message,
            tenantId,
            secretKey,
          });
        }
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableCodes = [
      "InvalidParameterException",
      "InvalidRequestException",
      "ResourceNotFoundException",
      "AccessDeniedException",
      "UnauthorizedOperation",
    ];

    // Check AWS error codes
    const e = error as Record<string, unknown>;
    const errorCode = (typeof e?.name === "string" ? e.name : undefined) ?? (typeof e?.code === "string" ? e.code : undefined);
    return nonRetryableCodes.includes(errorCode);
  }

  async getSecret(
    tenantId: string,
    secretKey: string,
    version?: string,
    userId?: string
  ): Promise<SecretValue> {
    // Validate inputs
    const validatedTenantId = InputValidator.validateOrThrow(
      tenantId,
      InputValidator.validateTenantId,
      "tenantId"
    );
    const validatedSecretKey = InputValidator.validateOrThrow(
      secretKey,
      InputValidator.validateSecretKey,
      "secretKey"
    );
    const validatedUserId = userId
      ? InputValidator.validateOrThrow(
          userId,
          InputValidator.validateUserId,
          "userId"
        )
      : undefined;
    const validatedVersion = version
      ? InputValidator.validateOrThrow(
          version,
          InputValidator.validateVersion,
          "version"
        )
      : undefined;

    const startTime = Date.now();
    const secretPath = this.getTenantSecretPath(
      validatedTenantId,
      validatedSecretKey
    );

    // Check Redis cache first
    const cacheKey = this.getCacheKey(tenantId, secretKey);
    const redisCached = await this.getFromRedisCache(cacheKey);

    if (redisCached) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "READ",
        "SUCCESS",
        userId,
        undefined,
        {
          source: "redis-cache",
          latency_ms: Date.now() - startTime,
        }
      );
      return redisCached;
    }

    // Check in-memory cache as fallback
    const inMemoryCached = this.cache.get(cacheKey);
    if (inMemoryCached && inMemoryCached.expiresAt > Date.now()) {
      const decryptedValue = JSON.parse(
        this.decrypt(inMemoryCached.value)
      ) as SecretValue;

      awsCacheMonitor.recordOperation({
        operation: "get",
        cacheType: "memory",
        hit: true,
        latency: Date.now() - startTime,
      });

      await this.auditAccess(
        tenantId,
        secretKey,
        "READ",
        "SUCCESS",
        userId,
        undefined,
        {
          source: "memory-cache",
          latency_ms: Date.now() - startTime,
        }
      );
      return decryptedValue;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretPath,
        VersionId: version,
      });

      const response = await this.circuitBreaker.execute(() =>
        this.retryWithBackoff(
          () => this.client.send(command),
          "GetSecretValue",
          tenantId,
          secretKey
        )
      ) as GetSecretValueCommandOutput;

      if (!response.SecretString) {
        throw new Error("Secret value is empty");
      }

      const secretValue = JSON.parse(response.SecretString) as SecretValue;

      // Cache the secret in both Redis and memory
      await this.setInRedisCache(cacheKey, secretValue);
      this.cache.set(cacheKey, {
        value: this.encrypt(JSON.stringify(secretValue)),
        expiresAt: Date.now() + this.cacheTTL,
      });

      await this.auditAccess(
        tenantId,
        secretKey,
        "READ",
        "SUCCESS",
        userId,
        undefined,
        {
          source: "aws",
          latency_ms: Date.now() - startTime,
          version,
        }
      );

      return secretValue;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "READ",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error),
        { latency_ms: Date.now() - startTime }
      );

      logger.error(
        "Failed to get secret from AWS",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretPath,
        }
      );

      throw error;
    }
  }

  async setSecret(
    tenantId: string,
    secretKey: string,
    value: SecretValue,
    metadata: SecretMetadata,
    userId?: string
  ): Promise<boolean> {
    // Validate inputs
    const validatedTenantId = InputValidator.validateOrThrow(
      tenantId,
      InputValidator.validateTenantId,
      "tenantId"
    );
    const validatedSecretKey = InputValidator.validateOrThrow(
      secretKey,
      InputValidator.validateSecretKey,
      "secretKey"
    );
    const validatedValue = InputValidator.validateOrThrow(
      value,
      InputValidator.validateSecretValue,
      "value"
    );
    const validatedUserId = userId
      ? InputValidator.validateOrThrow(
          userId,
          InputValidator.validateUserId,
          "userId"
        )
      : undefined;

    const secretPath = this.getTenantSecretPath(
      validatedTenantId,
      validatedSecretKey
    );

    try {
      // Add metadata to secret
      const secretWithMetadata = {
        ...value,
        _metadata: {
          tenantId: metadata.tenantId,
          sensitivityLevel: metadata.sensitivityLevel,
          createdAt: metadata.createdAt,
          version: metadata.version,
          rotationPolicy: metadata.rotationPolicy,
          tags: metadata.tags,
        },
      };

      const command = new PutSecretValueCommand({
        SecretId: secretPath,
        SecretString: JSON.stringify(secretWithMetadata),
      });

      await this.circuitBreaker.execute(() =>
        this.retryWithBackoff(
          () => this.client.send(command),
          "PutSecretValue",
          tenantId,
          secretKey
        )
      );

      // Invalidate both Redis and memory cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      await this.invalidateRedisCache(cacheKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, "WRITE", "SUCCESS", userId);

      logger.info("Secret set successfully in AWS", {
        tenantId,
        secretKey,
        sensitivityLevel: metadata.sensitivityLevel,
      });

      return true;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "WRITE",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error(
        "Failed to set secret in AWS",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretPath,
        }
      );

      throw error;
    }
  }

  async rotateSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    try {
      const command = new RotateSecretCommand({
        SecretId: secretPath,
      });

      await this.circuitBreaker.execute(() => this.client.send(command));

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, "ROTATE", "SUCCESS", userId);

      logger.info("Secret rotation initiated in AWS", {
        tenantId,
        secretKey,
      });

      return true;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "ROTATE",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error(
        "Failed to rotate secret in AWS",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretPath,
        }
      );

      throw error;
    }
  }

  async deleteSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    try {
      const command = new DeleteSecretCommand({
        SecretId: secretPath,
        ForceDeleteWithoutRecovery: false, // Allow recovery window
        RecoveryWindowInDays: 30,
      });

      await this.circuitBreaker.execute(() =>
        this.retryWithBackoff(
          () => this.client.send(command),
          "DeleteSecret",
          tenantId,
          secretKey
        )
      );

      // Invalidate both Redis and memory cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      await this.invalidateRedisCache(cacheKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, "DELETE", "SUCCESS", userId);

      logger.info("Secret deleted from AWS", {
        tenantId,
        secretKey,
        recoveryWindowDays: 30,
      });

      return true;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "DELETE",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error(
        "Failed to delete secret from AWS",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretPath,
        }
      );

      throw error;
    }
  }

  async listSecrets(tenantId: string, userId?: string): Promise<string[]> {
    const prefix = `valuecanvas/${this.environment}/tenants/${tenantId}/`;

    try {
      const command = new ListSecretsCommand({
        Filters: [
          {
            Key: "name",
            Values: [prefix],
          },
        ],
      });

      const response = await this.circuitBreaker.execute(() =>
        this.retryWithBackoff(
          () => this.client.send(command),
          "ListSecrets",
          tenantId
        )
      ) as { SecretList?: Array<{ Name?: string }> };
      const secrets = response.SecretList || [];

      // Extract secret keys from full paths
      const secretKeys = secrets
        .map((s) => s.Name?.replace(prefix, "") || "")
        .filter(Boolean);

      await this.auditAccess(
        tenantId,
        "ALL",
        "LIST",
        "SUCCESS",
        userId,
        undefined,
        {
          count: secretKeys.length,
        }
      );

      return secretKeys;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        "ALL",
        "LIST",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error(
        "Failed to list secrets from AWS",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
        }
      );

      throw error;
    }
  }

  async getSecretMetadata(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<SecretMetadata | null> {
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    try {
      const command = new DescribeSecretCommand({
        SecretId: secretPath,
      });

      const response = await this.retryWithBackoff(
        () => this.client.send(command),
        "DescribeSecret",
        tenantId,
        secretKey
      );

      if (!response.Name) {
        return null;
      }

      // Extract metadata from AWS response
      const metadata: SecretMetadata = {
        tenantId,
        secretPath: response.Name,
        version: response.VersionIdsToStages
          ? Object.keys(response.VersionIdsToStages)[0]
          : "latest",
        createdAt:
          response.CreatedDate?.toISOString() || new Date().toISOString(),
        lastAccessed:
          response.LastAccessedDate?.toISOString() || new Date().toISOString(),
        sensitivityLevel: "high", // Default, should be in tags
        tags: response.Tags?.reduce(
          (acc, tag) => {
            if (tag.Key && tag.Value) {
              acc[tag.Key] = tag.Value;
            }
            return acc;
          },
          {} as Record<string, string>
        ),
      };

      return metadata;
    } catch (error) {
      logger.error(
        "Failed to get secret metadata from AWS",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretPath,
        }
      );

      return null;
    }
  }

  async secretExists(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    try {
      const metadata = await this.getSecretMetadata(
        tenantId,
        secretKey,
        userId
      );
      return metadata !== null;
    } catch (error) {
      return false;
    }
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
    const event: SecretAuditEvent = {
      tenantId,
      userId,
      secretKey,
      action,
      result,
      error,
      metadata,
    };

    if (result === "SUCCESS") {
      if (action === "ROTATE") {
        await this.auditLogger.logRotation(event);
      } else {
        await this.auditLogger.logAccess(event);
      }
    } else {
      await this.auditLogger.logDenied({
        ...event,
        reason: error || "Unknown error",
      });
    }
  }

  private maskSecretKey(key: string): string {
    if (key === "ALL" || key.length <= 8) {
      return key;
    }
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  getProviderName(): string {
    return "aws";
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple check - list secrets with limit 1
      const command = new ListSecretsCommand({ MaxResults: 1 });
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error(
        "AWS provider health check failed",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Clear cache for testing/maintenance
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      // Clear cache for specific tenant
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(`${tenantId}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}
