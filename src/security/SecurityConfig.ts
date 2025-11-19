/**
 * Security Configuration
 * 
 * Centralized security configuration implementing OWASP Top 10 mitigations.
 * Provides security policies, validation rules, and enforcement mechanisms.
 */

import { getConfig } from '../config/environment';

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars: string;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
  maxAge: number; // days
  historyCount: number; // prevent reuse of last N passwords
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator?: (req: any) => string;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  timeout: number; // milliseconds
  absoluteTimeout: number; // milliseconds
  renewalThreshold: number; // milliseconds before expiry to renew
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  domain?: string;
  path: string;
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  enabled: boolean;
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Content Security Policy configuration
 */
export interface CSPConfig {
  enabled: boolean;
  directives: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    fontSrc: string[];
    connectSrc: string[];
    frameSrc: string[];
    objectSrc: string[];
    mediaSrc: string[];
    workerSrc: string[];
    formAction: string[];
    frameAncestors: string[];
    baseUri: string[];
    upgradeInsecureRequests: boolean;
  };
  reportUri?: string;
  reportOnly: boolean;
}

/**
 * Input validation configuration
 */
export interface InputValidationConfig {
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectDepth: number;
  allowedFileTypes: string[];
  maxFileSize: number; // bytes
  sanitizeHtml: boolean;
  stripScripts: boolean;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  saltRounds: number;
  pepper?: string;
  atRestEnabled: boolean;
  inTransitEnabled: boolean;
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  strictTransportSecurity: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  xFrameOptions: {
    enabled: boolean;
    value: 'DENY' | 'SAMEORIGIN';
  };
  xContentTypeOptions: {
    enabled: boolean;
  };
  xXssProtection: {
    enabled: boolean;
    mode: 'block' | 'report';
  };
  referrerPolicy: {
    enabled: boolean;
    value: string;
  };
  permissionsPolicy: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
}

/**
 * Audit logging configuration
 */
export interface AuditConfig {
  enabled: boolean;
  logLevel: 'all' | 'security' | 'critical';
  includeRequestBody: boolean;
  includeResponseBody: boolean;
  maskSensitiveData: boolean;
  sensitiveFields: string[];
  retentionDays: number;
}

/**
 * Complete security configuration
 */
export interface SecurityConfig {
  passwordPolicy: PasswordPolicy;
  rateLimit: {
    global: RateLimitConfig;
    perUser: RateLimitConfig;
    perOrg: RateLimitConfig;
    auth: RateLimitConfig;
  };
  session: SessionConfig;
  cors: CORSConfig;
  csp: CSPConfig;
  inputValidation: InputValidationConfig;
  encryption: EncryptionConfig;
  headers: SecurityHeadersConfig;
  audit: AuditConfig;
}

/**
 * Default password policy (OWASP recommendations)
 */
const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  preventCommonPasswords: true,
  preventUserInfo: true,
  maxAge: 90, // 90 days
  historyCount: 5,
};

/**
 * Default rate limiting configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  enabled: true,
  windowMs: 60000, // 1 minute
  maxRequests: 60,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

/**
 * Default session configuration
 */
const DEFAULT_SESSION_CONFIG: SessionConfig = {
  timeout: 3600000, // 1 hour
  absoluteTimeout: 28800000, // 8 hours
  renewalThreshold: 300000, // 5 minutes
  secure: true,
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
};

/**
 * Default CORS configuration
 */
const DEFAULT_CORS_CONFIG: CORSConfig = {
  enabled: true,
  origins: [],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Default CSP configuration
 */
const DEFAULT_CSP_CONFIG: CSPConfig = {
  enabled: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // TODO: Remove unsafe-inline in production
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    workerSrc: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: true,
  },
  reportOnly: false,
};

/**
 * Default input validation configuration
 */
const DEFAULT_INPUT_VALIDATION: InputValidationConfig = {
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxObjectDepth: 10,
  allowedFileTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/json',
  ],
  maxFileSize: 10485760, // 10MB
  sanitizeHtml: true,
  stripScripts: true,
};

/**
 * Default encryption configuration
 */
