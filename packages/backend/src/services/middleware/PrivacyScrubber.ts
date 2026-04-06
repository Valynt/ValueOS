/**
 * Privacy Scrubber
 *
 * Regex-based + field-name blocklist PII/credential masking.
 * Applied to reasoning chain content before WebSocket broadcast.
 */

// ============================================================================
// Pattern definitions
// ============================================================================

interface ScrubPattern {
  regex: RegExp;
  replacement: string;
}

const DEFAULT_PATTERNS: ScrubPattern[] = [
  // Order matters: more specific patterns first to avoid partial matches.

  // JWT tokens (three base64url segments separated by dots, each segment ≥ 10 chars)
  {
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replacement: '[JWT]',
  },
  // Bearer tokens in text
  {
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    replacement: 'Bearer [API_KEY]',
  },
  // API keys / tokens: common prefixes (must run before phone/card to avoid partial matches)
  {
    regex: /\b(sk-[a-zA-Z0-9]{20,}|pk_[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36,}|xox[bp]-[a-zA-Z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/g,
    replacement: '[API_KEY]',
  },
  // Email addresses
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
  },
  // SSN (000-00-0000)
  {
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
  },
  // Credit card numbers (13-19 digits, optionally separated by spaces/dashes)
  {
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: '[CARD]',
  },
  // IP addresses (IPv4)
  {
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    replacement: '[IP]',
  },
  // Phone numbers: US formats and international with + prefix
  {
    regex: /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE]',
  },
];

// ============================================================================
// Field-name blocklist
// ============================================================================

const DEFAULT_FIELD_BLOCKLIST = new Set([
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'credential',
  'ssn',
  'credit_card',
  'private_key',
]);

// ============================================================================
// PrivacyScrubber
// ============================================================================

export interface PrivacyScrubberConfig {
  /** Additional regex patterns to apply. */
  extraPatterns?: ScrubPattern[];
  /** Additional field names to blocklist (case-insensitive). */
  extraBlocklistFields?: string[];
}

export class PrivacyScrubber {
  private readonly patterns: ScrubPattern[];
  private readonly fieldBlocklist: Set<string>;

  constructor(config: PrivacyScrubberConfig = {}) {
    this.patterns = [...DEFAULT_PATTERNS, ...(config.extraPatterns ?? [])];
    this.fieldBlocklist = new Set([
      ...DEFAULT_FIELD_BLOCKLIST,
      ...(config.extraBlocklistFields ?? []).map((f) => f.toLowerCase()),
    ]);
  }

  /**
   * Scrub PII/credentials from a plain string.
   */
  scrubText(text: string): string {
    let result = text;
    for (const pattern of this.patterns) {
      // Reset lastIndex for global regexes
      pattern.regex.lastIndex = 0;
      result = result.replace(pattern.regex, pattern.replacement);
    }
    return result;
  }

  /**
   * Recursively scrub an arbitrary value (string, object, array).
   * - Strings are pattern-matched.
   * - Object keys matching the blocklist have their values replaced with `[REDACTED]`.
   * - All other string values in objects/arrays are pattern-matched.
   */
  scrub(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.scrubText(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.scrub(item));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (this.fieldBlocklist.has(key.toLowerCase())) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.scrub(val);
        }
      }
      return result;
    }

    // numbers, booleans, null, undefined — pass through
    return value;
  }
}
