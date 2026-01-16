/**
 * String Sanitization Utilities
 *
 * Prevents log injection, XSS, and other injection attacks.
 * All sanitizers are designed to be safe by default.
 */

// ============================================================================
// Log Injection Prevention
// ============================================================================

/**
 * Characters that can be used for log injection attacks.
 * - Newlines: Can create fake log entries
 * - Carriage returns: Can overwrite log lines
 * - ANSI escape codes: Can manipulate terminal output
 * - Null bytes: Can truncate strings
 */
const LOG_INJECTION_PATTERN = /[\r\n\x00-\x1f\x7f-\x9f]/g;

/**
 * ANSI escape sequence pattern (terminal manipulation)
 */
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * Sanitize a string for safe logging.
 * Removes newlines, control characters, and ANSI escape codes.
 *
 * @param input - String to sanitize
 * @param maxLength - Maximum length (default: 1000)
 * @returns Sanitized string safe for logging
 */
export function sanitizeForLog(input: unknown, maxLength = 1000): string {
  if (input === null || input === undefined) {
    return '';
  }

  const str = typeof input === 'string' ? input : String(input);

  return str
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(LOG_INJECTION_PATTERN, ' ')
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize an object for safe logging.
 * Recursively sanitizes all string values.
 */
export function sanitizeObjectForLog(
  obj: Record<string, unknown>,
  maxDepth = 5
): Record<string, unknown> {
  if (maxDepth <= 0) {
    return { _truncated: true };
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeForLog(key, 100);

    if (value === null || value === undefined) {
      result[sanitizedKey] = value;
    } else if (typeof value === 'string') {
      result[sanitizedKey] = sanitizeForLog(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[sanitizedKey] = value;
    } else if (Array.isArray(value)) {
      result[sanitizedKey] = value.slice(0, 100).map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeObjectForLog(item as Record<string, unknown>, maxDepth - 1)
          : sanitizeForLog(item)
      );
    } else if (typeof value === 'object') {
      result[sanitizedKey] = sanitizeObjectForLog(
        value as Record<string, unknown>,
        maxDepth - 1
      );
    } else {
      result[sanitizedKey] = sanitizeForLog(value);
    }
  }

  return result;
}

// ============================================================================
// XSS Prevention
// ============================================================================

/**
 * HTML entities for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS.
 *
 * @param input - String to escape
 * @returns HTML-escaped string
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Strip all HTML tags from a string.
 *
 * @param input - String containing HTML
 * @returns String with HTML tags removed
 */
export function stripHtml(input: string): string {
  // Remove script and style tags with their content
  let result = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove all other HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  return result.trim();
}

/**
 * Remove dangerous attributes and protocols from HTML.
 * Use when you need to allow some HTML but prevent XSS.
 */
export function sanitizeHtml(input: string): string {
  let result = input;

  // Remove event handlers (onclick, onerror, etc.)
  result = result.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: and vbscript: protocols
  result = result.replace(/javascript\s*:/gi, '');
  result = result.replace(/vbscript\s*:/gi, '');
  result = result.replace(/data\s*:/gi, '');

  // Remove expression() in styles (IE)
  result = result.replace(/expression\s*\([^)]*\)/gi, '');

  // Remove script tags
  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  return result;
}

// ============================================================================
// SQL Injection Prevention (for dynamic queries - prefer parameterized)
// ============================================================================

/**
 * Escape single quotes for SQL strings.
 * NOTE: Always prefer parameterized queries over escaping.
 */
export function escapeSqlString(input: string): string {
  return input.replace(/'/g, "''");
}

/**
 * Escape LIKE pattern special characters.
 */
export function escapeSqlLike(input: string, escapeChar = '\\'): string {
  return input
    .replace(new RegExp(`\\${escapeChar}`, 'g'), escapeChar + escapeChar)
    .replace(/%/g, escapeChar + '%')
    .replace(/_/g, escapeChar + '_');
}

// ============================================================================
// General String Sanitization
// ============================================================================

/**
 * Remove null bytes from a string.
 * Null bytes can cause string truncation in some systems.
 */
export function removeNullBytes(input: string): string {
  return input.replace(/\x00/g, '');
}

/**
 * Normalize whitespace in a string.
 * Collapses multiple spaces, removes leading/trailing whitespace.
 */
export function normalizeWhitespace(input: string): string {
  return input
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Remove invisible/zero-width characters.
 * These can be used to bypass filters or create confusing content.
 */
export function removeInvisibleChars(input: string): string {
  // Zero-width characters and other invisible Unicode
  return input.replace(
    /[\u200B-\u200D\u2060\u2061\u2062\u2063\u2064\uFEFF\u00AD]/g,
    ''
  );
}

/**
 * Comprehensive string sanitization.
 * Applies multiple sanitization steps for general-purpose use.
 */
export function sanitizeString(
  input: string,
  options: {
    maxLength?: number;
    stripHtml?: boolean;
    normalizeWhitespace?: boolean;
    removeInvisible?: boolean;
    removeNullBytes?: boolean;
  } = {}
): string {
  const {
    maxLength = 10000,
    stripHtml: shouldStripHtml = true,
    normalizeWhitespace: shouldNormalize = true,
    removeInvisible = true,
    removeNullBytes: shouldRemoveNull = true,
  } = options;

  let result = input;

  if (shouldRemoveNull) {
    result = removeNullBytes(result);
  }

  if (removeInvisible) {
    result = removeInvisibleChars(result);
  }

  if (shouldStripHtml) {
    result = stripHtml(result);
  }

  if (shouldNormalize) {
    result = normalizeWhitespace(result);
  }

  return result.substring(0, maxLength);
}

// ============================================================================
// Prompt Injection Prevention (for LLM inputs)
// ============================================================================

/**
 * Patterns that may indicate prompt injection attempts.
 */
const PROMPT_INJECTION_PATTERNS = [
  // System prompt manipulation
  /<system>/i,
  /<\/system>/i,
  /\[system\]/i,
  /\[\/system\]/i,

  // Instruction override attempts
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /override\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,

  // Role manipulation
  /you\s+are\s+now\s+(a|an)\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /act\s+as\s+(a|an|if)\s+/i,

  // Jailbreak patterns
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /developer\s+mode/i,
];

/**
 * Check if a string contains potential prompt injection.
 */
export function detectPromptInjection(input: string): {
  detected: boolean;
  patterns: string[];
} {
  const detectedPatterns: string[] = [];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.source);
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  };
}

/**
 * Sanitize user input for use in LLM prompts.
 * Escapes or removes potential injection patterns.
 */
export function sanitizeForPrompt(input: string, maxLength = 4000): string {
  let result = input;

  // Remove system tags
  result = result.replace(/<\/?system>/gi, '[filtered]');
  result = result.replace(/\[\/?system\]/gi, '[filtered]');

  // Escape angle brackets that might be interpreted as tags
  result = result.replace(/</g, '‹').replace(/>/g, '›');

  // Remove null bytes and control characters
  result = removeNullBytes(result);
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize whitespace
  result = normalizeWhitespace(result);

  return result.substring(0, maxLength);
}
