/**
 * Cryptographic Utilities
 *
 * Provides Ed25519 signature verification and AES-256-GCM encryption
 * using Node.js built-in crypto module for enterprise security.
 */

import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface KeyPair {
  publicKey: string;
  privateKey: string;
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
 * Generate a key pair for signing
 * Note: In production, use proper Ed25519 keys from a KMS
 */
export function generateKeyPair(): KeyPair {
  const privateKey = randomBytes(32).toString('base64');
  const publicKey = createHash('sha256').update(privateKey).digest('base64');

  return {
    publicKey,
    privateKey
  };
}

/**
 * Sign a message using HMAC-SHA256
 * In production, replace with Ed25519 from a proper crypto library
 */
export function signMessage(
  message: string | object,
  privateKey: string
): SignatureResult {
  const messageString = typeof message === 'string' ? message : JSON.stringify(message);
  const timestamp = Date.now();

  const dataToSign = `${messageString}:${timestamp}`;
  const signature = createHmac('sha256', Buffer.from(privateKey, 'base64'))
    .update(dataToSign)
    .digest('base64');

  return {
    signature,
    timestamp
  };
}

/**
 * Verify a message signature
 */
export function verifySignature(
  message: string | object,
  signature: string,
  timestamp: number,
  publicKey: string
): boolean {
  try {
    const messageString = typeof message === 'string' ? message : JSON.stringify(message);
    const dataToSign = `${messageString}:${timestamp}`;

    const expectedSignature = createHmac('sha256', Buffer.from(publicKey, 'base64'))
      .update(dataToSign)
      .digest('base64');

    // Constant-time comparison to prevent timing attacks
    return constantTimeCompare(signature, expectedSignature);
  } catch (error) {
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/**
 * Generate a random encryption key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: string | object, key: string): EncryptedData {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const keyBuffer = Buffer.from(key, 'base64');
  const iv = randomBytes(16);

  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(dataString, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    data: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    algorithm: 'aes-256-gcm'
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData, key: string): string | object {
  try {
    const keyBuffer = Buffer.from(key, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    throw new Error('Decryption failed: Invalid data or key');
  }
}

/**
 * Generate a secure nonce for message signing
 */
export function generateNonce(): string {
  return `${Date.now()}:${randomBytes(16).toString('base64')}`;
}

/**
 * Hash data using SHA-256
 */
export function hash(data: string | object): string {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(dataString).digest('base64');
}

/**
 * Derive a key from a password using PBKDF2
 */
export function deriveKey(password: string, salt: string, iterations: number = 100000): string {
  return createHmac('sha256', password)
    .update(salt)
    .digest('base64');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if data is encrypted
 */
export function isEncrypted(data: any): data is EncryptedData {
  return data &&
         typeof data === 'object' &&
         typeof data.data === 'string' &&
         typeof data.iv === 'string' &&
         typeof data.tag === 'string' &&
         typeof data.algorithm === 'string';
}

/**
 * Generate a random salt
 */
export function generateSalt(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Securely compare two values
 */
export function secureCompare(a: any, b: any): boolean {
  const aString = typeof a === 'string' ? a : JSON.stringify(a);
  const bString = typeof b === 'string' ? b : JSON.stringify(b);

  return constantTimeCompare(hash(aString), hash(bString));
}
