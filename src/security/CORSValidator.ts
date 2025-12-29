/**
 * CORS Validator
 *
 * Validates CORS configuration to prevent security misconfigurations
 *
 * API-001: CORS hardening to prevent cross-origin attacks
 *
 * Security Rules:
 * 1. Cannot use wildcard (*) origin with credentials enabled
 * 2. All origins must be valid URLs (except '*')
 * 3. Origins are matched exactly (no pattern matching for security)
 */

import { logger } from "../lib/logger";

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
 * Validate CORS configuration for security issues
 */
export function validateCORSConfig(config: CORSConfig): void {
  // CRITICAL: Prevent wildcard with credentials (CSRF vulnerability)
  if (config.credentials && config.origins.includes("*")) {
    throw new Error(
      "SECURITY ERROR: Cannot use wildcard (*) origin with credentials enabled. " +
        "This allows any site to make authenticated requests, enabling CSRF attacks."
    );
  }

  // Validate each origin
  config.origins.forEach((origin) => {
    if (origin === "*") {
      logger.warn("CORS: Using wildcard origin - credentials will be disabled");
      return;
    }

    if (!isValidOrigin(origin)) {
      throw new Error(
        `Invalid CORS origin: "${origin}". ` +
          'Origins must be valid URLs (e.g., https://app.example.com) or "*"'
      );
    }
  });

  // Warn if credentials disabled (may be intentional)
  if (
    !config.credentials &&
    config.origins.length > 0 &&
    !config.origins.includes("*")
  ) {
    logger.info(
      "CORS: Credentials disabled - cookies will not be sent cross-origin"
    );
  }

  logger.info("CORS configuration validated", {
    origins: config.origins.length,
    credentials: config.credentials,
    methods: config.methods.join(", "),
  });
}

/**
 * Check if origin is a valid URL
 */
export function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    // Must use HTTPS in production (except localhost for dev)
    if (import.meta.env?.PROD) {
      if (url.protocol !== "https:") {
        logger.warn(`Non-HTTPS origin in production: ${origin}`);
        return false;
      }
    }

    // No trailing slashes
    if (origin.endsWith("/")) {
      logger.warn(`Origin has trailing slash: ${origin}`);
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get CORS origins from environment variable
 * Format: Comma-separated list of origins
 * Example: "https://app.valueos.com,https://staging.valueos.com"
 */
export function getEnvCORSOrigins(): string[] {
  // Use import.meta.env directly for Vite compatibility in the browser
  const envOrigins = (import.meta.env?.VITE_CORS_ORIGINS as string) || "";

  if (!envOrigins) {
    // Default origins for development
    if (import.meta.env?.DEV) {
      return [
        "http://localhost:5173", // Vite dev server
        "http://localhost:3000", // Alternative port
        "http://127.0.0.1:5173",
      ];
    }

    // Production should always have explicit origins
    logger.error("CORS_ORIGINS not configured for production!");
    return [];
  }

  // Parse and validate
  const origins = envOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  logger.info("CORS origins loaded from environment", {
    count: origins.length,
  });
  return origins;
}

/**
 * Check if request origin is allowed
 */
export function isOriginAllowed(
  requestOrigin: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!requestOrigin) {
    return false;
  }

  // Wildcard allows all
  if (allowedOrigins.includes("*")) {
    return true;
  }

  // Exact match only (no subdomain wildcards for security)
  return allowedOrigins.includes(requestOrigin);
}

/**
 * Get CORS headers for response
 */
export function getCORSHeaders(
  requestOrigin: string | undefined,
  config: CORSConfig
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!config.enabled) {
    return headers;
  }

  // Check if origin is allowed
  if (isOriginAllowed(requestOrigin, config.origins)) {
    // Use specific origin (not wildcard) when credentials enabled
    if (config.credentials && requestOrigin) {
      headers["Access-Control-Allow-Origin"] = requestOrigin;
      headers["Access-Control-Allow-Credentials"] = "true";
    } else if (config.origins.includes("*")) {
      headers["Access-Control-Allow-Origin"] = "*";
    } else if (requestOrigin) {
      headers["Access-Control-Allow-Origin"] = requestOrigin;
    }

    // Other headers
    headers["Access-Control-Allow-Methods"] = config.methods.join(", ");
    headers["Access-Control-Allow-Headers"] = config.allowedHeaders.join(", ");

    if (config.exposedHeaders.length > 0) {
      headers["Access-Control-Expose-Headers"] =
        config.exposedHeaders.join(", ");
    }

    if (config.maxAge > 0) {
      headers["Access-Control-Max-Age"] = config.maxAge.toString();
    }

    // Vary header to prevent caching issues
    headers["Vary"] = "Origin";
  }

  return headers;
}
