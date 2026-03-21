import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { logger } from "../../lib/logger.js";

const AES_256_GCM = "aes-256-gcm";
const IV_BYTES = 12;

export interface SerializedEncryptedCacheValue {
  algorithm: typeof AES_256_GCM;
  keyVersion: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface CacheEncryptionKey {
  version: string;
  key: Buffer;
}

export interface SecretCacheCryptoOptions {
  cacheKey?: string;
  cacheKeyVersion?: string;
  previousCacheKeys?: string;
  providerName: "aws" | "vault" | "infisical";
}

export class SecretCacheCrypto {
  private readonly currentKey: CacheEncryptionKey | null;
  private readonly fallbackKeys: Map<string, Buffer>;

  constructor(options: SecretCacheCryptoOptions) {
    this.currentKey = SecretCacheCrypto.parseCurrentKey(
      options.cacheKey,
      options.cacheKeyVersion,
    );
    this.fallbackKeys = SecretCacheCrypto.parsePreviousKeys(options.previousCacheKeys);

    if (this.currentKey) {
      this.fallbackKeys.set(this.currentKey.version, this.currentKey.key);
      logger.info("Secret cache encryption configured", {
        provider: options.providerName,
        keyVersion: this.currentKey.version,
        fallbackKeyVersions: Array.from(this.fallbackKeys.keys()).filter(
          (version) => version !== this.currentKey?.version,
        ),
      });
      return;
    }

    logger.warn("Secret cache encryption key unavailable; encrypted cache disabled", {
      provider: options.providerName,
    });
  }

  isEncryptionEnabled(): boolean {
    return this.currentKey !== null;
  }

  getCurrentKeyVersion(): string | null {
    return this.currentKey?.version ?? null;
  }

  encrypt(plaintext: string, aad: string): SerializedEncryptedCacheValue {
    if (!this.currentKey) {
      throw new Error("Secret cache encryption is not configured");
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(AES_256_GCM, this.currentKey.key, iv);
    cipher.setAAD(Buffer.from(aad, "utf8"));

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    return {
      algorithm: AES_256_GCM,
      keyVersion: this.currentKey.version,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  decrypt(payload: SerializedEncryptedCacheValue, aad: string): string {
    if (payload.algorithm !== AES_256_GCM) {
      throw new Error(`Unsupported cache encryption algorithm: ${payload.algorithm}`);
    }

    const key = this.fallbackKeys.get(payload.keyVersion);
    if (!key) {
      throw new Error(`Unknown cache encryption key version: ${payload.keyVersion}`);
    }

    const decipher = createDecipheriv(
      AES_256_GCM,
      key,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  }

  private static parseCurrentKey(
    cacheKey?: string,
    cacheKeyVersion?: string,
  ): CacheEncryptionKey | null {
    const normalizedKey = cacheKey?.trim();
    if (!normalizedKey) {
      return null;
    }

    return {
      version: cacheKeyVersion?.trim() || "v1",
      key: SecretCacheCrypto.normalizeKeyMaterial(normalizedKey),
    };
  }

  private static parsePreviousKeys(previousCacheKeys?: string): Map<string, Buffer> {
    const keys = new Map<string, Buffer>();
    const serialized = previousCacheKeys?.trim();
    if (!serialized) {
      return keys;
    }

    const parsed = SecretCacheCrypto.tryParseJsonObject(serialized);
    if (parsed) {
      for (const [version, rawValue] of Object.entries(parsed)) {
        if (typeof rawValue === "string" && rawValue.trim()) {
          keys.set(version, SecretCacheCrypto.normalizeKeyMaterial(rawValue));
        }
      }
      return keys;
    }

    for (const pair of serialized.split(",").map((entry) => entry.trim()).filter(Boolean)) {
      const separatorIndex = pair.indexOf(":");
      if (separatorIndex === -1) {
        throw new Error(
          "CACHE_ENCRYPTION_PREVIOUS_KEYS must be JSON or comma-separated version:key pairs",
        );
      }

      const version = pair.slice(0, separatorIndex).trim();
      const rawValue = pair.slice(separatorIndex + 1).trim();
      if (!version || !rawValue) {
        throw new Error(
          "CACHE_ENCRYPTION_PREVIOUS_KEYS contains an invalid version:key pair",
        );
      }

      keys.set(version, SecretCacheCrypto.normalizeKeyMaterial(rawValue));
    }

    return keys;
  }

  private static tryParseJsonObject(value: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }

    return null;
  }

  private static normalizeKeyMaterial(value: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(value)) {
      return Buffer.from(value, "hex");
    }

    if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32) {
      return Buffer.from(value, "base64");
    }

    return createHash("sha256").update(value, "utf8").digest();
  }
}