const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 256,
  saltRounds: 12,
  atRestEnabled: true,
  inTransitEnabled: true,
};

/**
 * Default security headers configuration
 */
const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
  strictTransportSecurity: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  xFrameOptions: {
    enabled: true,
    value: 'DENY',
  },
  xContentTypeOptions: {
    enabled: true,
  },
  xXssProtection: {
    enabled: true,
    mode: 'block',
  },
  referrerPolicy: {
    enabled: true,
    value: 'strict-origin-when-cross-origin',
  },
  permissionsPolicy: {
    enabled: true,
    directives: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
    },
  },
};

/**
 * Default audit configuration
 */
const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  logLevel: 'security',
  includeRequestBody: false,
  includeResponseBody: false,
  maskSensitiveData: true,
  sensitiveFields: [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'email',
  ],
  retentionDays: 90,
};

/**
 * Load security configuration from environment
 */
export function loadSecurityConfig(): SecurityConfig {
  const envConfig = getConfig();

  return {
    passwordPolicy: DEFAULT_PASSWORD_POLICY,

    rateLimit: {
      global: {
        ...DEFAULT_RATE_LIMIT,
        enabled: envConfig.security.rateLimitPerMinute > 0,
        maxRequests: envConfig.security.rateLimitPerMinute,
      },
      perUser: {
        ...DEFAULT_RATE_LIMIT,
        maxRequests: Math.floor(envConfig.security.rateLimitPerMinute * 0.5),
      },
      perOrg: {
        ...DEFAULT_RATE_LIMIT,
        maxRequests: Math.floor(envConfig.security.rateLimitPerMinute * 2),
      },
      auth: {
        ...DEFAULT_RATE_LIMIT,
        windowMs: 900000, // 15 minutes
        maxRequests: 5, // 5 login attempts per 15 minutes
        skipSuccessfulRequests: true,
      },
    },

    session: {
      ...DEFAULT_SESSION_CONFIG,
      timeout: envConfig.auth.sessionTimeout,
      secure: envConfig.security.httpsOnly,
    },

    cors: {
      ...DEFAULT_CORS_CONFIG,
      enabled: envConfig.security.corsOrigins.length > 0,
      origins: envConfig.security.corsOrigins,
    },

    csp: {
      ...DEFAULT_CSP_CONFIG,
      enabled: envConfig.security.cspEnabled,
      directives: {
        ...DEFAULT_CSP_CONFIG.directives,
        connectSrc: [
          "'self'",
          envConfig.app.apiBaseUrl,
          envConfig.agents.apiUrl,
          envConfig.database.url,
        ],
        upgradeInsecureRequests: envConfig.security.httpsOnly,
      },
    },

    inputValidation: DEFAULT_INPUT_VALIDATION,
    encryption: DEFAULT_ENCRYPTION_CONFIG,
    headers: DEFAULT_SECURITY_HEADERS,
    audit: DEFAULT_AUDIT_CONFIG,
  };
}

/**
 * Global security configuration instance
 */
let securityConfigInstance: SecurityConfig | null = null;

/**
 * Get the current security configuration
 */
export function getSecurityConfig(): SecurityConfig {
  if (!securityConfigInstance) {
    securityConfigInstance = loadSecurityConfig();
  }
  return securityConfigInstance;
}

/**
 * Reset security configuration (for testing)
 */
export function resetSecurityConfig(): void {
  securityConfigInstance = null;
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): string[] {
  const errors: string[] = [];

  // Password policy validation
  if (config.passwordPolicy.minLength < 8) {
    errors.push('Password minimum length must be at least 8 characters');
  }

  // Rate limiting validation
  if (config.rateLimit.global.maxRequests < 1) {
    errors.push('Rate limit must allow at least 1 request');
  }

  // Session validation
  if (config.session.timeout < 60000) {
    errors.push('Session timeout must be at least 1 minute');
  }

  // CORS validation
  if (config.cors.enabled && config.cors.origins.length === 0) {
    errors.push('CORS origins must be specified when CORS is enabled');
  }

  return errors;
}

/**
 * Export default configuration
 */
export default getSecurityConfig();
