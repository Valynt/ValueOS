/**
 * Token Encryption
 *
 * Envelope encryption for CRM OAuth tokens at rest.
 * Uses KEK-managed envelope encryption with key versioning for rotation support.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/* eslint-disable security/detect-object-injection -- Controlled environment variable access */

import { logger } from '../../lib/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH_BYTES = 32;
const VERSIONED_PREFIX = 'v';
const CIPHERTEXT_VERSION = 2;

interface ActiveKek {
  provider: string;
  keyId: string;
  version: number;
  material: Buffer;
}

function getEnvByVersion(base: string, version: number): string | undefined {
  if (version === 1) return process.env[base];
  return process.env[`${base}_V${version}`];
}

function parseRawKek(raw: string): Buffer {
  return createHash('sha256').update(raw).digest();
}

function getCurrentKeyVersion(): number {
  const configured = process.env.CRM_TOKEN_KEY_VERSION;
  const current = configured ? parseInt(configured, 10) : 1;
  if (!Number.isFinite(current) || current < 1) {
    throw new Error('CRM_TOKEN_KEY_VERSION must be an integer >= 1');
  }

  const maxAgeDays = Number.parseInt(process.env.CRM_TOKEN_KEY_MAX_AGE_DAYS || '', 10);
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    return current;
  }

  const lastRotatedRaw = process.env.CRM_TOKEN_LAST_ROTATED_AT;
  if (!lastRotatedRaw) {
    return current;
  }

  const lastRotatedAt = new Date(lastRotatedRaw);
  if (Number.isNaN(lastRotatedAt.getTime())) {
    throw new Error('CRM_TOKEN_LAST_ROTATED_AT must be a valid ISO-8601 date');
  }

  const expiryAt = lastRotatedAt.getTime() + maxAgeDays * 24 * 60 * 60 * 1000;
  if (Date.now() <= expiryAt) {
    return current;
  }

  const candidate = current + 1;
  const nextRaw = getEnvByVersion('CRM_TOKEN_KEK_SECRET', candidate);
  if (!nextRaw) {
    logger.warn('crm_token_encryption.rotation_due_without_successor', {
      event: 'crm_token_encryption.rotation_due_without_successor',
      configured_version: current,
      requested_version: candidate,
      max_age_days: maxAgeDays,
    });
    return current;
  }

  logger.info('crm_token_encryption.kek_rotation_promoted', {
    event: 'crm_token_encryption.kek_rotation_promoted',
    prior_version: current,
    new_version: candidate,
    max_age_days: maxAgeDays,
  });
  return candidate;
}

function getKekForVersion(version: number): ActiveKek {
  const provider = (process.env.CRM_TOKEN_KEK_PROVIDER || 'vault').toLowerCase();
  const keyId = getEnvByVersion('CRM_TOKEN_KEK_ID', version) || `crm-token-kek-v${version}`;
  const raw = getEnvByVersion('CRM_TOKEN_KEK_SECRET', version) ?? getEnvByVersion('CRM_TOKEN_ENCRYPTION_KEY', version);

  if (!raw) {
    logger.error('crm_token_encryption.kek_access_failed', undefined, {
      event: 'crm_token_encryption.kek_access_failed',
      provider,
      key_id: keyId,
      key_version: version,
    });
    throw new Error(`CRM_TOKEN_KEK_SECRET${version === 1 ? '' : `_V${version}`} environment variable is required for key version ${version}`);
  }

  return {
    provider,
    keyId,
    version,
    material: parseRawKek(raw),
  };
}

function wrapDataKey(dataKey: Buffer, kek: ActiveKek): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, kek.material, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

function unwrapDataKey(wrappedDataKey: string, kek: ActiveKek): Buffer {
  const parts = wrappedDataKey.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid wrapped data key format');
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, kek.material, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function encryptWithDataKey(dataKey: Buffer, plaintext: string): { ivBase64: string; authTagBase64: string; ciphertextBase64: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dataKey, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ivBase64: iv.toString('base64'),
    authTagBase64: authTag.toString('base64'),
    ciphertextBase64: encrypted.toString('base64'),
  };
}

