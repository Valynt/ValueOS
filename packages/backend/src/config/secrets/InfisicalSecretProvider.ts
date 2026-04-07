/**
 * Infisical Secret Provider
 *
 * Implementation of ISecretProvider using the official @infisical/sdk.
 * Replaces the previous hand-rolled fetch-based HTTP client with the SDK,
 * which handles token renewal, retries, and API versioning automatically.
 *
 * Infisical organises secrets as:
 *   project → environment → folder path → secret name
 *
 * Tenant isolation uses folder paths: /tenants/{tenantId}/{secretKey}
 * Shared secrets live at: /shared/{secretKey}
 */

import { InfisicalSDK } from "@infisical/sdk";
import { logger } from "../../lib/logger.js";
import { CircuitBreaker } from "../../lib/resilience/CircuitBreaker.js";
import { InputValidator } from "./InputValidator.js";
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
import {
  SecretCacheCrypto,
  type SerializedEncryptedCacheValue,
} from "./SecretCacheCrypto.js";

/**
 * Configuration for InfisicalSecretProvider.
 * Identical to the previous shape so ProviderFactory requires no changes.
 */
export interface InfisicalProviderConfig {
  siteUrl: string;
  clientId: string;
  clientSecret: string;
  projectId: string;
  environment: string;
  cacheTTL?: number;
}

/**
 * Infisical secret provider — SDK-backed implementation.
 *
 * Key improvements over the previous fetch-based implementation:
 *  - Token renewal is handled automatically by the SDK (no manual expiry math).
 *  - Retry logic with exponential back-off is built into the SDK's Axios client.
 *  - API versioning is abstracted; upgrading the SDK picks up new endpoints.
 *  - All existing caching, circuit-breaking, and audit-logging behaviour is preserved.
 */
export class InfisicalSecretProvider implements ISecretProvider {
  private readonly client: InfisicalSDK;
  private readonly projectId: string;
  private readonly environmentSlug: string;
  private readonly cache: Map<string, { value: string; expiresAt: number }> =
    new Map();
  private readonly cacheTTL: number;
  private readonly auditLogger: StructuredSecretAuditLogger;
  private readonly cacheCrypto: SecretCacheCrypto;
  private readonly circuitBreaker: CircuitBreaker;

  /** Tracks whether universalAuth.login() has completed successfully. */
  private isAuthenticated = false;

  /** Stored so authenticate() can be re-called on healthCheck failures. */
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: InfisicalProviderConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.projectId = config.projectId;
    this.environmentSlug = config.environment || "prod";
    this.cacheTTL = config.cacheTTL ?? 300_000; // 5 minutes

    // Initialise the official SDK — token management is fully delegated to it.
    this.client = new InfisicalSDK({
      siteUrl: config.siteUrl.replace(/\/+$/, ""),
    });

    this.auditLogger = new StructuredSecretAuditLogger();
    this.cacheCrypto = new SecretCacheCrypto({
      cacheKey: process.env.CACHE_ENCRYPTION_KEY,
      cacheKeyVersion: process.env.CACHE_ENCRYPTION_KEY_VERSION,
      previousCacheKeys: process.env.CACHE_ENCRYPTION_PREVIOUS_KEYS,
      providerName: "infisical",
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30_000,
      monitoringPeriod: 60_000,
      successThreshold: 3,
    });

    // Kick off authentication in the background so the first real request
    // does not have to pay the round-trip cost.
    this.authenticate().catch((err) => {
      logger.error("Initial Infisical authentication failed", err);
    });

