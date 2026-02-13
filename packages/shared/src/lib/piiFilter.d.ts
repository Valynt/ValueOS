/**
 * PII Filter - Sanitize Sensitive Data from Logs
 *
 * SEC-004: CRITICAL - Prevents PII leakage in logs (GDPR/SOC 2 compliance)
 *
 * This filter removes or redacts sensitive information before logging.
 * NEVER log raw user objects, request bodies, or configuration.
 */
/**
 * Sanitize an object for logging
 *
 * @param obj - Object to sanitize
 * @param maxDepth - Maximum recursion depth (prevents circular references)
 * @returns Sanitized object safe for logging
 */
export declare function sanitizeForLogging(obj: unknown, maxDepth?: number): unknown;
/**
 * Sanitize user object for logging
 * Only log safe identifiers, never PII
 */
export declare function sanitizeUser(user: any): Record<string, unknown>;
/**
 * Sanitize request object for logging
 * Only log safe metadata, never body or headers
 */
export declare function sanitizeRequest(req: any): Record<string, unknown>;
/**
 * Sanitize error objects for logging
 * Preserves stack trace in development only
 */
export declare function sanitizeError(error: unknown): Record<string, unknown>;
/**
 * Create a safe log context
 * Use this to build log context objects
 */
export declare function createLogContext(context: Record<string, unknown>): Record<string, unknown>;
/**
 * Validate that a log message doesn't contain PII
 * Throws error in development if PII detected
 */
export declare function validateLogMessage(message: string, context?: unknown): void;
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
//# sourceMappingURL=piiFilter.d.ts.map