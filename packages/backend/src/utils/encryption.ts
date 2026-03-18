import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';

import { logger } from '../lib/logger.js';

// eslint-disable-next-line security/detect-object-injection -- Controlled environment variable access
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH_BYTES = 32;
const CIPHERTEXT_VERSION = 2;
const VERSIONED_PREFIX = 'v';
const DEFAULT_KEYS = new Set([
  'default-dev-key-must-be-32-bytes!!',
  'changeme',
  'development-key',
  'test-key',
]);
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const IS_TEST = ENVIRONMENT === 'test';
const IS_PRODUCTION = ENVIRONMENT === 'production';
const IS_NON_DEV = !['development', 'test'].includes(ENVIRONMENT);

interface ActiveKek {
  provider: string;
  keyId: string;
  version: number;
  material: Buffer;
}

interface RotationPolicy {
  maxAgeDays: number;
  createdAt: Date;
  lastRotatedAt: Date;
}

function decodeEncodedValue(value: string): Buffer | null {
  if (value.startsWith('hex:')) {
    const hexValue = value.slice(4);
    return /^[0-9a-fA-F]+$/.test(hexValue) ? Buffer.from(hexValue, 'hex') : null;
  }

  if (value.startsWith('base64:')) {
    const base64Value = value.slice(7);
    return /^[A-Za-z0-9+/]+={0,2}$/.test(base64Value) ? Buffer.from(base64Value, 'base64') : null;
  }

  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    return Buffer.from(value, 'hex');
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return Buffer.from(value, 'base64');
  }

  return null;
}

function decodeEncodedKey(value: string): Buffer | null {
  const decoded = decodeEncodedValue(value);
  return decoded && decoded.length === KEY_LENGTH_BYTES ? decoded : null;
}

function deriveKeyFromPBKDF2(value: string): Buffer | null {
  if (!value.startsWith('pbkdf2:')) return null;

  const [, iterationsRaw, saltRaw, ...passphraseParts] = value.split(':');
  const passphrase = passphraseParts.join(':');
  const iterations = Number.parseInt(iterationsRaw || '', 10);

  if (!Number.isInteger(iterations) || iterations < 100_000 || !saltRaw || !passphrase) {
    throw new Error(
      'APP_ENCRYPTION_KEK_MATERIAL pbkdf2 format is invalid. Expected pbkdf2:<iterations>=100000+:<salt-hex-or-base64>:<passphrase>',
    );
  }

  const salt = decodeEncodedValue(saltRaw);
  if (!salt) {
    throw new Error('APP_ENCRYPTION_KEK_MATERIAL pbkdf2 salt must be hex or base64 encoded');
  }
  if (salt.length < 16) {
    throw new Error('APP_ENCRYPTION_KEK_MATERIAL pbkdf2 salt must decode to at least 16 bytes');
  }

  return pbkdf2Sync(passphrase, salt, iterations, KEY_LENGTH_BYTES, 'sha256');
}

function parseKekMaterial(rawKey: string): Buffer {
  const parsedDirect = decodeEncodedKey(rawKey);
  if (parsedDirect) return parsedDirect;

  const derived = deriveKeyFromPBKDF2(rawKey);
  if (derived) return derived;

  throw new Error(
    'APP_ENCRYPTION_KEK_MATERIAL must be a 32-byte key encoded as hex/base64 (optionally prefixed with hex:/base64:) or pbkdf2:<iterations>:<salt>:<passphrase>.',
  );
}

function getEnvByVersion(base: string, version: number): string | undefined {
  if (version === 1) {
    return process.env[base];
  }
  return process.env[`${base}_V${version}`];
}

function readRotationPolicy(kekVersion: number): RotationPolicy | null {
  const maxAgeDays = Number.parseInt(process.env.APP_ENCRYPTION_KEY_MAX_AGE_DAYS || '', 10);
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    return null;
  }

  const createdAtRaw = getEnvByVersion('APP_ENCRYPTION_KEK_CREATED_AT', kekVersion) || process.env.APP_ENCRYPTION_KEK_CREATED_AT;
  const lastRotatedRaw = process.env.APP_ENCRYPTION_LAST_ROTATED_AT || createdAtRaw;
  const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date(0);
  const lastRotatedAt = lastRotatedRaw ? new Date(lastRotatedRaw) : createdAt;

  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('APP_ENCRYPTION_KEK_CREATED_AT must be a valid ISO-8601 date');
  }
  if (Number.isNaN(lastRotatedAt.getTime())) {
    throw new Error('APP_ENCRYPTION_LAST_ROTATED_AT must be a valid ISO-8601 date');
  }

  return { maxAgeDays, createdAt, lastRotatedAt };
}

