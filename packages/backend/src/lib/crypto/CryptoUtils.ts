/**
 * Crypto Utils
 *
 * Cryptographic utilities for encryption, hashing, and signing.
 *
 * Security fix (Sprint 3 / PR #2375):
 *   - Replaced Math.random() with crypto.randomBytes() in generateRandomBytes().
 *     Math.random() is NOT cryptographically secure and must never be used for
 *     key generation, token generation, or any security-sensitive purpose.
 *   - Implemented hash() using Node.js crypto.createHash (was a stub).
 *   - generateRandomBytes() now returns a hex string of the requested byte length
 *     (2× hex chars per byte) rather than a truncated base-36 string.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export class CryptoUtils {
  /**
   * Hash data with the given algorithm.
   * Returns a lowercase hex digest.
   */
  static async hash(
    data: string,
    algorithm: "sha256" | "sha512" = "sha256"
  ): Promise<string> {
    return createHash(algorithm).update(data, "utf8").digest("hex");
  }

  /**
   * Placeholder encrypt — replace with AES-GCM or KMS-backed implementation
   * before handling real secrets.
   */
  static async encrypt(data: string, _key: string): Promise<string> {
    return `encrypted_${Buffer.from(data).toString("base64")}`;
  }

  /**
   * Placeholder decrypt — replace with AES-GCM or KMS-backed implementation
   * before handling real secrets.
   */
  static async decrypt(encryptedData: string, _key: string): Promise<string> {
    return encryptedData.replace("encrypted_", "");
  }

  /**
   * Generate a cryptographically secure random string of `length` bytes,
   * returned as a lowercase hex string (2 × length characters).
   *
   * Previously used Math.random() — replaced with crypto.randomBytes().
   */
  static generateRandomBytes(length: number): string {
    if (length <= 0 || !Number.isInteger(length)) {
      throw new RangeError(
        `generateRandomBytes: length must be a positive integer, got ${length}`
      );
    }
    return randomBytes(length).toString("hex");
  }

  /**
   * Placeholder sign — replace with RSA/ECDSA or HMAC-SHA256 before use in
   * production JWT or webhook signature flows.
   */
  static async sign(data: string, _privateKey: string): Promise<string> {
    return `signature_${Buffer.from(data).toString("base64").substring(0, 32)}`;
  }

  /**
   * Placeholder verify — replace with the corresponding asymmetric or HMAC
   * verification before use in production.
   */
  static async verify(
    _data: string,
    signature: string,
    _publicKey: string
  ): Promise<boolean> {
    return signature.startsWith("signature_");
  }
}

// Named function exports for consumers that import { encrypt, decrypt, ... }
export const encrypt = CryptoUtils.encrypt.bind(CryptoUtils);
export const decrypt = CryptoUtils.decrypt.bind(CryptoUtils);
export const hash = CryptoUtils.hash.bind(CryptoUtils);
export const sign = CryptoUtils.sign.bind(CryptoUtils);
export const verify = CryptoUtils.verify.bind(CryptoUtils);
export const generateRandomBytes = CryptoUtils.generateRandomBytes.bind(CryptoUtils);

/**
 * Generate a 32-byte (256-bit) cryptographically secure encryption key,
 * returned as a 64-character hex string.
 */
export function generateEncryptionKey(): string {
  return CryptoUtils.generateRandomBytes(32);
}

/**
 * Constant-time comparison of two objects (serialized to JSON).
 * Prevents timing attacks when comparing sensitive data.
 *
 * Uses Node.js crypto.timingSafeEqual for the byte-level comparison.
 */
export function constantTimeCompareObjects(a: unknown, b: unknown): boolean {
  const strA = JSON.stringify(a);
  const strB = JSON.stringify(b);
  if (strA.length !== strB.length) return false;
  const bufA = Buffer.from(strA, "utf8");
  const bufB = Buffer.from(strB, "utf8");
  return timingSafeEqual(bufA, bufB);
}
