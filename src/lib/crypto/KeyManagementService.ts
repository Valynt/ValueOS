/**
 * Key Management Service (KMS) Integration
 *
 * Provides secure key management, rotation, and lifecycle management
 * with support for multiple KMS providers (AWS, Azure, GCP, Local)
 */

import { logger } from "../logger";
import { Ed25519KeyPair, KeyPair, KeyRotationPolicy } from "./CryptoUtils";

// ============================================================================
// Types
// ============================================================================

export type KMSProvider = "aws" | "azure" | "gcp" | "local" | "hashicorp-vault";

export interface KMSConfig {
  provider: KMSProvider;
  region?: string;
  keyId?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

export interface ManagedKey {
  keyId: string;
  provider: KMSProvider;
  algorithm: "ed25519" | "x25519" | "aes-256-gcm";
  createdAt: Date;
  expiresAt?: Date;
  lastRotated?: Date;
  rotationPolicy?: KeyRotationPolicy;
  metadata?: Record<string, any>;
}

export interface KeyMetadata {
  keyId: string;
  version: number;
  status: "active" | "deprecated" | "revoked" | "expired";
  usageCount: number;
  lastUsed?: Date;
}

// ============================================================================
// Abstract KMS Provider Interface
// ============================================================================

export abstract class KMSProviderBase {
  protected config: KMSConfig;

  constructor(config: KMSConfig) {
    this.config = config;
  }

  /**
   * Generate a new key pair
   */
  abstract generateKeyPair(
    algorithm: "ed25519" | "x25519"
  ): Promise<ManagedKey>;

  /**
   * Sign data with a private key
   */
  abstract sign(keyId: string, data: Buffer): Promise<Buffer>;

  /**
   * Verify signature with a public key
   */
  abstract verify(
    keyId: string,
    data: Buffer,
    signature: Buffer
  ): Promise<boolean>;

  /**
   * Encrypt data
   */
  abstract encrypt(
    keyId: string,
    plaintext: Buffer
  ): Promise<{
    ciphertext: Buffer;
    iv: Buffer;
    tag?: Buffer;
  }>;

  /**
   * Decrypt data
   */
  abstract decrypt(
    keyId: string,
    ciphertext: Buffer,
    iv: Buffer,
    tag?: Buffer
  ): Promise<Buffer>;

  /**
   * Get key metadata
   */
  abstract getMetadata(keyId: string): Promise<KeyMetadata>;

  /**
   * Rotate key
   */
  abstract rotateKey(keyId: string): Promise<ManagedKey>;

  /**
   * Revoke key
   */
  abstract revokeKey(keyId: string): Promise<void>;

  /**
   * List keys
   */
  abstract listKeys(filter?: {
    status?: string;
    algorithm?: string;
  }): Promise<ManagedKey[]>;
}

// ============================================================================
// AWS KMS Provider
// ============================================================================

export class AWSKMSProvider extends KMSProviderBase {
  private kms: any; // AWS.KMS client

  constructor(config: KMSConfig) {
    super(config);
    // Initialize AWS KMS client
    // this.kms = new AWS.KMS({ region: config.region, ...config.credentials });
  }

