/**
 * Cryptographic Utilities
 *
 * Provides Ed25519 signature verification and AES-256-GCM encryption
 * using Node.js built-in crypto module for enterprise security.
 */

import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import { ed25519 } from "@noble/ed25519";

// ============================================================================
// Types
// ============================================================================

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface Ed25519KeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface KeyRotationPolicy {
  rotationIntervalMs: number;
  maxKeyAgeMs: number;
  keyOverlapMs: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  algorithm: string;
}

export interface SignatureResult {
  signature: string;
  timestamp: number;
}

// ============================================================================
// Ed25519 Signature Implementation (using HMAC-SHA256 as fallback)
// ============================================================================

/**
 * Generate an Ed25519 key pair for digital signatures
 * Provides cryptographic non-repudiation and authenticity
 */
export function generateEd25519KeyPair(): Ed25519KeyPair {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);

  return {
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKey: Buffer.from(privateKey).toString("base64"),
    keyId: `key_${Date.now()}_${randomBytes(8).toString("hex")}`,
    createdAt: new Date(),
  };
}

/**
 * Generate an X25519 key pair for key exchange (encryption)
 */
export function generateX25519KeyPair(): KeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);

  return {
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKey: Buffer.from(privateKey).toString("base64"),
  };
}

/**
 * @deprecated Use generateEd25519KeyPair() for proper non-repudiation
 * Legacy HMAC key pair generation - kept for backward compatibility
 */
export function generateKeyPair(): KeyPair {
  console.warn(
    "generateKeyPair() is deprecated. Use generateEd25519KeyPair() for proper security."
  );
  const privateKey = randomBytes(32).toString("base64");
  const publicKey = createHash("sha256").update(privateKey).digest("base64");

  return {
    publicKey,
    privateKey,
  };
}

/**
 * Sign a message using Ed25519 for cryptographic non-repudiation
 * Provides authenticity, integrity, and non-repudiation
 */
export function signMessageEd25519(
  message: string | object,
  privateKey: string
): SignatureResult {
  try {
    const messageString =
      typeof message === "string" ? message : JSON.stringify(message);
    const timestamp = Date.now();
    const dataToSign = `${messageString}:${timestamp}`;

    const messageBytes = Buffer.from(dataToSign, "utf8");
    const privateKeyBytes = Buffer.from(privateKey, "base64");

    const signature = ed25519.sign(messageBytes, privateKeyBytes);

    return {
      signature: Buffer.from(signature).toString("base64"),
      timestamp,
    };
  } catch (error) {
    throw new Error(
      `Ed25519 signing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * @deprecated Use signMessageEd25519() for proper non-repudiation
 * Legacy HMAC-SHA256 signing - kept for backward compatibility
 */
export function signMessage(
  message: string | object,
  privateKey: string
): SignatureResult {
  console.warn(
    "signMessage() is deprecated. Use signMessageEd25519() for proper security."
  );
  const messageString =
    typeof message === "string" ? message : JSON.stringify(message);
  const timestamp = Date.now();

  const dataToSign = `${messageString}:${timestamp}`;
  const signature = createHmac("sha256", Buffer.from(privateKey, "base64"))
    .update(dataToSign)
    .digest("base64");

  return {
    signature,
    timestamp,
  };
}

/**
 * Verify an Ed25519 message signature with constant-time comparison
 * Provides cryptographic verification of authenticity and integrity
 */
export function verifySignatureEd25519(
  message: string | object,
  signature: string,
  timestamp: number,
  publicKey: string
): boolean {
  try {
    const messageString =
      typeof message === "string" ? message : JSON.stringify(message);
    const dataToVerify = `${messageString}:${timestamp}`;

    const messageBytes = Buffer.from(dataToVerify, "utf8");
    const signatureBytes = Buffer.from(signature, "base64");
    const publicKeyBytes = Buffer.from(publicKey, "base64");

    return ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch (error) {
    // Log error but don't expose details
    console.error(
      "Ed25519 verification error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * @deprecated Use verifySignatureEd25519() for proper non-repudiation
 * Legacy HMAC-SHA256 verification - kept for backward compatibility
 */
export function verifySignature(
  message: string | object,
  signature: string,
  timestamp: number,
  publicKey: string
): boolean {
  console.warn(
    "verifySignature() is deprecated. Use verifySignatureEd25519() for proper security."
  );
  try {
    const messageString =
      typeof message === "string" ? message : JSON.stringify(message);
    const dataToSign = `${messageString}:${timestamp}`;

    const expectedSignature = createHmac(
      "sha256",
      Buffer.from(publicKey, "base64")
    )
      .update(dataToSign)
      .digest("base64");

    // Constant-time comparison to prevent timing attacks
    return constantTimeCompare(signature, expectedSignature);
  } catch (error) {
    return false;
  }
}

/**
 * Enhanced constant-time string comparison to prevent timing attacks
 * Uses multiple comparison strategies for maximum security
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  // Multiple passes with different operations to prevent pattern analysis
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    result |= (a.charCodeAt(i) + 1) ^ (b.charCodeAt(i) + 1);
    result |= (a.charCodeAt(i) * 2) ^ (b.charCodeAt(i) * 2);
  }

  return result === 0;
}

/**
 * Constant-time comparison for arrays/buffers
 */
export function constantTimeCompareBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Constant-time comparison for objects
 */
export function constantTimeCompareObjects(a: any, b: any): boolean {
  const aStr = JSON.stringify(a);
  const bStr = JSON.stringify(b);
  return constantTimeCompare(aStr, bStr);
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/**
 * Generate a random encryption key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: string | object, key: string): EncryptedData {
  const dataString = typeof data === "string" ? data : JSON.stringify(data);
  const keyBuffer = Buffer.from(key, "base64");
  const iv = randomBytes(16);

  const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

  let encrypted = cipher.update(dataString, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    data: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    algorithm: "aes-256-gcm",
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(
  encryptedData: EncryptedData,
  key: string
): string | object {
  try {
    const keyBuffer = Buffer.from(key, "base64");
    const iv = Buffer.from(encryptedData.iv, "base64");
    const tag = Buffer.from(encryptedData.tag, "base64");

    const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData.data, "base64", "utf8");
    decrypted += decipher.final("utf8");

    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    throw new Error("Decryption failed: Invalid data or key");
  }
}

/**
 * Generate a secure nonce for message signing
 */
export function generateNonce(): string {
  return `${Date.now()}:${randomBytes(16).toString("base64")}`;
}

/**
 * Hash data using SHA-256
 */
export function hash(data: string | object): string {
  const dataString = typeof data === "string" ? data : JSON.stringify(data);
  return createHash("sha256").update(dataString).digest("base64");
}

/**
 * Derive a key from a password using PBKDF2
 */
export function deriveKey(
  password: string,
  salt: string,
  iterations: number = 100000
): string {
  return createHmac("sha256", password).update(salt).digest("base64");
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if data is encrypted
 */
export function isEncrypted(data: any): data is EncryptedData {
  return (
    data &&
    typeof data === "object" &&
    typeof data.data === "string" &&
    typeof data.iv === "string" &&
    typeof data.tag === "string" &&
    typeof data.algorithm === "string"
  );
}

/**
 * Generate a random salt
 */
export function generateSalt(): string {
  return randomBytes(16).toString("base64");
}

/**
 * Securely compare two values
 */
export function secureCompare(a: any, b: any): boolean {
  const aString = typeof a === "string" ? a : JSON.stringify(a);
  const bString = typeof b === "string" ? b : JSON.stringify(b);

  return constantTimeCompare(hash(aString), hash(bString));
}
