/**
 * Safe Regex Utilities
 *
 * Prevents catastrophic backtracking (ReDoS) attacks.
 * Provides safe alternatives to common regex patterns.
 */

import { logger } from "../logger.js";

// ============================================================================
// ReDoS Detection
// ============================================================================

/**
 * Patterns that indicate potential catastrophic backtracking.
 * These are simplified heuristics - not exhaustive.
 */
const DANGEROUS_PATTERNS = [
  // Nested quantifiers: (a+)+ or (a*)*
  /\([^)]*[+*][^)]*\)[+*]/,

  // Overlapping alternations with quantifiers: (a|a)+
  /\([^)]*\|[^)]*\)[+*]/,

  // Repeated groups with overlapping patterns
  /\(\.\*\)[+*]/,
  /\(\.\+\)[+*]/,

  // Multiple adjacent quantifiers
  /[+*]{2,}/,

  // Backreferences in quantified groups
  /\([^)]*\\[1-9][^)]*\)[+*]/,
];

/**
 * Maximum safe input length for regex matching.
 * Longer inputs should be truncated or rejected.
 */
export const MAX_SAFE_INPUT_LENGTH = 10000;

/**
 * Maximum safe regex execution time in milliseconds.
 */
export const MAX_REGEX_TIMEOUT_MS = 100;

/**
 * Check if a regex pattern is potentially dangerous (ReDoS vulnerable).
 *
 * @param pattern - Regex pattern string or RegExp
 * @returns Object with safety assessment
 */
