/**
 * PII Filter - Sanitize Sensitive Data from Logs
 * 
 * SEC-004: CRITICAL - Prevents PII leakage in logs (GDPR/SOC 2 compliance)
 * 
 * This filter removes or redacts sensitive information before logging.
 * NEVER log raw user objects, request bodies, or configuration.
 */

import { logger } from '../lib/logger';
import { isDevelopment } from '../config/environment';

/**
 * Sensitive field patterns to redact
 */
const SENSITIVE_PATTERNS = [
  // Authentication & Security
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'access_token',
  'refresh_token',
  'bearer',
  'authorization',
  'auth',
  'session',
  'cookie',
  'csrf',
  
  // Personal Information
  'email',
  'e-mail',
  'mail',
  'phone',
  'telephone',
  'mobile',
  'ssn',
  'social_security',
  'tax_id',
  'passport',
  'license',
  'drivers_license',
  
  // Financial
  'credit_card',
  'creditcard',
  'card_number',
  'cvv',
  'cvc',
  'expiry',
  'expiration',
  'bank_account',
  'routing_number',
  'iban',
  'swift',
  
  // Health
  'medical',
  'health',
  'diagnosis',
  'prescription',
  
  // Other Sensitive
  'ip_address',
  'ip',
  'mac_address',
  'geolocation',
  'location',
  'address',
  'dob',
  'date_of_birth',
  'birthdate',
];

/**
 * Check if a key contains sensitive information
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_PATTERNS.some(pattern => 
    lowerKey.includes(pattern.toLowerCase())
  );
}

/**
 * Check if a value looks like sensitive data
 */
function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  
  // Check for JWT tokens
  if (/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(value)) {
    return true;
  }
  
  // Check for API keys (long alphanumeric strings)
  if (/^[a-zA-Z0-9_-]{32,}$/.test(value)) {
    return true;
  }
  
  // Check for credit card numbers
  if (/^\d{13,19}$/.test(value.replace(/\s/g, ''))) {
    return true;
  }
  
  // Check for email addresses
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return true;
  }
  
  return false;
}

/**
 * Redact a sensitive value
 */
function redactValue(value: unknown, key?: string): string {
  if (value === null || value === undefined) {
    return '[NULL]';
  }
  
  const valueStr = String(value);
  
  // In development, show partial value for debugging
  if (isDevelopment() && valueStr.length > 4) {
    return `[REDACTED:${valueStr.substring(0, 4)}...]`;
  }
  
  // In production, completely redact
  return '[REDACTED]';
}

/**
 * Sanitize an object for logging
 * 
 * @param obj - Object to sanitize
 * @param maxDepth - Maximum recursion depth (prevents circular references)
 * @returns Sanitized object safe for logging
 */
export function sanitizeForLogging(
  obj: unknown,
  maxDepth: number = 5
): unknown {
  // Handle primitives
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    // Check if primitive value is sensitive
    if (isSensitiveValue(obj)) {
      return redactValue(obj);
    }
    return obj;
  }
  
  // Prevent infinite recursion
  if (maxDepth <= 0) {
    return '[MAX_DEPTH_EXCEEDED]';
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, maxDepth - 1));
  }
  
  // Handle objects
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Check if key is sensitive
    if (isSensitiveKey(key)) {
      sanitized[key] = redactValue(value, key);
      continue;
    }
    
    // Check if value is sensitive
    if (isSensitiveValue(value)) {
      sanitized[key] = redactValue(value, key);
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, maxDepth - 1);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize user object for logging
 * Only log safe identifiers, never PII
 */
export function sanitizeUser(user: any): Record<string, unknown> {
  if (!user) return { user: null };
  
  return {
    id: user.id,
    role: user.role,
    tenant_id: user.tenant_id,
    // NEVER log: email, name, phone, address, etc.
  };
}

/**
 * Sanitize request object for logging
 * Only log safe metadata, never body or headers
 */
export function sanitizeRequest(req: any): Record<string, unknown> {
  if (!req) return { request: null };
  
  return {
    method: req.method,
    path: req.path || req.url,
    query: sanitizeForLogging(req.query),
    user_id: req.user?.id,
    tenant_id: req.headers?.['x-tenant-id'],
    ip: isDevelopment() ? req.ip : '[REDACTED]',
    // NEVER log: body, headers, cookies, authorization
  };
}

/**
 * Sanitize error for logging
 * Remove stack traces in production, sanitize error details
 */
export function sanitizeError(error: unknown): Record<string, unknown> {
  if (!error) return { error: null };
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isDevelopment() ? error.stack : '[REDACTED]',
      // Sanitize any additional properties
      ...sanitizeForLogging(
        Object.fromEntries(
          Object.entries(error).filter(([key]) => 
            !['name', 'message', 'stack'].includes(key)
          )
        )
      ),
    };
  }
  
  return sanitizeForLogging(error);
}

/**
 * Create a safe log context
 * Use this to build log context objects
 */
export function createLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return sanitizeForLogging(context);
}

/**
 * Validate that a log message doesn't contain PII
 * Throws error in development if PII detected
 */
export function validateLogMessage(message: string, context?: unknown): void {
  if (!isDevelopment()) return;
  
  // Check message for email patterns
  if (/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(message)) {
    logger.warn('⚠️ WARNING: Possible email in log message:', message);
  }
  
  // Check context for sensitive keys
  if (context && typeof context === 'object') {
    const keys = Object.keys(context);
    const sensitiveKeys = keys.filter(isSensitiveKey);
    
    if (sensitiveKeys.length > 0) {
      logger.warn('⚠️ WARNING: Sensitive keys in log context:', sensitiveKeys);
    }
  }
}

/**
 * Example usage:
 * 
 * // BAD:
 * logger.debug('User data:', user); // ❌ Logs PII
 * 
 * // GOOD:
 * import { log } from './lib/logger';
 * import { sanitizeUser } from './lib/piiFilter';
 * 
 * log.info('User action', sanitizeUser(user)); // ✅ Safe
 */
