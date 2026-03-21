/**
 * Infisical Secret Provider
 *
 * Implementation of ISecretProvider for Infisical secrets management platform.
 * Supports Universal Auth (Machine Identity) with tenant-isolated folder paths.
 *
 * Infisical organizes secrets as:
 *   project → environment → folder path → secret name
 *
 * Tenant isolation uses folder paths: /tenants/{tenantId}/{secretKey}
 * Shared secrets live at: /shared/{secretKey}
 */

import { logger } from "../../lib/logger.js";
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
} from "../../lib/resilience/CircuitBreaker.js";

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
 * Infisical API response types (subset used by provider)
 */
interface InfisicalSecret {
  id: string;
  secretKey: string;
  secretValue: string;
  version: number;
  type: string;
  environment: string;
  secretPath: string;
}

interface InfisicalListResponse {
  secrets: InfisicalSecret[];
}

interface InfisicalAuthResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Infisical configuration
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
 * Infisical secret provider implementation
 */
export class InfisicalSecretProvider implements ISecretProvider {
  private siteUrl: string;
  private clientId: string;
  private clientSecret: string;
  private projectId: string;
  private environmentSlug: string;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTTL: number;
  private auditLogger: StructuredSecretAuditLogger;
  private readonly cacheCrypto: SecretCacheCrypto;
  private circuitBreaker: CircuitBreaker;

  /** Current access token and its expiry timestamp */
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: InfisicalProviderConfig) {
    this.siteUrl = config.siteUrl.replace(/\/+$/, ""); // strip trailing slash
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.projectId = config.projectId;
    this.environmentSlug = config.environment || "prod";
    this.cacheTTL = config.cacheTTL ?? 300_000; // 5 minutes

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

    logger.info("Infisical Secret Provider initialized", {
      provider: "infisical",
      siteUrl: this.siteUrl,
      projectId: this.projectId,
      environment: this.environmentSlug,
      cacheEncryptionKeyVersion: this.cacheCrypto.getCurrentKeyVersion(),
    });
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  /**
   * Authenticate via Universal Auth (Machine Identity) and cache the token.
   */
  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const url = `${this.siteUrl}/api/v1/auth/universal-auth/login`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Infisical authentication failed (${res.status}): ${body}`
      );
    }

    const data = (await res.json()) as InfisicalAuthResponse;
    this.accessToken = data.accessToken;
    // Refresh 60 s before actual expiry
    this.tokenExpiresAt = Date.now() + (data.expiresIn - 60) * 1_000;

    logger.info("Infisical authentication successful");
    return this.accessToken;
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private async apiGet<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    const token = await this.authenticate();
    const url = new URL(`${this.siteUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Infisical API GET ${path} failed (${res.status}): ${body}`
      );
    }

    return (await res.json()) as T;
  }

  private async apiPost<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const token = await this.authenticate();
    const res = await fetch(`${this.siteUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Infisical API POST ${path} failed (${res.status}): ${text}`
      );
    }

    return (await res.json()) as T;
  }

  private async apiPatch<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const token = await this.authenticate();
    const res = await fetch(`${this.siteUrl}${path}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Infisical API PATCH ${path} failed (${res.status}): ${text}`
      );
    }

    return (await res.json()) as T;
  }

  private async apiDelete(
    path: string,
    body?: Record<string, unknown>
  ): Promise<void> {
    const token = await this.authenticate();
    const res = await fetch(`${this.siteUrl}${path}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Infisical API DELETE ${path} failed (${res.status}): ${text}`
      );
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
   * Maps to `/tenants/{tenantId}` so RBAC can restrict by path.
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

    // Check in-memory cache
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
        {
          source: "cache",
          latency_ms: Date.now() - startTime,
        }
      );
      return decrypted;
    }

    try {
      const secretPath = this.getTenantSecretPath(validatedTenantId);

      const data = await this.circuitBreaker.execute(() =>
        this.apiGet<{ secret: InfisicalSecret }>(
          "/api/v3/secrets/raw/" + encodeURIComponent(validatedSecretKey),
          {
            workspaceId: this.projectId,
            environment: this.environmentSlug,
            secretPath,
            ...(version ? { version } : {}),
          }
        )
      );

      const secretValue: SecretValue = { value: data.secret.secretValue };

      // Populate cache
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
          version: data.secret.version,
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
    const secretPath = this.getTenantSecretPath(tenantId);

    try {
      // Try to create; if it already exists, update instead
      const exists = await this.secretExists(tenantId, secretKey, userId);

      if (exists) {
        await this.circuitBreaker.execute(() =>
          this.apiPatch<unknown>(
            "/api/v3/secrets/raw/" + encodeURIComponent(secretKey),
            {
              workspaceId: this.projectId,
              environment: this.environmentSlug,
              secretPath,
              secretValue: value.value ?? JSON.stringify(value),
              tagIds: metadata.tags
                ? Object.entries(metadata.tags).map(([k, v]) => `${k}:${v}`)
                : [],
            }
          )
        );
      } else {
        await this.circuitBreaker.execute(() =>
          this.apiPost<unknown>(
            "/api/v3/secrets/raw/" + encodeURIComponent(secretKey),
            {
              workspaceId: this.projectId,
              environment: this.environmentSlug,
              secretPath,
              secretValue: value.value ?? JSON.stringify(value),
              type: "shared",
            }
          )
        );
      }

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, "WRITE", "SUCCESS", userId);

      logger.info("Secret set successfully in Infisical", {
        tenantId,
        secretKey,
        sensitivityLevel: metadata.sensitivityLevel,
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
        "Failed to set secret in Infisical",
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
      const currentSecret = await this.getSecret(
        tenantId,
        secretKey,
        undefined,
        userId
      );

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

      // Invalidate cache
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
    const secretPath = this.getTenantSecretPath(tenantId);

    try {
      await this.circuitBreaker.execute(() =>
        this.apiDelete("/api/v3/secrets/raw/" + encodeURIComponent(secretKey), {
          workspaceId: this.projectId,
          environment: this.environmentSlug,
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
    const secretPath = this.getTenantSecretPath(tenantId);

    try {
      const data = await this.circuitBreaker.execute(() =>
        this.apiGet<InfisicalListResponse>("/api/v3/secrets/raw", {
          workspaceId: this.projectId,
          environment: this.environmentSlug,
          secretPath,
        })
      );

      const secretKeys = data.secrets.map(s => s.secretKey);

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
    userId?: string
  ): Promise<SecretMetadata | null> {
    try {
      const secretPath = this.getTenantSecretPath(tenantId);

      const data = await this.apiGet<{ secret: InfisicalSecret }>(
        "/api/v3/secrets/raw/" + encodeURIComponent(secretKey),
        {
          workspaceId: this.projectId,
          environment: this.environmentSlug,
          secretPath,
        }
      );

      const s = data.secret;

      return {
        tenantId,
        secretPath: `${s.secretPath}/${s.secretKey}`,
        version: String(s.version),
        createdAt: new Date().toISOString(), // Infisical doesn't expose createdAt in GET
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
    try {
      const metadata = await this.getSecretMetadata(
        tenantId,
        secretKey,
        userId
      );
      return metadata !== null;
    } catch {
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

  /**
   * Clear cache for testing/maintenance
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
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
