import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM
const DEFAULT_DEV_KEYS = new Set(['default-dev-key-must-be-32-bytes!!']);
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const IS_NON_DEV = !['development', 'test'].includes(ENVIRONMENT);

// Ensure key is available or fail (unless testing)
const ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

if (IS_NON_DEV) {
  if (!ENCRYPTION_KEY) {
    throw new Error('APP_ENCRYPTION_KEY is required in non-development environments');
  }
  if (DEFAULT_DEV_KEYS.has(ENCRYPTION_KEY)) {
    throw new Error('APP_ENCRYPTION_KEY must be set to a non-default value');
  }
}

// Helper to get key buffer (must be 32 bytes)
function getKey(): Buffer {
  // Use provided key or fallback to a deterministic default for dev
  const keyStr = ENCRYPTION_KEY || 'default-dev-key-must-be-32-bytes!!';
  // Ensure exactly 32 bytes
  if (Buffer.byteLength(keyStr) < 32) {
      return Buffer.from(keyStr.padEnd(32).slice(0, 32));
  }
  return Buffer.from(keyStr.slice(0, 32));
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
