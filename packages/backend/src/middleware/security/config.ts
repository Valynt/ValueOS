/**
 * Security Configuration
 *
 * Environment-based configuration for CORS and security headers.
 * Parses and validates security settings from environment variables.
 */

import { z } from 'zod';

// ============================================================================
// Environment Variable Names
// ============================================================================

export const ENV_VARS = {
  CORS_ALLOWED_ORIGINS: 'CORS_ALLOWED_ORIGINS',
  CORS_ALLOWED_METHODS: 'CORS_ALLOWED_METHODS',
  CORS_ALLOWED_HEADERS: 'CORS_ALLOWED_HEADERS',
  CORS_EXPOSED_HEADERS: 'CORS_EXPOSED_HEADERS',
  CORS_MAX_AGE: 'CORS_MAX_AGE',
  CORS_CREDENTIALS: 'CORS_CREDENTIALS',
  HSTS_MAX_AGE: 'HSTS_MAX_AGE',
  HSTS_INCLUDE_SUBDOMAINS: 'HSTS_INCLUDE_SUBDOMAINS',
  HSTS_PRELOAD: 'HSTS_PRELOAD',
  CSP_REPORT_URI: 'CSP_REPORT_URI',
  CSP_REPORT_ONLY: 'CSP_REPORT_ONLY',
  FRAME_ANCESTORS: 'FRAME_ANCESTORS',
  NODE_ENV: 'NODE_ENV',
} as const;

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
];

const DEFAULT_CORS_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
];

const DEFAULT_CORS_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Request-ID',
  'X-Correlation-ID',
];

const DEFAULT_EXPOSED_HEADERS = [
  'X-Request-ID',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
];

// One year in seconds
const DEFAULT_HSTS_MAX_AGE = 31536000;

// Preflight cache: 24 hours
const DEFAULT_CORS_MAX_AGE = 86400;

// ============================================================================
// Configuration Schema
// ============================================================================

/**
 * CORS configuration schema.
 */
export const CorsConfigSchema = z.object({
  /**
   * List of allowed origins.
   * Can be specific URLs or regex patterns.
   * NEVER use '*' when credentials are enabled.
   */
  allowedOrigins: z.array(z.string()).min(1),

  /**
   * Allowed HTTP methods.
   */
  allowedMethods: z.array(z.string()),

  /**
   * Allowed request headers.
   */
  allowedHeaders: z.array(z.string()),

  /**
   * Headers exposed to the client.
   */
  exposedHeaders: z.array(z.string()),

  /**
   * Preflight cache duration in seconds.
   */
  maxAge: z.number().int().positive(),

  /**
   * Allow credentials (cookies, authorization headers).
   * When true, origin MUST NOT be '*'.
   */
  credentials: z.boolean(),
});

export type CorsConfig = z.infer<typeof CorsConfigSchema>;

/**
 * HSTS configuration schema.
 */
export const HstsConfigSchema = z.object({
  /**
   * Max age in seconds.
   */
  maxAge: z.number().int().nonnegative(),

  /**
   * Include subdomains in HSTS policy.
   */
  includeSubDomains: z.boolean(),

  /**
   * Enable HSTS preload.
   * Only enable if you've submitted to the preload list.
   */
  preload: z.boolean(),
});

export type HstsConfig = z.infer<typeof HstsConfigSchema>;

/**
 * CSP configuration schema.
 */
export const CspConfigSchema = z.object({
  /**
   * Default source directive.
   */
  defaultSrc: z.array(z.string()),

  /**
   * Script source directive.
   */
  scriptSrc: z.array(z.string()),

  /**
   * Style source directive.
   */
  styleSrc: z.array(z.string()),

  /**
   * Image source directive.
   */
  imgSrc: z.array(z.string()),

  /**
   * Connect source directive (XHR, WebSocket, etc.).
   */
  connectSrc: z.array(z.string()),

  /**
   * Font source directive.
   */
  fontSrc: z.array(z.string()),

  /**
   * Object source directive.
   */
  objectSrc: z.array(z.string()),

  /**
   * Frame ancestors directive (replaces X-Frame-Options).
   */
  frameAncestors: z.array(z.string()),

  /**
   * Base URI directive.
   */
  baseUri: z.array(z.string()),

  /**
   * Form action directive.
   */
  formAction: z.array(z.string()),

  /**
   * Upgrade insecure requests.
   */
  upgradeInsecureRequests: z.boolean(),

  /**
   * Report URI for CSP violations.
   */
  reportUri: z.string().optional(),

  /**
   * Use report-only mode (doesn't block, just reports).
   */
  reportOnly: z.boolean(),
});

export type CspConfig = z.infer<typeof CspConfigSchema>;

/**
 * Complete security configuration.
 */
