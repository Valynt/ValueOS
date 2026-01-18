const REDACTED_VALUE = '[REDACTED]';

const HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'proxy-authorization',
]);

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._-]+\b/i,
  /\bBasic\s+[A-Za-z0-9+/=]+\b/i,
  /\b[A-F0-9]{32,}\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
];

const SECRET_KEYWORDS = [
  'password',
  'passwd',
  'token',
  'secret',
  'api_key',
  'apikey',
  'auth',
  'authorization',
  'cookie',
  'session',
  'ssn',
  'email',
  'phone',
  'credit',
  'card',
];

function shouldRedactKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  if (HEADER_KEYS.has(lowerKey)) {
    return true;
  }
  return SECRET_KEYWORDS.some((keyword) => lowerKey.includes(keyword));
}

function shouldRedactValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return shouldRedactValue(value) ? REDACTED_VALUE : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return redactSensitiveData(value as Record<string, unknown>);
  }
  return value;
}

export function redactSensitiveData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((entry) => redactValue(entry)) as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (shouldRedactKey(key)) {
      result[key] = REDACTED_VALUE;
      continue;
    }
    result[key] = redactValue(value);
  }

  return result as T;
}

export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  return redactSensitiveData(headers);
}
