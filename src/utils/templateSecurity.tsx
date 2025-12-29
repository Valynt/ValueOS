/**
 * Template Security Hardening Utilities
 * Provides XSS prevention, input validation, and CSRF protection for UI templates
 */

import React from "react";
import DOMPurify from "isomorphic-dompurify";

// ============================================================================
// XSS Prevention
// ============================================================================

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Uses DOMPurify with strict configuration
 */
export const sanitizeHTML = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed by default
    ALLOWED_ATTR: [], // No attributes allowed
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "style"],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onmouseout",
      "onfocus",
      "onblur",
    ],
    KEEP_CONTENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
};

/**
 * Sanitizes user input for display in templates
 * Removes dangerous content while preserving text
 */
export const sanitizeUserInput = (input: any): string => {
  if (input === null || input === undefined) return "";
  if (typeof input !== "string") return String(input);

  // Remove script tags and dangerous patterns
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/<[^>]*>/g, ""); // Remove all HTML tags

  return sanitizeHTML(sanitized);
};

/**
 * Sanitizes complex data objects (arrays, nested objects)
 */
export const sanitizeDataObject = <T,>(data: T): T => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDataObject(item)) as T;
  }

  if (typeof data === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        sanitized[key] = sanitizeUserInput(value);
      } else if (typeof value === "object") {
        sanitized[key] = sanitizeDataObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized as T;
  }

  if (typeof data === "string") {
    return sanitizeUserInput(data) as T;
  }

  return data;
};

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validates and sanitizes numeric inputs
 */
export const validateNumber = (
  input: any,
  min?: number,
  max?: number
): number => {
  const num = Number(input);
  if (isNaN(num)) return 0;

  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;

  return num;
};

/**
 * Validates string inputs with length limits
 */
export const validateString = (
  input: any,
  maxLength: number = 1000
): string => {
  if (input === null || input === undefined) return "";

  const str = String(input);
  const sanitized = sanitizeUserInput(str);

  return sanitized.slice(0, maxLength);
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates URL format
 */
export const validateURL = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * Validates array inputs
 */
export const validateArray = <T,>(input: any, maxLength: number = 100): T[] => {
  if (!Array.isArray(input)) return [];
  return input.slice(0, maxLength) as T[];
};

// ============================================================================
// CSRF Protection
// ============================================================================

/**
 * Generates CSRF token
 */
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

/**
 * Validates CSRF token
 */
export const validateCSRFToken = (token: string): boolean => {
  if (!token || typeof token !== "string") return false;
  return token.length === 64 && /^[0-9a-f]+$/.test(token);
};

/**
 * Stores CSRF token in secure manner
 */
export const storeCSRFToken = (token: string): void => {
  if (validateCSRFToken(token)) {
    sessionStorage.setItem("csrf_token", token);
  }
};

/**
 * Retrieves and validates CSRF token
 */
export const getCSRFToken = (): string | null => {
  const token = sessionStorage.getItem("csrf_token");
  return token && validateCSRFToken(token) ? token : null;
};

// ============================================================================
// Content Security Policy
// ============================================================================

/**
 * Validates content source
 */
export const validateContentSource = (source: string): boolean => {
  const allowedSources = [
    "https://",
    "http://localhost",
    "data:image/",
    "blob:",
  ];

  return allowedSources.some((allowed) => source.startsWith(allowed));
};

/**
 * Sanitizes image sources
 */
export const sanitizeImageSource = (src: string): string => {
  if (!validateContentSource(src)) {
    return "about:blank";
  }
  return src;
};

// ============================================================================
// Data Masking
// ============================================================================

/**
 * Masks sensitive data (e.g., credit cards, SSN)
 */
export const maskSensitiveData = (
  data: string,
  visibleChars: number = 4
): string => {
  if (!data || typeof data !== "string") return "";

  if (data.length <= visibleChars) return "*".repeat(data.length);

  const visible = data.slice(-visibleChars);
  return "*".repeat(data.length - visibleChars) + visible;
};

/**
 * Masks email address
 */
export const maskEmail = (email: string): string => {
  if (!validateEmail(email)) return "";

  const [local, domain] = email.split("@");
  const maskedLocal =
    local.length > 2
      ? local[0] + "*".repeat(local.length - 2) + local[local.length - 1]
      : "*".repeat(local.length);

  return `${maskedLocal}@${domain}`;
};

// ============================================================================
// Template-Specific Validators
// ============================================================================

/**
 * Validates ROI calculator inputs
 */
export const validateROIInputs = (inputs: {
  engHeadcount: number;
  engSalary: number;
  buildCost: number;
  efficiencyTarget: number;
}): {
  engHeadcount: number;
  engSalary: number;
  buildCost: number;
  efficiencyTarget: number;
} => {
  return {
    engHeadcount: validateNumber(inputs.engHeadcount, 1, 1000),
    engSalary: validateNumber(inputs.engSalary, 10, 500),
    buildCost: validateNumber(inputs.buildCost, 1, 10000),
    efficiencyTarget: validateNumber(inputs.efficiencyTarget, 1, 100),
  };
};

/**
 * Validates scenario data
 */
export const validateScenarioData = (scenario: {
  id: string;
  title: string;
  description: string;
  category?: string;
}): {
  id: string;
  title: string;
  description: string;
  category?: string;
} => {
  return {
    id: validateString(scenario.id, 50),
    title: validateString(scenario.title, 200),
    description: validateString(scenario.description, 1000),
    category: scenario.category
      ? validateString(scenario.category, 50)
      : undefined,
  };
};

/**
 * Validates persona analysis data
 */
export const validatePersonaAnalysis = (analysis: {
  id: string;
  persona: string;
  title: string;
  summary: string;
  confidence: number;
}): {
  id: string;
  persona: string;
  title: string;
  summary: string;
  confidence: number;
} => {
  return {
    id: validateString(analysis.id, 50),
    persona: validateString(analysis.persona, 20),
    title: validateString(analysis.title, 200),
    summary: validateString(analysis.summary, 1000),
    confidence: validateNumber(analysis.confidence, 0, 100),
  };
};

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Returns security headers for template responses
 */
export const getSecurityHeaders = (): Record<string, string> => ({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
});

// ============================================================================
// Safe JSON Parsing
// ============================================================================

/**
 * Safely parses JSON with validation
 */
export const safeJSONParse = <T,>(
  jsonString: string,
  defaultValue: T | null = null
): T | null => {
  try {
    const parsed = JSON.parse(jsonString);
    return sanitizeDataObject(parsed);
  } catch {
    return defaultValue;
  }
};

/**
 * Safely stringifies data with validation
 */
export const safeJSONStringify = <T,>(data: T): string | null => {
  try {
    // Remove circular references
    const seen = new WeakSet();
    const safeData = JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        return value;
      })
    );

    return JSON.stringify(sanitizeDataObject(safeData));
  } catch {
    return null;
  }
};

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Checks rate limit for a given identifier
 */