function getCurrentKekVersion(): number {
  const configured = Number.parseInt(process.env.APP_ENCRYPTION_KEK_VERSION || '1', 10);
  if (!Number.isFinite(configured) || configured < 1) {
    throw new Error('APP_ENCRYPTION_KEK_VERSION must be an integer >= 1');
  }

  const policy = readRotationPolicy(configured);
  if (!policy) return configured;

  const expiryTime = policy.lastRotatedAt.getTime() + policy.maxAgeDays * 24 * 60 * 60 * 1000;
  if (Date.now() <= expiryTime) return configured;

  const rotatedVersion = configured + 1;
  const candidateMaterial = getEnvByVersion('APP_ENCRYPTION_KEK_MATERIAL', rotatedVersion);
  if (!candidateMaterial) {
    logger.warn('encryption.kek_rotation_due_without_successor', {
      event: 'encryption.kek_rotation_due_without_successor',
      configured_version: configured,
      requested_version: rotatedVersion,
      max_age_days: policy.maxAgeDays,
      last_rotated_at: policy.lastRotatedAt.toISOString(),
    });
    return configured;
  }

  logger.info('encryption.kek_rotation_promoted', {
    event: 'encryption.kek_rotation_promoted',
    prior_version: configured,
    new_version: rotatedVersion,
    max_age_days: policy.maxAgeDays,
  });
  return rotatedVersion;
}

function getKekForVersion(version: number): ActiveKek {
  const provider = (process.env.APP_ENCRYPTION_KEK_PROVIDER || 'vault').toLowerCase();
  const keyId = getEnvByVersion('APP_ENCRYPTION_KEK_ID', version) || process.env.APP_ENCRYPTION_KEK_ID || `app-encryption-v${version}`;
  const rawMaterial = getEnvByVersion('APP_ENCRYPTION_KEK_MATERIAL', version);

  if (!rawMaterial) {
    logger.error('encryption.kek_access_failed', undefined, {
      event: 'encryption.kek_access_failed',
      provider,
      key_id: keyId,
      key_version: version,
    });
    throw new Error(`APP_ENCRYPTION_KEK_MATERIAL${version === 1 ? '' : `_V${version}`} is required for KEK version ${version}`);
  }

  return {
    provider,
    keyId,
    version,
    material: parseKekMaterial(rawMaterial),
  };
}

function ensureKekAtStartup(): void {
  const version = getCurrentKekVersion();
  const material = getEnvByVersion('APP_ENCRYPTION_KEK_MATERIAL', version);

  if (!material) {
    if (IS_TEST) return;
    throw new Error('APP_ENCRYPTION_KEK_MATERIAL is required and must be a valid encoded 32-byte key');
  }

  if (DEFAULT_KEYS.has(material.trim().toLowerCase())) {
    throw new Error('APP_ENCRYPTION_KEK_MATERIAL must not use a known default value');
  }

  parseKekMaterial(material);
}

if (IS_NON_DEV) {
  ensureKekAtStartup();
}

if (IS_PRODUCTION) {
  ensureKekAtStartup();
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

function getLegacyKey(): Buffer {
  const rawKey = process.env.APP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    if (IS_TEST) {
      return Buffer.from('00'.repeat(KEY_LENGTH_BYTES), 'hex');
    }
    throw new Error('APP_ENCRYPTION_KEY is required for decrypting legacy ciphertext');
  }

  return parseKekMaterial(rawKey);
}

/**
 * Encrypts a string using envelope encryption backed by a KEK from Vault/KMS.
 * Output format:
 * v2:{kekVersion}:{dataKeyVersion}:{createdAt}:{wrappedDataKey}:{iv}:{authTag}:{ciphertext}
 */
export function encrypt(text: string): string {
  if (!text) return text;

  const kekVersion = getCurrentKekVersion();
  const kek = getKekForVersion(kekVersion);
  const dataKey = randomBytes(KEY_LENGTH_BYTES);
  const wrappedDataKey = wrapDataKey(dataKey, kek);
  const encryptedPayload = encryptWithDataKey(dataKey, text);

  return [
    `${VERSIONED_PREFIX}${CIPHERTEXT_VERSION}`,
    String(kek.version),
    String(kek.version),
    String(Date.now()),
    wrappedDataKey,
    encryptedPayload.ivBase64,
    encryptedPayload.authTagBase64,
    encryptedPayload.ciphertextBase64,
  ].join(':');
}

/**
 * Decrypts both versioned envelope format and legacy iv:authTag:ciphertext format.
 */
export function decrypt(text: string): string {
  if (!text) return text;

  if (text.startsWith(`${VERSIONED_PREFIX}${CIPHERTEXT_VERSION}:`)) {
    const parts = text.split(':');
    if (parts.length !== 8) {
      throw new Error('Invalid encrypted text format');
    }

    const [, kekVersionRaw, _dataKeyVersionRaw, _createdAt, wrappedDataKey, ivBase64, authTagBase64, ciphertextBase64] = parts;
    const kekVersion = Number.parseInt(kekVersionRaw, 10);

    try {
      const kek = getKekForVersion(kekVersion);
      const dataKey = unwrapDataKey(wrappedDataKey, kek);
      return decryptWithDataKey(dataKey, ivBase64, authTagBase64, ciphertextBase64);
    } catch (error) {
      logger.error('encryption.decrypt_key_access_failed', error, {
        event: 'encryption.decrypt_key_access_failed',
        key_version: kekVersion,
      });
      throw error;
    }
  }

  const parts = text.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getLegacyKey(), iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
