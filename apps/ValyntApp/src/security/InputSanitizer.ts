/**
 * Input Sanitizer
 * 
 * Implements input validation and sanitization to prevent injection attacks.
 * Protects against XSS, SQL injection, command injection, and other threats.
 */

import DOMPurify from 'isomorphic-dompurify';

import { getSecurityConfig } from './SecurityConfig';

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
  stripScripts?: boolean;
  encodeHtml?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  errors: string[];
  warnings: string[];
}

/**
 * HTML entities map
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
  /(--|\#|\/\*|\*\/)/g,
  /(\bOR\b.*=.*)/gi,
  /(\bAND\b.*=.*)/gi,
  /('|"|;|\||&)/g,
];

/**
 * Command injection patterns
 */
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$(){}[\]<>]/g,
  /\.\.\//g,
  /~\//g,
];

/**
 * Path traversal patterns
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%2e%2e\\/gi,
];

/**
 * Encode HTML entities
 */
export function encodeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Decode HTML entities
 */
export function decodeHtml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (typeof entity !== 'string') {
      return match;
    }

    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    switch (entity) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return match;
    }
  });
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(
  html: string,
  options: SanitizeOptions = {}
): string {
  const config = getSecurityConfig().inputValidation;
  const {
    allowHtml = false,
    allowedTags = [],
    allowedAttributes = {},
    maxLength = config.maxStringLength,
  } = options;

  let sanitized = html;

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // If HTML is not allowed: first strip dangerous elements, then encode remaining HTML
  if (!allowHtml) {
    // Remove scripts and event handlers but keep the raw tag text for encoding
    const stripped = sanitized
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
    // Encode all remaining HTML characters including /
    return stripped.replace(/[&<>"'/]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;',
    }[char] ?? char));
  }

  // Prepare DOMPurify config
  const purifyConfig: DOMPurify.Config = {};

  if (allowedTags.length > 0) {
    purifyConfig.ALLOWED_TAGS = allowedTags;
  } else {
    // Default safe configuration if no tags specified
    purifyConfig.USE_PROFILES = { html: true };
    purifyConfig.ADD_ATTR = ['target']; // Allow target attribute (often used for links)
  }

  if (Object.keys(allowedAttributes).length > 0) {
    // Flatten allowed attributes as DOMPurify applies them globally
    const allAllowedAttrs = new Set<string>();
    Object.values(allowedAttributes).forEach(attrs => {
      attrs.forEach(attr => allAllowedAttrs.add(attr));
    });
    purifyConfig.ALLOWED_ATTR = Array.from(allAllowedAttrs);

    // When explicit attributes are provided, disable profile defaults to ensure strict whitelist
    delete purifyConfig.USE_PROFILES;
    delete purifyConfig.ADD_ATTR;
  }

  // Sanitize using DOMPurify
  return DOMPurify.sanitize(sanitized, purifyConfig) as string;
}

/**
 * Validate and sanitize string input
 */
export function sanitizeString(
  input: string,
  options: SanitizeOptions = {}
): ValidationResult {
  const config = getSecurityConfig().inputValidation;
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxLength = options.maxLength ?? config.maxStringLength;

  // Check length
  if (input.length > maxLength) {
    warnings.push(`Input truncated to ${maxLength} characters`);
  }

  // Sanitize
  const sanitized = sanitizeHtml(input, options);

  // Check for SQL injection attempts
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially dangerous SQL patterns');
      break;
    }
  }

  // Check for command injection attempts
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially dangerous command patterns');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
    warnings,
  };
}

export function sanitizeInput(input: string, options: SanitizeOptions = {}): string {
  return sanitizeString(input, options).sanitized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }

    // Check for javascript: protocol
    if (parsed.protocol === 'javascript:') {
      errors.push('JavaScript URLs are not allowed');
    }

    // Check for data: protocol
    if (parsed.protocol === 'data:') {
      warnings.push('Data URLs should be used with caution');
    }

    // Sanitize by reconstructing
    const sanitized = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;

    return {
      valid: errors.length === 0,
      sanitized,
      errors,
      warnings,
    };
  } catch (_error: unknown) {
    return {
      valid: false,
      sanitized: '',
      errors: ['Invalid URL format'],
      warnings: [],
    };
  }
}

/**
 * Validate and sanitize file path
 */