export const checkRateLimit = (
  identifier: string,
  config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }
): boolean => {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }

  if (existing.count >= config.maxRequests) {
    return false;
  }

  existing.count++;
  return true;
};

/**
 * Clears rate limit for identifier
 */
export const clearRateLimit = (identifier: string): void => {
  rateLimitStore.delete(identifier);
};

// ============================================================================
// Input Sanitization Pipeline
// ============================================================================

/**
 * Complete sanitization pipeline for template inputs
 */
export const sanitizeTemplateInput = <T,>(
  input: T,
  schema?: Record<string, any>
): T => {
  if (!input) return input;

  // Step 1: Sanitize data structure
  const sanitized = sanitizeDataObject(input);

  // Step 2: Validate against schema if provided
  if (schema) {
    const validated: any = {};
    for (const [key, validator] of Object.entries(schema)) {
      if (sanitized[key] !== undefined) {
        validated[key] = validator(sanitized[key]);
      }
    }
    return validated as T;
  }

  return sanitized;
};

// ============================================================================
// Security Event Logging
// ============================================================================

export interface SecurityEvent {
  type: "xss_attempt" | "csrf_violation" | "rate_limit" | "invalid_input";
  timestamp: number;
  source: string;
  details: any;
}

const securityEvents: SecurityEvent[] = [];

/**
 * Logs security events for monitoring
 */
export const logSecurityEvent = (
  event: Omit<SecurityEvent, "timestamp">
): void => {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: Date.now(),
  };

  securityEvents.push(fullEvent);

  // Keep only last 1000 events
  if (securityEvents.length > 1000) {
    securityEvents.shift();
  }

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === "production") {
    console.warn("SECURITY_EVENT:", JSON.stringify(fullEvent));
  }
};

/**
 * Retrieves recent security events
 */
export const getSecurityEvents = (limit: number = 100): SecurityEvent[] => {
  return securityEvents.slice(-limit);
};

// ============================================================================
// Template Security Wrapper
// ============================================================================

/**
 * Wraps template component with security measures
 */
export const withSecurity = <P extends object>(
  Component: React.ComponentType<P>,
  securityConfig: {
    sanitizeProps?: boolean;
    validateInputs?: boolean;
    requireCSRF?: boolean;
  } = {}
) => {
  const WrappedComponent = (props: P) => {
    const {
      sanitizeProps = true,
      validateInputs = false,
      requireCSRF = false,
    } = securityConfig;

    let sanitizedProps = { ...props };

    // Sanitize props if enabled
    if (sanitizeProps) {
      sanitizedProps = sanitizeDataObject(props) as P;
    }

    // Validate inputs if enabled
    if (validateInputs) {
      // Add validation logic here based on component type
    }

    // Check CSRF if required
    if (requireCSRF) {
      const token = getCSRFToken();
      if (!token) {
        logSecurityEvent({
          type: "csrf_violation",
          source: "withSecurity",
          details: { component: Component.name },
        });
        return null; // Or render error state
      }
    }

    return <Component {...sanitizedProps} />;
  };

  WrappedComponent.displayName = `withSecurity(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// ============================================================================
// Export all utilities
// ============================================================================

export default {
  // XSS Prevention
  sanitizeHTML,
  sanitizeUserInput,
  sanitizeDataObject,

  // Input Validation
  validateNumber,
  validateString,
  validateEmail,
  validateURL,
  validateArray,

  // CSRF Protection
  generateCSRFToken,
  validateCSRFToken,
  storeCSRFToken,
  getCSRFToken,

  // Content Security
  validateContentSource,
  sanitizeImageSource,

  // Data Masking
  maskSensitiveData,
  maskEmail,

  // Template Validators
  validateROIInputs,
  validateScenarioData,
  validatePersonaAnalysis,

  // Security Headers
  getSecurityHeaders,

  // Safe JSON
  safeJSONParse,
  safeJSONStringify,

  // Rate Limiting
  checkRateLimit,
  clearRateLimit,

  // Pipeline
  sanitizeTemplateInput,

  // Logging
  logSecurityEvent,
  getSecurityEvents,

  // Wrapper
  withSecurity,
};
