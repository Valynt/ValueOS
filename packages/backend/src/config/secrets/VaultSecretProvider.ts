/**
 * HashiCorp Vault Provider
 *
 * Implementation of ISecretProvider for HashiCorp Vault
 * Supports Kubernetes authentication and KV v2 secrets engine
 *
 * Sprint 2: Provider Abstraction
 * Created: 2024-11-29
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import * as fs from "fs";

import { logger } from "../../lib/logger.js"

import {
  CircuitBreaker,
  type CircuitBreakerConfig,
} from "../../lib/resilience/CircuitBreaker.js";

function createConfigurableCircuitBreaker(config: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}
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



// Type definitions for node-vault (simplified)
interface VaultClient {
  kubernetesLogin(options: {
    role: string;
    jwt: string;
  }): Promise<{ auth: { client_token: string } }>;
  read(path: string): Promise<{ data: { data: Record<string, unknown>; metadata: Record<string, unknown> | undefined } }>;
  write(path: string, data: Record<string, unknown>): Promise<unknown>;
  delete(path: string): Promise<unknown>;
  list(path: string): Promise<{ data: { keys: string[] } }>;
  health(): Promise<unknown>;
}

/**
 * HashiCorp Vault provider implementation
 */
export class VaultSecretProvider implements ISecretProvider {
  private client: VaultClient | null = null;
  private vaultAddress: string;
  private vaultNamespace: string;
  private environment: string;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTTL: number;
  private kubernetesRole?: string;
  private auditLogger: StructuredSecretAuditLogger;
  private encryptionKey: Buffer;
  private circuitBreaker: CircuitBreaker;

