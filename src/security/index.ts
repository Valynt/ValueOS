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
} from './SecurityConfig';

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
} from './PasswordValidator';

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
} from './InputSanitizer';

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
  getCSRFTokenFromMeta,
  useCSRFToken,
  type CSRFToken,
  type CSRFTokenConfig,
} from './CSRFProtection';

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
} from './RateLimiter';

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
} from './SecurityHeaders';

/**
 * Initialize all security features
 */
export function initializeSecurity(sessionId?: string): void {
  console.log('Initializing security features...');

  // Load configuration
  const config = getSecurityConfig();
  console.log('Security configuration loaded');

  // Initialize CSRF protection
  if (config.security.csrfEnabled) {
    initializeCSRFProtection(sessionId);
    console.log('CSRF protection initialized');
  }

  // Create security meta tags
  if (config.csp.enabled || config.headers.referrerPolicy.enabled) {
    createSecurityMetaTags();
    console.log('Security meta tags created');
  }

  // Log security headers in development
  if (config.app.env === 'development') {
    logSecurityHeaders();
  }

  console.log('Security initialization complete');
}

/**
 * Validate security configuration on startup
 */
export function validateSecurity(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const config = getSecurityConfig();
  const errors = validateSecurityConfig(config);
  const warnings: string[] = [];

  // Check for weak configurations
  if (config.passwordPolicy.minLength < 12) {
    warnings.push('Password minimum length is less than recommended 12 characters');
  }

  if (!config.security.httpsOnly && config.app.env === 'production') {
    warnings.push('HTTPS is not enforced in production');
  }

  if (!config.security.csrfEnabled) {
    warnings.push('CSRF protection is disabled');
  }

  if (!config.csp.enabled) {
    warnings.push('Content Security Policy is disabled');
  }

  if (config.rateLimit.global.maxRequests > 1000) {
    warnings.push('Global rate limit is very high');
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
  const config = getSecurityConfig();
  const validation = validateSecurity();

  return {
    configured: validation.valid,
    features: {
      passwordPolicy: config.passwordPolicy.minLength >= 8,
      inputValidation: config.inputValidation.sanitizeHtml,
      csrfProtection: config.security.csrfEnabled,
      rateLimiting: config.rateLimit.global.enabled,
      securityHeaders: config.csp.enabled || config.headers.strictTransportSecurity.enabled,
      encryption: config.encryption.atRestEnabled && config.encryption.inTransitEnabled,
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
