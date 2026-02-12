/**
 * Token Encryption
 *
 * Envelope encryption for CRM OAuth tokens at rest.
 * Uses AES-256-GCM with key versioning for rotation support.
 * The encryption key is derived from CRM_TOKEN_ENCRYPTION_KEY env var.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Versioned format prefix
const VERSIONED_PREFIX = 'v';

function getKeyForVersion(version: number): Buffer {
  // Support key rotation: CRM_TOKEN_ENCRYPTION_KEY for v1,
  // CRM_TOKEN_ENCRYPTION_KEY_V{n} for later versions.
  const envName = version === 1
    ? 'CRM_TOKEN_ENCRYPTION_KEY'
    : `CRM_TOKEN_ENCRYPTION_KEY_V${version}`;

  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`${envName} environment variable is required for key version ${version}`);
  }
  return createHash('sha256').update(raw).digest();
}

function getCurrentKeyVersion(): number {
  const v = process.env.CRM_TOKEN_KEY_VERSION;
  return v ? parseInt(v, 10) : 1;
}

/**
 * Encrypt a plaintext string. Returns versioned ciphertext:
 * v{version}:{iv_b64}:{authTag_b64}:{ciphertext_b64}
 */
export function encryptToken(plaintext: string): string {
  const version = getCurrentKeyVersion();
  const key = getKeyForVersion(version);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${VERSIONED_PREFIX}${version}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a token. Supports both versioned (v1:...) and legacy (iv:tag:ct) formats.
 */
export function decryptToken(encryptedStr: string): string {
  let version: number;
  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: string;

  if (encryptedStr.startsWith(VERSIONED_PREFIX) && /^v\d+:/.test(encryptedStr)) {
    // Versioned format: v{n}:{iv}:{authTag}:{ciphertext}
    const parts = encryptedStr.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid versioned encrypted token format');
    }
    version = parseInt(parts[0].slice(1), 10);
    iv = Buffer.from(parts[1], 'base64');
    authTag = Buffer.from(parts[2], 'base64');
    ciphertext = parts[3];
  } else {
    // Legacy format: {iv}:{authTag}:{ciphertext} (always v1)
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    version = 1;
    iv = Buffer.from(parts[0], 'base64');
    authTag = Buffer.from(parts[1], 'base64');
    ciphertext = parts[2];
  }

  const key = getKeyForVersion(version);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Non-reversible fingerprint of a token for detection/logging.
 * Returns first 16 chars of SHA-256 hex digest.
 */
export function tokenFingerprint(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex').slice(0, 16);
}

/**
 * Check if a token was encrypted with the current key version.
 * Returns true if re-encryption is needed after key rotation.
 */
export function needsReEncryption(encryptedStr: string): boolean {
  const currentVersion = getCurrentKeyVersion();
  if (encryptedStr.startsWith(VERSIONED_PREFIX) && /^v\d+:/.test(encryptedStr)) {
    const versionStr = encryptedStr.split(':')[0].slice(1);
    return parseInt(versionStr, 10) !== currentVersion;
  }
  // Legacy format is always v1
  return currentVersion !== 1;
}