  async generateKeyPair(algorithm: "ed25519" | "x25519"): Promise<ManagedKey> {
    try {
      const keySpec =
        algorithm === "ed25519" ? "ECC_NIST_P256" : "ECC_NIST_P256";

      const response = await this.kms.createKey({
        KeyUsage: "SIGN_VERIFY",
        KeySpec: keySpec,
        Description: `ValueOS ${algorithm} key pair`,
        Tags: [
          { TagKey: "Purpose", TagValue: "ValueOS-Agent-Communication" },
          { TagKey: "Algorithm", TagValue: algorithm },
          {
            TagKey: "Environment",
            TagValue: process.env.NODE_ENV || "development",
          },
        ],
      });

      const keyId = response.KeyMetadata.KeyId;

      return {
        keyId,
        provider: "aws",
        algorithm,
        createdAt: new Date(response.KeyMetadata.CreationDate),
        metadata: {
          awsRegion: this.config.region,
          keySpec,
          arn: response.KeyMetadata.Arn,
        },
      };
    } catch (error) {
      logger.error(
        "Failed to generate AWS KMS key pair",
        error instanceof Error ? error : undefined
      );
      throw new Error(
        `AWS KMS key generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async sign(keyId: string, data: Buffer): Promise<Buffer> {
    try {
      const response = await this.kms.sign({
        KeyId: keyId,
        Message: data,
        MessageType: "RAW",
        SigningAlgorithm: "ECDSA_SHA_256",
      });

      return Buffer.from(response.Signature, "base64");
    } catch (error) {
      logger.error(
        "AWS KMS sign failed",
        error instanceof Error ? error : undefined,
        { keyId }
      );
      throw new Error(
        `AWS KMS signing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async verify(
    keyId: string,
    data: Buffer,
    signature: Buffer
  ): Promise<boolean> {
    try {
      const response = await this.kms.verify({
        KeyId: keyId,
        Message: data,
        MessageType: "RAW",
        Signature: signature,
        SigningAlgorithm: "ECDSA_SHA_256",
      });

      return response.SignatureValid;
    } catch (error) {
      logger.error(
        "AWS KMS verify failed",
        error instanceof Error ? error : undefined,
        { keyId }
      );
      return false;
    }
  }

  async encrypt(
    keyId: string,
    plaintext: Buffer
  ): Promise<{
    ciphertext: Buffer;
    iv: Buffer;
    tag?: Buffer;
  }> {
    try {
      const response = await this.kms.encrypt({
        KeyId: keyId,
        Plaintext: plaintext,
        EncryptionAlgorithm: "AES_256_GCM",
      });

      return {
        ciphertext: Buffer.from(response.CiphertextBase64, "base64"),
        iv: Buffer.alloc(16), // AWS manages IV internally
        tag: undefined, // AWS manages tag internally
      };
    } catch (error) {
      logger.error(
        "AWS KMS encrypt failed",
        error instanceof Error ? error : undefined,
        { keyId }
      );
      throw new Error(
        `AWS KMS encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async decrypt(
    keyId: string,
    ciphertext: Buffer,
    iv: Buffer,
    tag?: Buffer
  ): Promise<Buffer> {
    try {
      const response = await this.kms.decrypt({
        Ciphertext: ciphertext,
        KeyId: keyId,
      });

      return Buffer.from(response.Plaintext);
    } catch (error) {
      logger.error(
        "AWS KMS decrypt failed",
        error instanceof Error ? error : undefined,
        { keyId }
      );
      throw new Error(
        `AWS KMS decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async getMetadata(keyId: string): Promise<KeyMetadata> {
    try {
      const response = await this.kms.describeKey({ KeyId: keyId });

      return {
        keyId,
        version: 1, // AWS manages versions internally
        status: this.mapAWSState(response.KeyMetadata.State),
        usageCount: 0, // AWS doesn't track usage by default
        lastUsed: response.KeyMetadata.LastUsedDate
          ? new Date(response.KeyMetadata.LastUsedDate)
          : undefined,
      };
    } catch (error) {
      logger.error(
        "AWS KMS getMetadata failed",
        error instanceof Error ? error : undefined,
        { keyId }
      );
      throw new Error(
        `AWS KMS metadata retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async rotateKey(keyId: string): Promise<ManagedKey> {
    try {
      await this.kms.enableKeyRotation({ KeyId: keyId });

      // Get updated metadata
      const metadata = await this.getMetadata(keyId);

      return {
        keyId,
        provider: "aws",
        algorithm: "ed25519", // Default assumption
        createdAt: new Date(),
        lastRotated: new Date(),
        metadata: {
          rotated: true,
        },
      };
    } catch (error) {
      logger.error(
        "AWS KMS rotateKey failed",
        error instanceof Error ? error : undefined,
        { keyId }
      );
      throw new Error(
        `AWS KMS key rotation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async revokeKey(keyId: string): Promise<void> {
    try {
      await this.kms.disableKey({ KeyId: keyId });
      await this.kms.scheduleKeyDeletion({
        KeyId: keyId,
        PendingWindowInDays: 7,
      });
    } catch (error) {
      logger.error(
        "AWS KMS revokeKey failed",
        error instanceof Error ? error : undefined,
        { keyId }
      );
      throw new Error(
        `AWS KMS key revocation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async listKeys(filter?: {
    status?: string;
    algorithm?: string;
  }): Promise<ManagedKey[]> {
    try {
      const response = await this.kms.listKeys({});

      const keys: ManagedKey[] = [];

      for (const key of response.Keys) {
        const metadata = await this.getMetadata(key.KeyId);

        if (
          filter &&
          ((filter.status && metadata.status !== filter.status) ||
            (filter.algorithm && !key.KeyId.includes(filter.algorithm)))
        ) {
          continue;
        }

        keys.push({
          keyId: key.KeyId,
          provider: "aws",
          algorithm: "ed25519", // Default assumption
          createdAt: new Date(),
          metadata,
        });
      }

      return keys;
    } catch (error) {
      logger.error(
        "AWS KMS listKeys failed",
        error instanceof Error ? error : undefined
      );
      throw new Error(
        `AWS KMS key listing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private mapAWSState(state: string): KeyMetadata["status"] {
    switch (state) {
      case "Enabled":
        return "active";
      case "Disabled":
        return "revoked";
      case "PendingDeletion":
        return "revoked";
      default:
        return "active";
    }
  }
}

// ============================================================================
// Local KMS Provider (Development/Testing)
// ============================================================================

export class LocalKMSProvider extends KMSProviderBase {
  private keys: Map<string, ManagedKey> = new Map();
  private privateKeys: Map<string, Buffer> = new Map();
  private publicKeys: Map<string, Buffer> = new Map();

  async generateKeyPair(algorithm: "ed25519" | "x25519"): Promise<ManagedKey> {
    const { generateEd25519KeyPair, generateX25519KeyPair } =
      await import("./CryptoUtils");

    const keyPair =
      algorithm === "ed25519"
        ? generateEd25519KeyPair()
        : generateX25519KeyPair();

    const managedKey: ManagedKey = {
      keyId: keyPair.keyId,
      provider: "local",
      algorithm,
      createdAt: keyPair.createdAt,
      metadata: {
        local: true,
        environment: process.env.NODE_ENV || "development",
      },
    };

    this.keys.set(keyPair.keyId, managedKey);
    this.privateKeys.set(
      keyPair.keyId,
      Buffer.from(keyPair.privateKey, "base64")
    );
    this.publicKeys.set(
      keyPair.keyId,
      Buffer.from(keyPair.publicKey, "base64")
    );

    logger.info("Generated local key pair", {
      keyId: keyPair.keyId,
      algorithm,
    });

    return managedKey;
  }

  async sign(keyId: string, data: Buffer): Promise<Buffer> {
    const privateKey = this.privateKeys.get(keyId);
    if (!privateKey) {
      throw new Error(`Private key not found for keyId: ${keyId}`);
    }

    const ed25519 = await import("@noble/ed25519");
    return Buffer.from(ed25519.sign(data, privateKey));
  }

  async verify(
    keyId: string,
    data: Buffer,
    signature: Buffer
  ): Promise<boolean> {
    const publicKey = this.publicKeys.get(keyId);
    if (!publicKey) {
      throw new Error(`Public key not found for keyId: ${keyId}`);
    }

    const ed25519 = await import("@noble/ed25519");
    return ed25519.verify(signature, data, publicKey);
  }

  async encrypt(
    keyId: string,
    plaintext: Buffer
  ): Promise<{
    ciphertext: Buffer;
    iv: Buffer;
    tag?: Buffer;
  }> {
    const { encrypt, generateEncryptionKey } = await import("./CryptoUtils");

    // For local provider, we'll use symmetric encryption
    const key = generateEncryptionKey();
    const encrypted = encrypt(plaintext.toString(), key);

    return {
      ciphertext: Buffer.from(encrypted.data, "base64"),
      iv: Buffer.from(encrypted.iv, "base64"),
      tag: Buffer.from(encrypted.tag || "", "base64"),
    };
  }

  async decrypt(
    keyId: string,
    ciphertext: Buffer,
    iv: Buffer,
    tag?: Buffer
  ): Promise<Buffer> {
    const { decrypt, generateEncryptionKey } = await import("./CryptoUtils");

    // For local provider, we'll use symmetric encryption
    const key = generateEncryptionKey();
    const encryptedData = {
      data: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag?.toString("base64") || "",
      algorithm: "aes-256-gcm",
    };

    const decrypted = decrypt(encryptedData, key);
    return Buffer.from(
      typeof decrypted === "string" ? decrypted : JSON.stringify(decrypted)
    );
  }

  async getMetadata(keyId: string): Promise<KeyMetadata> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    return {
      keyId,
      version: 1,
      status: "active",
      usageCount: 0,
      lastUsed: new Date(),
    };
  }

  async rotateKey(keyId: string): Promise<ManagedKey> {
    const existingKey = this.keys.get(keyId);
    if (!existingKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Generate new key
    const newKey = await this.generateKeyPair(existingKey.algorithm);

    // Mark old key as deprecated
    this.keys.set(keyId, {
      ...existingKey,
      metadata: { ...existingKey.metadata, deprecated: true },
    });

    logger.info("Rotated local key", {
      oldKeyId: keyId,
      newKeyId: newKey.keyId,
    });

    return newKey;
  }

  async revokeKey(keyId: string): Promise<void> {
    this.keys.delete(keyId);
    this.privateKeys.delete(keyId);
    this.publicKeys.delete(keyId);

    logger.info("Revoked local key", { keyId });
  }

  async listKeys(filter?: {
    status?: string;
    algorithm?: string;
  }): Promise<ManagedKey[]> {
    let keys = Array.from(this.keys.values());

    if (filter) {
      keys = keys.filter((key) => {
        if (filter.status && !key.metadata?.deprecated) return false;
        if (filter.algorithm && key.algorithm !== filter.algorithm)
          return false;
        return true;
      });
    }

    return keys;
  }
}

// ============================================================================
// Key Management Service
// ============================================================================

export class KeyManagementService {
  private static instance: KeyManagementService;
  private provider: KMSProviderBase;
  private rotationInterval: NodeJS.Timeout | null = null;

  private constructor(config: KMSConfig) {
    this.provider = this.createProvider(config);
    this.startRotationChecker();
  }

  static getInstance(config?: KMSConfig): KeyManagementService {
    if (!KeyManagementService.instance) {
      if (!config) {
        throw new Error("KMS config required for first initialization");
      }
      KeyManagementService.instance = new KeyManagementService(config);
    }
    return KeyManagementService.instance;
  }

  private createProvider(config: KMSConfig): KMSProviderBase {
    switch (config.provider) {
      case "aws":
        return new AWSKMSProvider(config);
      case "local":
        return new LocalKMSProvider(config);
      default:
        logger.warn(
          `KMS provider ${config.provider} not implemented, falling back to local`
        );
        return new LocalKMSProvider({ ...config, provider: "local" });
    }
  }

  /**
   * Generate a new key pair
   */
  async generateKeyPair(algorithm: string = "ed25519"): Promise<ManagedKey> {
    if (!["ed25519", "x25519"].includes(algorithm)) {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    return this.provider.generateKeyPair(algorithm);
  }

  /**
   * Sign data with a managed key
   */
  async sign(keyId: string, data: string | Buffer): Promise<Buffer> {
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return this.provider.sign(keyId, dataBuffer);
  }

  /**
   * Verify signature with a managed key
   */
  async verify(
    keyId: string,
    data: string | Buffer,
    signature: Buffer
  ): Promise<boolean> {
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return this.provider.verify(keyId, dataBuffer, signature);
  }

  /**
   * Get key metadata
   */
  async getMetadata(keyId: string): Promise<KeyMetadata> {
    return this.provider.getMetadata(keyId);
  }

  /**
   * Rotate a key
   */
  async rotateKey(keyId: string): Promise<ManagedKey> {
    const newKey = await this.provider.rotateKey(keyId);
    logger.info("Key rotated successfully", { keyId, newKeyId: newKey.keyId });
    return newKey;
  }

  /**
   * Revoke a key
   */
  async revokeKey(keyId: string): Promise<void> {
    await this.provider.revokeKey(keyId);
    logger.info("Key revoked successfully", { keyId });
  }

  /**
   * List managed keys
   */
  async listKeys(filter?: {
    status?: string;
    algorithm?: string;
  }): Promise<ManagedKey[]> {
    return this.provider.listKeys(filter);
  }

  /**
   * Start automatic key rotation checker
   */
  private startRotationChecker(): void {
    // Check for keys that need rotation every hour
    this.rotationInterval = setInterval(async () => {
      try {
        const keys = await this.listKeys();
        const now = new Date();

        for (const key of keys) {
          if (key.rotationPolicy && key.lastRotated) {
            const timeSinceRotation = now.getTime() - key.lastRotated.getTime();
            if (timeSinceRotation > key.rotationPolicy.rotationIntervalMs) {
              await this.rotateKey(key.keyId);
            }
          }
        }
      } catch (error) {
        logger.error(
          "Key rotation check failed",
          error instanceof Error ? error : undefined
        );
      }
    }, 3600000); // 1 hour
  }

  /**
   * Stop the key management service
   */
  stop(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getKMS(config: KMSConfig): KeyManagementService {
  return KeyManagementService.getInstance(config);
}

export default {
  KeyManagementService,
  AWSKMSProvider,
  LocalKMSProvider,
  getKMS,
};