export const SecurityConfigSchema = z.object({
  cors: CorsConfigSchema,
  hsts: HstsConfigSchema,
  csp: CspConfigSchema,
  environment: z.enum(['development', 'staging', 'production', 'test']),
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// ============================================================================
// Environment Parsing
// ============================================================================

/**
 * Parse a comma-separated list from environment variable.
 */
function parseList(value: string | undefined, defaults: string[]): string[] {
  if (!value || value.trim() === '') {
    return defaults;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Parse a boolean from environment variable.
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const lower = value.toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'yes';
}

/**
 * Parse an integer from environment variable.
 */
function parseInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validate CORS origins.
 * Ensures no wildcard when credentials are enabled.
 */
function validateCorsOrigins(origins: string[], credentials: boolean): string[] {
  // Check for wildcard with credentials
  if (credentials && origins.includes('*')) {
    throw new Error(
      'CORS configuration error: Cannot use wildcard (*) origin when credentials are enabled. ' +
      'Specify explicit origins or disable credentials.'
    );
  }

  // Validate each origin format
  for (const origin of origins) {
    if (origin === '*') continue;

    // Allow regex patterns (start with ^)
    if (origin.startsWith('^')) continue;

    // Validate URL format
    try {
      new URL(origin);
    } catch {
      throw new Error(
        `CORS configuration error: Invalid origin "${origin}". ` +
        'Origins must be valid URLs (e.g., https://example.com) or regex patterns (starting with ^).'
      );
    }
  }

  return origins;
}

/**
 * Parse CORS configuration from environment.
 */
export function parseCorsConfig(env: Record<string, string | undefined> = process.env): CorsConfig {
  const credentials = parseBoolean(env[ENV_VARS.CORS_CREDENTIALS], true);
  const origins = parseList(env[ENV_VARS.CORS_ALLOWED_ORIGINS], DEFAULT_CORS_ORIGINS);

  return {
    allowedOrigins: validateCorsOrigins(origins, credentials),
    allowedMethods: parseList(env[ENV_VARS.CORS_ALLOWED_METHODS], DEFAULT_CORS_METHODS),
    allowedHeaders: parseList(env[ENV_VARS.CORS_ALLOWED_HEADERS], DEFAULT_CORS_HEADERS),
    exposedHeaders: parseList(env[ENV_VARS.CORS_EXPOSED_HEADERS], DEFAULT_EXPOSED_HEADERS),
    maxAge: parseInteger(env[ENV_VARS.CORS_MAX_AGE], DEFAULT_CORS_MAX_AGE),
    credentials,
  };
}

/**
 * Parse HSTS configuration from environment.
 */
export function parseHstsConfig(env: Record<string, string | undefined> = process.env): HstsConfig {
  return {
    maxAge: parseInteger(env[ENV_VARS.HSTS_MAX_AGE], DEFAULT_HSTS_MAX_AGE),
    includeSubDomains: parseBoolean(env[ENV_VARS.HSTS_INCLUDE_SUBDOMAINS], true),
    preload: parseBoolean(env[ENV_VARS.HSTS_PRELOAD], false),
  };
}

/**
 * Get default CSP configuration based on environment.
 */
export function getDefaultCspConfig(
  environment: string,
  env: Record<string, string | undefined> = process.env
): CspConfig {
  const isDevelopment = environment === 'development' || environment === 'test';
  const reportUri = env[ENV_VARS.CSP_REPORT_URI];
  const reportOnly = parseBoolean(env[ENV_VARS.CSP_REPORT_ONLY], false);
  const frameAncestors = parseList(env[ENV_VARS.FRAME_ANCESTORS], ["'none'"]);

  if (isDevelopment) {
    // Relaxed CSP for development (allows HMR, eval, etc.)
    return {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'https://localhost:*'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameAncestors,
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: false,
      reportUri,
      reportOnly,
    };
  }

  // Production CSP - strict
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    objectSrc: ["'none'"],
    frameAncestors,
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: true,
    reportUri,
    reportOnly,
  };
}

/**
 * Parse complete security configuration from environment.
 */
export function parseSecurityConfig(
  env: Record<string, string | undefined> = process.env
): SecurityConfig {
  const environment = (env[ENV_VARS.NODE_ENV] || 'development') as SecurityConfig['environment'];

  const config: SecurityConfig = {
    cors: parseCorsConfig(env),
    hsts: parseHstsConfig(env),
    csp: getDefaultCspConfig(environment, env),
    environment,
  };

  // Validate the complete configuration
  return SecurityConfigSchema.parse(config);
}

// ============================================================================
// Singleton Configuration
// ============================================================================

let cachedConfig: SecurityConfig | null = null;

/**
 * Get the security configuration.
 * Parses from environment on first call, then caches.
 */
export function getSecurityConfig(): SecurityConfig {
  if (!cachedConfig) {
    cachedConfig = parseSecurityConfig();
  }
  return cachedConfig;
}

/**
 * Reset the cached configuration.
 * Useful for testing.
 */
export function resetSecurityConfig(): void {
  cachedConfig = null;
}

/**
 * Set a custom security configuration.
 * Useful for testing.
 */
export function setSecurityConfig(config: SecurityConfig): void {
  cachedConfig = SecurityConfigSchema.parse(config);
}
