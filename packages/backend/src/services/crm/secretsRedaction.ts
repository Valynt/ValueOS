/**
 * Secrets Redaction
 *
 * Scrubs sensitive CRM fields from log output and error messages.
 * Used by the CRM module to prevent token leakage in logs.
 */

const REDACTED = '[REDACTED]';

/**
 * Sensitive key names, all stored in lowercase for case-insensitive matching.
 */
const SENSITIVE_KEYS = new Set([
  'access_token',
  'accesstoken',
  'access_token_enc',
  'refresh_token',
  'refreshtoken',
  'refresh_token_enc',
  'client_secret',
  'clientsecret',
  'webhook_secret',
  'webhooksecret',
  'authorization',
  'x-sfdc-signature',
  'x-hubspot-signature',
  'token',
  'bearer',
]);

/**
 * Deep-redact sensitive keys from an object for safe logging.
 * Returns a new object — does not mutate the input.
 */
export function redactSecrets(obj: unknown, depth = 0): unknown {
  if (depth > 10) return REDACTED;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSecrets(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else if (typeof value === 'string' && looksLikeToken(value)) {
      result[key] = REDACTED;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSecrets(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Heuristic: strings that look like bearer tokens or long hex/base64 secrets.
 */
function looksLikeToken(value: string): boolean {
  if (value.startsWith('Bearer ')) return true;
  // Long base64-ish strings (>40 chars, no spaces)
  if (value.length > 40 && !value.includes(' ') && /^[A-Za-z0-9+/=_.-]+$/.test(value)) {
    return true;
  }
  return false;
}