    logger.info("Infisical Secret Provider initialised via @infisical/sdk", {
      provider: "infisical",
      siteUrl: config.siteUrl,
      projectId: this.projectId,
      environment: this.environmentSlug,
      cacheEncryptionKeyVersion: this.cacheCrypto.getCurrentKeyVersion(),
    });
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  /**
   * Authenticate via Universal Auth (Machine Identity).
   * The SDK stores the access token internally and renews it automatically,
   * so this only needs to be called once (or on explicit re-auth).
   */
  private async authenticate(): Promise<void> {
    if (this.isAuthenticated) return;

    await this.client.auth().universalAuth.login({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });

    this.isAuthenticated = true;
    logger.info("Infisical authentication successful");
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }
  }

  // ---------------------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------------------

  private buildCacheAAD(cacheKey: string): string {
    return `infisical:${cacheKey}`;
  }

  private serializeCachedSecret(cacheKey: string, value: SecretValue): string {
    const serialized = JSON.stringify(value);
    if (!this.cacheCrypto.isEncryptionEnabled()) {
      return serialized;
    }
    return JSON.stringify(
      this.cacheCrypto.encrypt(serialized, this.buildCacheAAD(cacheKey))
    );
  }

  private deserializeCachedSecret(
    cacheKey: string,
    cachedValue: string
  ): SecretValue {
    if (!this.cacheCrypto.isEncryptionEnabled()) {
      return JSON.parse(cachedValue) as SecretValue;
    }
    const payload = JSON.parse(cachedValue) as SerializedEncryptedCacheValue;
    return JSON.parse(
      this.cacheCrypto.decrypt(payload, this.buildCacheAAD(cacheKey))
    ) as SecretValue;
  }

  // ---------------------------------------------------------------------------
  // Path helpers — tenant isolation via folders
  // ---------------------------------------------------------------------------

  /**
   * Tenant-isolated folder path inside the Infisical project.
   * Maps to `/tenants/{tenantId}` so RBAC can restrict access by path.
   */
  private getTenantSecretPath(tenantId: string): string {
    return `/tenants/${tenantId}`;
  }

  private getCacheKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  // ---------------------------------------------------------------------------
  // ISecretProvider implementation
  // ---------------------------------------------------------------------------

  async getSecret(
    tenantId: string,
    secretKey: string,
    version?: string,
    userId?: string
  ): Promise<SecretValue> {
    await this.ensureAuthenticated();

    const validatedTenantId = InputValidator.validateOrThrow<string>(
      tenantId,
      InputValidator.validateTenantId,
      "tenantId"
    );
    const validatedSecretKey = InputValidator.validateOrThrow<string>(
      secretKey,
      InputValidator.validateSecretKey,
      "secretKey"
    );

    const startTime = Date.now();
    const cacheKey = this.getCacheKey(validatedTenantId, validatedSecretKey);

    // Check in-memory cache first.
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const decrypted = this.deserializeCachedSecret(cacheKey, cached.value);
      await this.auditAccess(
        tenantId,
        secretKey,
        "READ",
        "SUCCESS",
        userId,
        undefined,
        { source: "cache", latency_ms: Date.now() - startTime }
      );
      return decrypted;
    }

    try {
      const secretPath = this.getTenantSecretPath(validatedTenantId);

      const secret = await this.circuitBreaker.execute(() =>
        this.client.secrets().getSecret({
          environment: this.environmentSlug,
          projectId: this.projectId,
          secretPath,
          secretName: validatedSecretKey,
          version: version ? parseInt(version, 10) : undefined,
        })
      );

      const secretValue: SecretValue = { value: secret.secretValue };

      this.cache.set(cacheKey, {
        value: this.serializeCachedSecret(cacheKey, secretValue),
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
          source: "infisical",
          latency_ms: Date.now() - startTime,
          version: secret.version,
        }
      );
      return secretValue;
    } catch (error: unknown) {
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
        "Failed to get secret from Infisical",
        error instanceof Error ? error : new Error(String(error)),
        { tenantId, secretKey }
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
    await this.ensureAuthenticated();

    const secretPath = this.getTenantSecretPath(tenantId);
    const stringValue = value.value ?? JSON.stringify(value);

    try {
      const exists = await this.secretExists(tenantId, secretKey, userId);

      if (exists) {
        await this.circuitBreaker.execute(() =>
          this.client.secrets().updateSecret(secretKey, {
            environment: this.environmentSlug,
            projectId: this.projectId,
            secretPath,
            secretValue: stringValue,
          })
        );
      } else {
        await this.circuitBreaker.execute(() =>
          this.client.secrets().createSecret(secretKey, {
            environment: this.environmentSlug,
            projectId: this.projectId,
            secretPath,
            secretValue: stringValue,
            type: "shared" as unknown as undefined,
          })
        );
      }

      this.cache.delete(this.getCacheKey(tenantId, secretKey));
      await this.auditAccess(tenantId, secretKey, "WRITE", "SUCCESS", userId);

      logger.info("Secret written to Infisical", {
        tenantId,
        secretKey,
        operation: exists ? "update" : "create",
      });
      return true;
    } catch (error: unknown) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "WRITE",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );
      logger.error(
        "Failed to write secret to Infisical",
        error instanceof Error ? error : new Error(String(error)),
        { tenantId, secretKey }
      );
      throw error;
    }
  }

  async rotateSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    try {
      const crypto = await import("crypto");
      const newValue: SecretValue = {
        value: crypto.randomBytes(32).toString("hex"),
        rotated_at: new Date().toISOString(),
        previous_version: "rotated",
      };

      const currentMetadata = await this.getSecretMetadata(
        tenantId,
        secretKey,
        userId
      );

      await this.setSecret(
        tenantId,
        secretKey,
        newValue,
        {
          ...currentMetadata!,
          version: "auto",
          lastAccessed: new Date().toISOString(),
        },
        userId
      );

      this.cache.delete(this.getCacheKey(tenantId, secretKey));

      await this.auditAccess(tenantId, secretKey, "ROTATE", "SUCCESS", userId);
      logger.info("Secret rotation completed in Infisical", {
        tenantId,
        secretKey,
      });

      return true;
    } catch (error: unknown) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "ROTATE",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );
      logger.error(
        "Failed to rotate secret in Infisical",
        error instanceof Error ? error : new Error(String(error)),
        { tenantId, secretKey }
      );
      throw error;
    }
  }

  async deleteSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    await this.ensureAuthenticated();

    const secretPath = this.getTenantSecretPath(tenantId);

    try {
      await this.circuitBreaker.execute(() =>
        this.client.secrets().deleteSecret(secretKey, {
          environment: this.environmentSlug,
          projectId: this.projectId,
          secretPath,
        })
      );

      this.cache.delete(this.getCacheKey(tenantId, secretKey));
      await this.auditAccess(tenantId, secretKey, "DELETE", "SUCCESS", userId);

      logger.info("Secret deleted from Infisical", { tenantId, secretKey });
      return true;
    } catch (error: unknown) {
      await this.auditAccess(
        tenantId,
        secretKey,
        "DELETE",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );
      logger.error(
        "Failed to delete secret from Infisical",
        error instanceof Error ? error : new Error(String(error)),
        { tenantId, secretKey }
      );
      throw error;
    }
  }

  async listSecrets(tenantId: string, userId?: string): Promise<string[]> {
    await this.ensureAuthenticated();

    const secretPath = this.getTenantSecretPath(tenantId);

    try {
      const response = await this.circuitBreaker.execute(() =>
        this.client.secrets().listSecrets({
          environment: this.environmentSlug,
          projectId: this.projectId,
          secretPath,
        })
      );

      const secretKeys = response.secrets.map((s) => s.secretKey);

      await this.auditAccess(
        tenantId,
        "ALL",
        "LIST",
        "SUCCESS",
        userId,
        undefined,
        { count: secretKeys.length }
      );

      return secretKeys;
    } catch (error: unknown) {
      await this.auditAccess(
        tenantId,
        "ALL",
        "LIST",
        "FAILURE",
        userId,
        error instanceof Error ? error.message : String(error)
      );
      logger.error(
        "Failed to list secrets from Infisical",
        error instanceof Error ? error : new Error(String(error)),
        { tenantId }
      );
      throw error;
    }
  }

  async getSecretMetadata(
    tenantId: string,
    secretKey: string,
    _userId?: string
  ): Promise<SecretMetadata | null> {
    try {
      await this.ensureAuthenticated();

      const secretPath = this.getTenantSecretPath(tenantId);

      const secret = await this.client.secrets().getSecret({
        environment: this.environmentSlug,
        projectId: this.projectId,
        secretPath,
        secretName: secretKey,
      });

      return {
        tenantId,
        secretPath: `${secret.secretPath ?? secretPath}/${secret.secretKey}`,
        version: String(secret.version),
        createdAt: secret.createdAt ?? new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        sensitivityLevel: "high",
      };
    } catch (error: unknown) {
      logger.error(
        "Failed to get secret metadata from Infisical",
        error instanceof Error ? error : new Error(String(error)),
        { tenantId, secretKey }
      );
      return null;
    }
  }

  async secretExists(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    const metadata = await this.getSecretMetadata(tenantId, secretKey, userId);
    return metadata !== null;
  }

  async auditAccess(
    tenantId: string,
    secretKey: string,
    action: AuditAction,
    result: AuditResult,
    userId?: string,
    error?: string,
    metadata?: Record<string, unknown>
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

  getProviderName(): string {
    return "infisical";
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Re-authenticate if needed; the SDK will renew the token automatically
      // on subsequent calls, but we explicitly verify connectivity here.
      this.isAuthenticated = false;
      await this.authenticate();
      return true;
    } catch (error: unknown) {
      logger.error(
        "Infisical provider health check failed",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  private typedEntries<K, V>(map: Map<K, V>): Array<[K, V]> {
    return Array.from(map.entries());
  }

  /**
   * Clear the in-memory secret cache.
   * Pass a tenantId to evict only that tenant's entries.
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      for (const [key] of this.typedEntries(this.cache)) {
        if (key.startsWith(`${tenantId}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}
