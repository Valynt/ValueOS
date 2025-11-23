/**
 * Input Sanitizer
 * 
 * Implements input validation and sanitization to prevent injection attacks.
 * Protects against XSS, SQL injection, command injection, and other threats.
 */

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
  '/': '&#x2F;',
};

/**
 * Dangerous HTML tags
 */
const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link',
  'style', 'form', 'input', 'button', 'textarea', 'select',
]);

/**
 * Dangerous HTML attributes
 */
const DANGEROUS_ATTRIBUTES = new Set([
  'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
  'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur',
  'onchange', 'onsubmit', 'onreset', 'ondblclick', 'oncontextmenu',
]);

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
  return text.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Decode HTML entities
 */
export function decodeHtml(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Strip HTML tags
 */
export function stripHtmlTags(html: string, allowedTags: string[] = []): string {
  const allowedSet = new Set(allowedTags.map(tag => tag.toLowerCase()));
  
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    if (allowedSet.has(tag.toLowerCase())) {
      return match;
    }
    return '';
  });
}

/**
 * Strip dangerous HTML attributes
 */
export function stripDangerousAttributes(html: string): string {
  return html.replace(/\s+(on\w+|javascript:|data:)\s*=\s*["'][^"']*["']/gi, '');
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
    stripScripts = config.stripScripts,
    encodeHtml: shouldEncode = !allowHtml,
  } = options;

  let sanitized = html;

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // If HTML is not allowed, encode everything
  if (!allowHtml) {
    return encodeHtml(sanitized);
  }

  // Strip script tags
  if (stripScripts) {
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  // Strip dangerous tags
  for (const tag of DANGEROUS_TAGS) {
    const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }

  // Strip dangerous attributes
  sanitized = stripDangerousAttributes(sanitized);

  // Strip non-allowed tags
  if (allowedTags.length > 0) {
    sanitized = stripHtmlTags(sanitized, allowedTags);
  }

  // Filter attributes
  if (Object.keys(allowedAttributes).length > 0) {
    sanitized = sanitized.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
      const allowedAttrs = allowedAttributes[tag.toLowerCase()] || [];
      if (allowedAttrs.length === 0) {
        return `<${tag}>`;
      }

      const filteredAttrs = attrs.replace(/\s+([a-z-]+)\s*=\s*["']([^"']*)["']/gi, 
        (attrMatch: string, name: string, value: string) => {
          if (allowedAttrs.includes(name.toLowerCase())) {
            return ` ${name}="${encodeHtml(value)}"`;
          }
          return '';
        }
      );

      return `<${tag}${filteredAttrs}>`;
    });
  }

  return sanitized;
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
  const maxLength = options.maxLength || config.maxStringLength;

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
  } catch (error) {
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

  // Remove dangerous characters
  const sanitized = path.replace(/[<>:"|?*]/g, '');

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
    const parsed = JSON.parse(json);

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
  } catch (error) {
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
function getObjectDepth(obj: any, currentDepth: number = 0): number {
  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const depth = getObjectDepth(obj[key], currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return maxDepth;
}

/**
 * Check array lengths recursively
 */
function checkArrayLengths(obj: any, maxLength: number): boolean {
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
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (checkArrayLengths(obj[key], maxLength)) {
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
function sanitizeJsonValues(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj, { allowHtml: false });
  } else if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJsonValues(item));
  } else if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeJsonValues(obj[key]);
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

  const types = allowedTypes || config.allowedFileTypes;
  const size = maxSize || config.maxFileSize;

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
export function sanitizeObject(obj: any, options: SanitizeOptions = {}): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj, options).sanitized;
  } else if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  } else if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key], options);
      }
    }
    return sanitized;
  }

  return obj;
}
