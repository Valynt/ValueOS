import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM
const KEY_LENGTH_BYTES = 32;
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

// Optional format for passphrase-based keys:
// pbkdf2:<iterations>:<salt-hex-or-base64>:<passphrase>
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
      'APP_ENCRYPTION_KEY pbkdf2 format is invalid. Expected pbkdf2:<iterations>=100000+:<salt-hex-or-base64>:<passphrase>',
    );
  }

  const salt = decodeEncodedValue(saltRaw);
  if (!salt) {
    throw new Error('APP_ENCRYPTION_KEY pbkdf2 salt must be hex or base64 encoded');
  }
  if (salt.length < 16) {
    throw new Error('APP_ENCRYPTION_KEY pbkdf2 salt must decode to at least 16 bytes');
  }

  return pbkdf2Sync(passphrase, salt, iterations, KEY_LENGTH_BYTES, 'sha256');
}

function parseEncryptionKey(rawKey: string): Buffer {
  const parsedDirect = decodeEncodedKey(rawKey);
  if (parsedDirect) return parsedDirect;

  const derived = deriveKeyFromPBKDF2(rawKey);
  if (derived) return derived;

  throw new Error(
    'APP_ENCRYPTION_KEY must be a 32-byte key encoded as hex/base64 (optionally prefixed with hex:/base64:) or pbkdf2:<iterations>:<salt>:<passphrase>.',
  );
}

function getRawEncryptionKey(): string | undefined {
  return process.env.APP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
}

function ensureEncryptionKeyAtStartup(rawKey = getRawEncryptionKey()): void {
  if (!rawKey) {
    if (IS_TEST) return;
    throw new Error('APP_ENCRYPTION_KEY is required and must be a valid encoded 32-byte key');
  }

  if (DEFAULT_KEYS.has(rawKey.trim().toLowerCase())) {
    throw new Error('APP_ENCRYPTION_KEY must not use a known default value');
  }

  parseEncryptionKey(rawKey);
}

if (IS_NON_DEV) {
  ensureEncryptionKeyAtStartup();
}

if (IS_PRODUCTION) {
  ensureEncryptionKeyAtStartup();
}

function getKey(): Buffer {
  const rawKey = getRawEncryptionKey();

  if (!rawKey) {
    if (IS_TEST) {
      return Buffer.from('00'.repeat(KEY_LENGTH_BYTES), 'hex');
    }
    throw new Error('APP_ENCRYPTION_KEY is required and must be a valid encoded 32-byte key');
  }

  return parseEncryptionKey(rawKey);
}

/**
 * Encrypts a string using AES-256-GCM
 * Output format: iv:authTag:encryptedContent (all hex)
 */
export function encrypt(text: string): string {
  if (!text) return text;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string using AES-256-GCM
 * Input format: iv:authTag:encryptedContent (all hex)
 */
export function decrypt(text: string): string {
  if (!text) return text;

  const parts = text.split(':');
  if (parts.length !== 3) {
    // If it doesn't look like our encrypted format, maybe return as is?
    // Or throw. For security, throwing or returning empty is safer than returning potentially raw data if we expected encrypted.
    // But if we want to migrate existing data, we might need a check.
    // For now, strict:
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