function decryptWithDataKey(dataKey: Buffer, ivBase64: string, authTagBase64: string, ciphertextBase64: string): string {
  const decipher = createDecipheriv(ALGORITHM, dataKey, Buffer.from(ivBase64, 'base64'), { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Encrypt a plaintext string. Returns versioned ciphertext:
 * v2:{kekVersion}:{dataKeyVersion}:{createdAt}:{wrappedDataKey}:{iv_b64}:{authTag_b64}:{ciphertext_b64}
 */
export function encryptToken(plaintext: string): string {
  const version = getCurrentKeyVersion();
  const kek = getKekForVersion(version);
  const dataKey = randomBytes(KEY_LENGTH_BYTES);
  const wrappedDataKey = wrapDataKey(dataKey, kek);
  const encryptedPayload = encryptWithDataKey(dataKey, plaintext);

  return `${VERSIONED_PREFIX}${CIPHERTEXT_VERSION}:${kek.version}:${kek.version}:${String(Date.now())}:${wrappedDataKey}:${encryptedPayload.ivBase64}:${encryptedPayload.authTagBase64}:${encryptedPayload.ciphertextBase64}`;
}

/**
 * Decrypt a token. Supports v2 envelope format, prior v1 format, and legacy (iv:tag:ct).
 */
export function decryptToken(encryptedStr: string): string {
  if (encryptedStr.startsWith(`${VERSIONED_PREFIX}${CIPHERTEXT_VERSION}:`)) {
    const parts = encryptedStr.split(':');
    if (parts.length !== 8) {
      throw new Error('Invalid versioned encrypted token format');
    }

    const [, versionRaw, _dataKeyVersionRaw, _createdAt, wrappedDataKey, ivBase64, authTagBase64, ciphertextBase64] = parts;
    const version = parseInt(versionRaw, 10);

    try {
      const kek = getKekForVersion(version);
      const dataKey = unwrapDataKey(wrappedDataKey, kek);
      return decryptWithDataKey(dataKey, ivBase64, authTagBase64, ciphertextBase64);
    } catch (error) {
      logger.error('crm_token_encryption.decrypt_key_access_failed', error, {
        event: 'crm_token_encryption.decrypt_key_access_failed',
        key_version: version,
      });
      throw error;
    }
  }

  let version: number;
  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: string;

  if (encryptedStr.startsWith(VERSIONED_PREFIX) && /^v\d+:/.test(encryptedStr)) {
    const parts = encryptedStr.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid versioned encrypted token format');
    }
    version = parseInt(parts[0].slice(1), 10);
    iv = Buffer.from(parts[1], 'base64');
    authTag = Buffer.from(parts[2], 'base64');
    ciphertext = parts[3];
  } else {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    version = 1;
    iv = Buffer.from(parts[0], 'base64');
    authTag = Buffer.from(parts[1], 'base64');
    ciphertext = parts[2];
  }

  const legacyRaw = getEnvByVersion('CRM_TOKEN_ENCRYPTION_KEY', version);
  if (!legacyRaw) {
    logger.error('crm_token_encryption.legacy_key_access_failed', undefined, {
      event: 'crm_token_encryption.legacy_key_access_failed',
      key_version: version,
    });
    throw new Error(`CRM_TOKEN_ENCRYPTION_KEY${version === 1 ? '' : `_V${version}`} environment variable is required for key version ${version}`);
  }

  const legacyKey = createHash('sha256').update(legacyRaw).digest();
  const decipher = createDecipheriv(ALGORITHM, legacyKey, iv, { authTagLength: AUTH_TAG_LENGTH });
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

  if (encryptedStr.startsWith(`${VERSIONED_PREFIX}${CIPHERTEXT_VERSION}:`)) {
    const parts = encryptedStr.split(':');
    if (parts.length < 2) return true;
    return parseInt(parts[1], 10) !== currentVersion;
  }

  if (encryptedStr.startsWith(VERSIONED_PREFIX) && /^v\d+:/.test(encryptedStr)) {
    const versionStr = encryptedStr.split(':')[0].slice(1);
    return parseInt(versionStr, 10) !== currentVersion;
  }

  return currentVersion !== 1;
}
