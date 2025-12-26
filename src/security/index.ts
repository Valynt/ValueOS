/**
 * Security Module
 *
 * Centralized security implementation for the ValueCanvas application.
 * Implements OWASP Top 10 mitigations and security best practices.
 *
 * Features:
 * - Password validation and hashing
 * - Input sanitization and validation
 * - CSRF protection
 * - Rate limiting
 * - Security headers
 * - Configuration management
 */

import { logger } from "../lib/logger";
import { getConfig } from "../config/environment";
import { getSecurityConfig, validateSecurityConfig } from "./SecurityConfig";
import {
  attachCSRFFetchInterceptor,
  initializeCSRFProtection,
} from "./CSRFProtection";
import { createSecurityMetaTags, logSecurityHeaders } from "./SecurityHeaders";

// Configuration
export {
  getSecurityConfig,
  loadSecurityConfig,
  resetSecurityConfig,
  validateSecurityConfig,
  type SecurityConfig,
  type PasswordPolicy,
  type RateLimitConfig,
  type SessionConfig,
  type CORSConfig,
  type CSPConfig,
  type InputValidationConfig,
  type EncryptionConfig,
  type SecurityHeadersConfig,
  type AuditConfig,
} from "./SecurityConfig";

// Password Validation
export {
  validatePassword,
  checkPasswordBreach,
  generateStrongPassword,
  hashPassword,
  verifyPassword,
  calculatePasswordEntropy,
  estimateCrackTime,
  type PasswordValidationResult,
} from "./PasswordValidator";

// Input Sanitization
export {
  encodeHtml,
  decodeHtml,
  stripHtmlTags,
  stripDangerousAttributes,
  sanitizeHtml,
  sanitizeString,
  sanitizeUrl,
  sanitizeFilePath,
  validateEmail,
  validatePhoneNumber,
  sanitizeJson,
  validateFileUpload,
  sanitizeObject,
  type SanitizeOptions,
  type ValidationResult,
} from "./InputSanitizer";

// CSRF Protection
export {
  generateCSRFToken,
  validateCSRFToken,
  refreshCSRFToken,
  getCSRFToken,
  deleteCSRFToken,
  clearAllCSRFTokens,
  setCSRFCookie,
  getCSRFCookie,
  deleteCSRFCookie,
  addCSRFHeader,
  addCSRFToFormData,
  addCSRFToURL,
  fetchWithCSRF,
  initializeCSRFProtection,
  attachCSRFFetchInterceptor,
  getCSRFTokenFromMeta,
  useCSRFToken,
  type CSRFToken,
  type CSRFTokenConfig,
} from "./CSRFProtection";

// Rate Limiting
export {
  RateLimiter,
  RateLimitExceededError,
  checkGlobalRateLimit,
  checkUserRateLimit,
  checkOrgRateLimit,
  checkAuthRateLimit,
  consumeGlobalRateLimit,
  consumeUserRateLimit,
  consumeOrgRateLimit,
  consumeAuthRateLimit,
  resetRateLimit,
  fetchWithRateLimit,
  useRateLimit,
  cleanupRateLimiters,
  type RateLimitResult,
} from "./RateLimiter";

// Secure in-memory caching with zeroization
// NOTE: SecureCache uses Node.js crypto and is server-only
// Import directly from './SecureCache' when needed on the server
// export { SecureCache, secureCache, type SecureCacheOptions } from './SecureCache';

// Security Headers
export {
  generateCSPHeader,
  generateHSTSHeader,
  generateXFrameOptionsHeader,
  generateXContentTypeOptionsHeader,
  generateXXSSProtectionHeader,
  generateReferrerPolicyHeader,
  generatePermissionsPolicyHeader,
  getSecurityHeaders,
  applySecurityHeaders,
  createSecurityMetaTags,
  validateSecurityHeaders,
  logSecurityHeaders,
} from "./SecurityHeaders";

/**
 * Initialize all security features
 */
export function initializeSecurity(sessionId?: string): void {
  logger.debug("Initializing security features...");

  // Load configuration
  const securityConfig = getSecurityConfig();
  const envConfig = getConfig();
  logger.debug("Security configuration loaded");

  // Initialize CSRF protection
  if (envConfig.security.csrfEnabled) {
    initializeCSRFProtection(sessionId);
    attachCSRFFetchInterceptor();
    logger.debug("CSRF protection initialized");
  }

  // Create security meta tags
  if (
    securityConfig.csp.enabled ||
    securityConfig.headers.referrerPolicy.enabled
  ) {
    createSecurityMetaTags();
    logger.debug("Security meta tags created");
  }

  // Log security headers in development
  if (envConfig.app.env === "development") {
    logSecurityHeaders();
  }

  logger.debug("Security initialization complete");
}

/**
 * Validate security configuration on startup
 */
export function validateSecurity(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const securityConfig = getSecurityConfig();
  const envConfig = getConfig();
  const errors = validateSecurityConfig(securityConfig);
  const warnings: string[] = [];

  // Check for weak configurations
  const MIN_RECOMMENDED_PASSWORD_LENGTH = 12;
  if (
    securityConfig.passwordPolicy.minLength < MIN_RECOMMENDED_PASSWORD_LENGTH
  ) {
    warnings.push(
      "Password minimum length is less than recommended 12 characters"
    );
  }

  if (!envConfig.security.httpsOnly && envConfig.app.env === "production") {
    warnings.push("HTTPS is not enforced in production");
  }

  if (!envConfig.security.csrfEnabled) {
    warnings.push("CSRF protection is disabled");
  }

  if (!securityConfig.csp.enabled) {
    warnings.push("Content Security Policy is disabled");
  }

  const MAX_SAFE_RATE_LIMIT = 1000;
  if (securityConfig.rateLimit.global.maxRequests > MAX_SAFE_RATE_LIMIT) {
    warnings.push("Global rate limit is very high");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get security status
 */
export function getSecurityStatus(): {
  configured: boolean;
  features: {
    passwordPolicy: boolean;
    inputValidation: boolean;
    csrfProtection: boolean;
    rateLimiting: boolean;
    securityHeaders: boolean;
    encryption: boolean;
  };
  warnings: string[];
} {
  const securityConfig = getSecurityConfig();
  const envConfig = getConfig();
  const validation = validateSecurity();

  const MIN_PASSWORD_LENGTH = 8;
  return {
    configured: validation.valid,
    features: {
      passwordPolicy:
        securityConfig.passwordPolicy.minLength >= MIN_PASSWORD_LENGTH,
      inputValidation: securityConfig.inputValidation.sanitizeHtml,
      csrfProtection: envConfig.security.csrfEnabled,
      rateLimiting: securityConfig.rateLimit.global.enabled,
      securityHeaders:
        securityConfig.csp.enabled ||
        securityConfig.headers.strictTransportSecurity.enabled,
      encryption:
        securityConfig.encryption.atRestEnabled &&
        securityConfig.encryption.inTransitEnabled,
    },
    warnings: validation.warnings,
  };
}

/**
 * Export default initialization
 */
export default {
  initialize: initializeSecurity,
  validate: validateSecurity,
  getStatus: getSecurityStatus,
};