export function sanitizeFilePath(path: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for path traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(path)) {
      errors.push('Path contains directory traversal patterns');
      break;
    }
  }

  // Check for absolute paths
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    warnings.push('Absolute paths should be avoided');
  }

  // Remove dangerous characters and path traversal sequences
  const sanitized = path
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/%2e%2e%2f/gi, '')
    .replace(/%2e%2e\\/gi, '')
    .replace(/[<>:"|?*]/g, '');

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
    warnings,
  };
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic email regex (RFC 5322 simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  // Check length
  if (email.length > 254) {
    errors.push('Email address is too long');
  }

  // Check for suspicious patterns
  if (email.includes('..')) {
    warnings.push('Email contains consecutive dots');
  }

  const sanitized = email.toLowerCase().trim();

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
    warnings,
  };
}

/**
 * Validate phone number
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Check if it contains only digits and optional + prefix
  if (!/^\+?\d{10,15}$/.test(cleaned)) {
    errors.push('Invalid phone number format');
  }

  return {
    valid: errors.length === 0,
    sanitized: cleaned,
    errors,
    warnings,
  };
}

/**
 * Sanitize JSON input
 */
export function sanitizeJson(json: string): ValidationResult {
  const config = getSecurityConfig().inputValidation;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Parse JSON
    const parsed: unknown = JSON.parse(json);

    // Check depth
    const depth = getObjectDepth(parsed);
    if (depth > config.maxObjectDepth) {
      errors.push(`JSON object depth exceeds maximum of ${config.maxObjectDepth}`);
    }

    // Check array lengths
    const hasLongArray = checkArrayLengths(parsed, config.maxArrayLength);
    if (hasLongArray) {
      errors.push(`JSON contains arrays exceeding maximum length of ${config.maxArrayLength}`);
    }

    // Sanitize string values
    const sanitized = sanitizeJsonValues(parsed);

    return {
      valid: errors.length === 0,
      sanitized: JSON.stringify(sanitized),
      errors,
      warnings,
    };
  } catch (_error: unknown) {
    return {
      valid: false,
      sanitized: '',
      errors: ['Invalid JSON format'],
      warnings: [],
    };
  }
}

/**
 * Get object depth
 */
function getObjectDepth(obj: unknown, currentDepth: number = 0): number {
  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const depth = getObjectDepth((obj as Record<string, unknown>)[key], currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return maxDepth;
}

/**
 * Check array lengths recursively
 */
function checkArrayLengths(obj: unknown, maxLength: number): boolean {
  if (Array.isArray(obj)) {
    if (obj.length > maxLength) {
      return true;
    }
    for (const item of obj) {
      if (checkArrayLengths(item, maxLength)) {
        return true;
      }
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const key in obj as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (checkArrayLengths((obj as Record<string, unknown>)[key], maxLength)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Sanitize JSON values recursively
 */
function sanitizeJsonValues(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj, { allowHtml: false });
  } else if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJsonValues(item));
  } else if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeJsonValues((obj as Record<string, unknown>)[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: File,
  allowedTypes?: string[],
  maxSize?: number
): ValidationResult {
  const config = getSecurityConfig().inputValidation;
  const errors: string[] = [];
  const warnings: string[] = [];

  const types = allowedTypes ?? config.allowedFileTypes;
  const size = maxSize ?? config.maxFileSize;

  // Check file type
  if (!types.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  // Check file size
  if (file.size > size) {
    errors.push(`File size ${file.size} exceeds maximum of ${size} bytes`);
  }

  // Check file name
  const fileNameResult = sanitizeFilePath(file.name);
  if (!fileNameResult.valid) {
    errors.push(...fileNameResult.errors);
  }

  return {
    valid: errors.length === 0,
    sanitized: fileNameResult.sanitized,
    errors,
    warnings,
  };
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: unknown, options: SanitizeOptions = {}): unknown {
  if (typeof obj === 'string') {
    return sanitizeString(obj, options).sanitized;
  } else if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  } else if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject((obj as Record<string, unknown>)[key], options);
      }
    }
    return sanitized;
  }

  return obj;
}

/** Remove all HTML tags from a string. */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/** Remove dangerous HTML attributes (event handlers, javascript: hrefs). */
export function stripDangerousAttributes(input: string): string {
  return input
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
}