  constructor(
    vaultAddress: string,
    vaultNamespace: string = "valuecanvas",
    kubernetesRole?: string,
    cacheTTL: number = 300000 // 5 minutes
  ) {
    this.vaultAddress = vaultAddress;
    this.vaultNamespace = vaultNamespace;
    this.environment = process.env.NODE_ENV || "development";
    this.cacheTTL = cacheTTL;
    this.kubernetesRole = kubernetesRole;
    this.auditLogger = new StructuredSecretAuditLogger();
    // Generate a random encryption key for cache encryption
    this.encryptionKey = randomBytes(32);
    // Initialize circuit breaker for external API calls
    this.circuitBreaker = createConfigurableCircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30_000,
      monitoringPeriod: 60_000,
      successThreshold: 3,
    });

    logger.info("Vault Secret Provider initialized", {
      provider: "vault",
      address: vaultAddress,
      namespace: vaultNamespace,
      environment: this.environment,
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
   * Initialize Vault client with Kubernetes authentication
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic import of node-vault
      const vault = await import("node-vault");

      this.client = vault.default({
        apiVersion: "v1",
        endpoint: this.vaultAddress,
        namespace: this.vaultNamespace,
      }) as unknown as VaultClient;

      // Authenticate with Kubernetes if role provided
      if (this.kubernetesRole) {
        await this.authenticateKubernetes(this.kubernetesRole);
      }

      logger.info("Vault client initialized and authenticated");
    } catch (error: unknown) {
      logger.error(
        "Failed to initialize Vault client",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Authenticate using Kubernetes service account
   */
  private async authenticateKubernetes(role: string): Promise<void> {
    try {
      const jwtPath = "/var/run/secrets/kubernetes.io/serviceaccount/token";
      const jwt = await fs.promises.readFile(jwtPath, "utf8");

      if (!this.client) {
        throw new Error("Vault client not initialized");
      }

      const response = await this.client.kubernetesLogin({ role, jwt });

      // Store the client token for subsequent requests
      (this.client as Record<string, unknown>).token = response.auth.client_token;

      logger.info("Kubernetes authentication successful", { role });
    } catch (error: unknown) {
      logger.error(
        "Kubernetes authentication failed",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Generate tenant-isolated Vault secret path
   *
   * Format: secret/data/tenants/{tenantId}/{secretKey}
   * (KV v2 requires /data/ in path)
   */
  private getTenantSecretPath(tenantId: string, secretKey: string): string {
    if (!tenantId || !secretKey) {
      throw new Error("Tenant ID and secret key are required");
    }

    // Validate format
    if (!/^[a-zA-Z0-9-_]+$/.test(tenantId)) {
      throw new Error("Invalid tenant ID format");
    }

    return `secret/data/${this.environment}/tenants/${tenantId}/${secretKey}`;
  }

  /**
   * Get metadata path (for KV v2)
   */
  private getMetadataPath(tenantId: string, secretKey: string): string {
    return `secret/metadata/${this.environment}/tenants/${tenantId}/${secretKey}`;
  }

  /**
   * Get cache key
   */
  private getCacheKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  /**
   * Ensure client is initialized
   */
  private ensureClient(): VaultClient {
    if (!this.client) {
      throw new Error("Vault client not initialized. Call initialize() first.");
    }
    return this.client;
  }

  async getSecret(
    tenantId: string,
    secretKey: string,
    version?: string,
    userId?: string
  ): Promise<SecretValue> {
    const startTime = Date.now();
    const client = this.ensureClient();

    // Check cache
    const cacheKey = this.getCacheKey(tenantId, secretKey);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      const decryptedValue = JSON.parse(
        this.decrypt(cached.value)
      ) as SecretValue;
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
      return decryptedValue;
    }

    try {
      let path = this.getTenantSecretPath(tenantId, secretKey);

      // Add version if specified
      if (version) {
        path += `?version=${version}`;
      }

      const response = await this.circuitBreaker.execute(() =>
        client.read(path)
      );
      const secretValue = response.data.data as SecretValue;

      // Remove internal metadata if present
      const { _metadata, ...cleanValue } = secretValue as Record<string, unknown>;

      // Cache the secret
      this.cache.set(cacheKey, {
        value: this.encrypt(JSON.stringify(cleanValue)),
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
          source: "vault",
          latency_ms: Date.now() - startTime,
          version: response.data.metadata?.version,
        }
      );

      return cleanValue;
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
        "Failed to get secret from Vault",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretKey,
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
    const client = this.ensureClient();
    const path = this.getTenantSecretPath(tenantId, secretKey);

    try {
      // Add metadata to secret
      const secretWithMetadata: Record<string, unknown> = {
        data: {
          ...value,
          _metadata: {
            tenantId: metadata.tenantId,
            sensitivityLevel: metadata.sensitivityLevel,
            createdAt: metadata.createdAt,
            version: metadata.version,
            rotationPolicy: metadata.rotationPolicy,
            tags: metadata.tags,
          },
        },
        options: {
          cas: 0, // Check-And-Set version (0 = create only if doesn't exist)
        },
      };

      await this.circuitBreaker.execute(() =>
        client.write(path, secretWithMetadata)
      );

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, "WRITE", "SUCCESS", userId);

      logger.info("Secret set successfully in Vault", {
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
        "Failed to set secret in Vault",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretKey,
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
    const client = this.ensureClient();

    try {
      // Read current secret
      const currentSecret = await this.getSecret(
        tenantId,
        secretKey,
        undefined,
        userId
      );

      // Generate new value (implementation depends on secret type)
      const newValue = this.generateNewSecretValue(secretKey, currentSecret);

      // Get current metadata
      const currentMetadata = await this.getSecretMetadata(
        tenantId,
        secretKey,
        userId
      );

      // Write new version
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
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, "ROTATE", "SUCCESS", userId);

      logger.info("Secret rotation completed in Vault", {
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
        "Failed to rotate secret in Vault",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretKey,
        }
      );

      throw error;
    }
  }

  /**
   * Generate new secret value for rotation
   */
  private generateNewSecretValue(
    secretKey: string,
    currentValue: SecretValue
  ): SecretValue {
    // This is a simplified implementation
    // In production, this should generate appropriate values based on secret type
    const crypto = require("crypto");

    return {
      value: crypto.randomBytes(32).toString("hex"),
      rotated_at: new Date().toISOString(),
      previous_version: "rotated",
    };
  }

  async deleteSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    const client = this.ensureClient();
    const metadataPath = this.getMetadataPath(tenantId, secretKey);

    try {
      // Delete all versions and metadata
      await this.circuitBreaker.execute(() => client.delete(metadataPath));

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, "DELETE", "SUCCESS", userId);

      logger.info("Secret deleted from Vault", {
        tenantId,
        secretKey,
      });

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
        "Failed to delete secret from Vault",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretKey,
        }
      );

      throw error;
    }
  }

  async listSecrets(tenantId: string, userId?: string): Promise<string[]> {
    const client = this.ensureClient();
    const listPath = `secret/metadata/${this.environment}/tenants/${tenantId}`;

    try {
      const response = await this.circuitBreaker.execute(() =>
        client.list(listPath)
      );
      const secretKeys = response.data.keys || [];

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
        "Failed to list secrets from Vault",
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
    const client = this.ensureClient();
    const metadataPath = this.getMetadataPath(tenantId, secretKey);

    try {
      const response = await client.read(metadataPath);
      const vaultMetadata = response.data;

      const metadata: SecretMetadata = {
        tenantId,
        secretPath: metadataPath,
        version: String((vaultMetadata as Record<string, unknown>).current_version || "latest"),
        createdAt: (vaultMetadata as Record<string, unknown>).created_time as string || new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        sensitivityLevel: "high", // Default, should be in tags
        tags: (vaultMetadata as Record<string, unknown>).custom_metadata as Record<string, unknown> || {},
      };

      return metadata;
    } catch (error: unknown) {
      logger.error(
        "Failed to get secret metadata from Vault",
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          secretKey,
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

  private maskSecretKey(key: string): string {
    if (key === "ALL" || key.length <= 8) {
      return key;
    }
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  getProviderName(): string {
    return "vault";
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.ensureClient();
      await this.circuitBreaker.execute(() => client.health());
      return true;
    } catch (error: unknown) {
      logger.error(
        "Vault provider health check failed",
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