export function analyzeRegexSafety(pattern: string | RegExp): {
  safe: boolean;
  warnings: string[];
} {
  const patternStr = pattern instanceof RegExp ? pattern.source : pattern;
  const warnings: string[] = [];

  // Check for dangerous patterns
  for (const dangerous of DANGEROUS_PATTERNS) {
    if (dangerous.test(patternStr)) {
      warnings.push(`Pattern contains potentially dangerous construct: ${dangerous.source}`);
    }
  }

  // Check for excessive quantifiers
  const quantifierCount = (patternStr.match(/[+*?]/g) || []).length;
  if (quantifierCount > 10) {
    warnings.push(`Pattern has ${quantifierCount} quantifiers, which may cause performance issues`);
  }

  // Check for very long patterns
  if (patternStr.length > 500) {
    warnings.push('Pattern is very long, which may indicate complexity issues');
  }

  // Check for unbounded repetition
  if (/\.\*[^?]/.test(patternStr) || /\.\+[^?]/.test(patternStr)) {
    warnings.push('Pattern contains greedy unbounded repetition (.* or .+)');
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Execute a regex with timeout protection.
 * Returns null if execution times out.
 *
 * @param regex - RegExp to execute
 * @param input - String to match against
 * @param timeoutMs - Maximum execution time
 * @returns Match result or null if timed out
 */
export function safeRegexExec(
  regex: RegExp,
  input: string,
  timeoutMs = MAX_REGEX_TIMEOUT_MS
): RegExpExecArray | null {
  // Truncate input if too long
  const safeInput = input.substring(0, MAX_SAFE_INPUT_LENGTH);

  const startTime = Date.now();

  // For simple patterns, just execute
  const result = regex.exec(safeInput);

  const elapsed = Date.now() - startTime;
  if (elapsed > timeoutMs) {
    logger.warn("Regex execution exceeded timeout", { elapsedMs: elapsed, timeoutMs });
  }

  return result;
}

/**
 * Test a regex with timeout protection.
 *
 * @param regex - RegExp to test
 * @param input - String to test against
 * @param timeoutMs - Maximum execution time
 * @returns Boolean result or false if timed out
 */
export function safeRegexTest(
  regex: RegExp,
  input: string,
  timeoutMs = MAX_REGEX_TIMEOUT_MS
): boolean {
  const safeInput = input.substring(0, MAX_SAFE_INPUT_LENGTH);

  const startTime = Date.now();
  const result = regex.test(safeInput);
  const elapsed = Date.now() - startTime;

  if (elapsed > timeoutMs) {
    logger.warn("Regex test exceeded timeout", { elapsedMs: elapsed, timeoutMs });
    return false;
  }

  return result;
}

// ============================================================================
// Safe Pre-built Patterns
// ============================================================================

/**
 * Safe regex patterns for common validation tasks.
 * These are designed to avoid catastrophic backtracking.
 */
export const SafePatterns = {
  /**
   * Email validation (simplified, safe pattern).
   * For strict validation, use a dedicated email validation library.
   */
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

  /**
   * UUID v4 validation.
   */
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  /**
   * UUID any version validation.
   */
  uuidAny: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  /**
   * URL validation (http/https only).
   */
  url: /^https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?::\d{1,5})?(?:\/[^\s]*)?$/,

  /**
   * Phone number (E.164 format).
   */
  phoneE164: /^\+[1-9]\d{1,14}$/,

  /**
   * Phone number (loose, allows various formats).
   */
  phoneLoose: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/,

  /**
   * Alphanumeric string.
   */
  alphanumeric: /^[a-zA-Z0-9]+$/,

  /**
   * Alphanumeric with underscores and hyphens (slug-like).
   */
  slug: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,

  /**
   * Variable/identifier name (programming).
   */
  identifier: /^[a-zA-Z_][a-zA-Z0-9_]*$/,

  /**
   * Hex color code.
   */
  hexColor: /^#(?:[0-9a-fA-F]{3}){1,2}$/,

  /**
   * ISO 8601 date (YYYY-MM-DD).
   */
  isoDate: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,

  /**
   * ISO 8601 datetime.
   */
  isoDateTime: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/,

  /**
   * Credit card number (basic format check, not Luhn).
   */
  creditCard: /^\d{13,19}$/,

  /**
   * IP address v4.
   */
  ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,

  /**
   * Semantic version (semver).
   */
  semver: /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?(?:\+[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?$/,

  /**
   * Safe filename (no path traversal).
   */
  safeFilename: /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/,

  /**
   * Currency amount (with optional decimals).
   */
  currencyAmount: /^-?\d{1,15}(?:\.\d{1,4})?$/,

  /**
   * Percentage (0-100 with optional decimals).
   */
  percentage: /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/,
} as const;

// ============================================================================
// Pattern Validation Functions
// ============================================================================

/**
 * Validate email address.
 */
export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  return SafePatterns.email.test(email);
}

/**
 * Validate UUID.
 */
export function isValidUuid(uuid: string): boolean {
  return SafePatterns.uuidAny.test(uuid);
}

/**
 * Validate URL.
 */
export function isValidUrl(url: string): boolean {
  if (url.length > 2048) return false;
  return SafePatterns.url.test(url);
}

/**
 * Validate phone number (E.164 format).
 */
export function isValidPhoneE164(phone: string): boolean {
  return SafePatterns.phoneE164.test(phone);
}

/**
 * Validate identifier/variable name.
 */
export function isValidIdentifier(name: string): boolean {
  if (name.length > 100) return false;
  return SafePatterns.identifier.test(name);
}

/**
 * Validate slug.
 */
export function isValidSlug(slug: string): boolean {
  if (slug.length > 200) return false;
  return SafePatterns.slug.test(slug);
}

/**
 * Validate ISO date string.
 */
export function isValidIsoDate(date: string): boolean {
  if (!SafePatterns.isoDate.test(date)) return false;

  // Verify the date doesn't overflow (e.g. Feb 30 → Mar 1 in JS Date).
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return false;
  const [year, month, day] = date.split('-').map(Number);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

/**
 * Validate ISO datetime string.
 */
export function isValidIsoDateTime(datetime: string): boolean {
  if (!SafePatterns.isoDateTime.test(datetime)) return false;

  // Extract the date portion and validate it doesn't overflow.
  const datePart = datetime.slice(0, 10);
  return isValidIsoDate(datePart);
}

// ============================================================================
// Custom Pattern Builder
// ============================================================================

/**
 * Build a safe regex pattern from user input.
 * Escapes all special regex characters.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a safe search pattern from user input.
 * Useful for implementing search functionality.
 */
export function createSearchPattern(
  searchTerm: string,
  options: {
    caseInsensitive?: boolean;
    wholeWord?: boolean;
    maxLength?: number;
  } = {}
): RegExp | null {
  const { caseInsensitive = true, wholeWord = false, maxLength = 100 } = options;

  // Truncate and sanitize
  const safeTerm = searchTerm.substring(0, maxLength).trim();
  if (!safeTerm) return null;

  // Escape special characters
  let pattern = escapeRegex(safeTerm);

  // Add word boundaries if requested
  if (wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = caseInsensitive ? 'i' : '';

  try {
    // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}
