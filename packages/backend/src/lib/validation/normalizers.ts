/**
 * Field Normalizers
 *
 * Normalize and standardize common field types for consistent storage and comparison.
 */

import { isValidEmail, isValidPhoneE164, SafePatterns } from './safeRegex.js'

// ============================================================================
// Email Normalization
// ============================================================================

/**
 * Normalize an email address.
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes dots from Gmail local part (optional)
 * - Removes plus addressing (optional)
 *
 * @param email - Email address to normalize
 * @param options - Normalization options
 * @returns Normalized email or null if invalid
 */
export function normalizeEmail(
  email: string,
  options: {
    lowercase?: boolean;
    removeGmailDots?: boolean;
    removePlusAddressing?: boolean;
  } = {}
): string | null {
  const {
    lowercase = true,
    removeGmailDots = false,
    removePlusAddressing = false,
  } = options;

  // Basic cleanup
  let normalized = email.trim();

  if (lowercase) {
    normalized = normalized.toLowerCase();
  }

  // Validate format
  if (!isValidEmail(normalized)) {
    return null;
  }

  const [localPart, domain] = normalized.split('@');
  if (!localPart || !domain) {
    return null;
  }

  let normalizedLocal = localPart;

  // Remove plus addressing (user+tag@domain.com -> user@domain.com)
  if (removePlusAddressing && normalizedLocal.includes('+')) {
    normalizedLocal = normalizedLocal.split('+')[0];
  }

  // Remove dots from Gmail addresses (u.s.e.r@gmail.com -> user@gmail.com)
  if (removeGmailDots && (domain === 'gmail.com' || domain === 'googlemail.com')) {
    normalizedLocal = normalizedLocal.replace(/\./g, '');
  }

  return `${normalizedLocal}@${domain}`;
}

/**
 * Extract domain from email address.
 */
export function extractEmailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const parts = normalized.split('@');
  return parts[1] || null;
}

// ============================================================================
// Phone Number Normalization
// ============================================================================

/**
 * Normalize a phone number to E.164 format.
 * E.164: +[country code][subscriber number], e.g., +14155551234
 *
 * @param phone - Phone number to normalize
 * @param defaultCountryCode - Default country code if not provided (e.g., '1' for US)
 * @returns Normalized phone number or null if invalid
 */
export function normalizePhone(
  phone: string,
  defaultCountryCode?: string
): string | null {
  // Remove all non-digit characters except leading +
  let normalized = phone.trim();
  const hasPlus = normalized.startsWith('+');
  normalized = normalized.replace(/\D/g, '');

  if (!normalized) {
    return null;
  }

  // If it started with +, it should already have country code
  if (hasPlus) {
    normalized = '+' + normalized;
  } else if (defaultCountryCode) {
    // Add default country code if not present
    // Handle US numbers that might start with 1
    if (defaultCountryCode === '1' && normalized.length === 10) {
      normalized = '+1' + normalized;
    } else if (normalized.length >= 10) {
      normalized = '+' + defaultCountryCode + normalized;
    } else {
      return null;
    }
  } else {
    // No country code and no default
    return null;
  }

  // Validate E.164 format
  if (!isValidPhoneE164(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Format a phone number for display.
 *
 * @param phone - E.164 phone number
 * @param format - Display format
 * @returns Formatted phone number
 */
export function formatPhoneForDisplay(
  phone: string,
  format: 'national' | 'international' | 'e164' = 'international'
): string {
  const normalized = normalizePhone(phone, '1');
  if (!normalized) return phone;

  // Remove the + for processing
  const digits = normalized.substring(1);

  // US/Canada numbers (country code 1)
  if (digits.startsWith('1') && digits.length === 11) {
    const areaCode = digits.substring(1, 4);
    const exchange = digits.substring(4, 7);
    const subscriber = digits.substring(7);

    switch (format) {
      case 'national':
        return `(${areaCode}) ${exchange}-${subscriber}`;
      case 'international':
        return `+1 ${areaCode} ${exchange} ${subscriber}`;
      case 'e164':
      default:
        return normalized;
    }
  }

  // For other countries, just return E.164 or with spaces
  if (format === 'e164') {
    return normalized;
  }

  return normalized;
}

// ============================================================================
// ID Normalization
// ============================================================================

/**
 * Normalize a UUID.
 * - Converts to lowercase
 * - Validates format
 *
 * @param uuid - UUID to normalize
 * @returns Normalized UUID or null if invalid
 */
export function normalizeUuid(uuid: string): string | null {
  const normalized = uuid.trim().toLowerCase();

  if (!SafePatterns.uuidAny.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Normalize a slug/identifier.
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes invalid characters
 * - Collapses multiple hyphens
 *
 * @param input - String to convert to slug
 * @param maxLength - Maximum length
 * @returns Normalized slug
 */
export function normalizeSlug(input: string, maxLength = 100): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, maxLength);
}

/**
 * Normalize a username.
 * - Converts to lowercase
 * - Removes invalid characters
 * - Ensures starts with letter
 *
 * @param username - Username to normalize
 * @param maxLength - Maximum length
 * @returns Normalized username or null if invalid
 */
export function normalizeUsername(username: string, maxLength = 30): string | null {
  const normalized = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, maxLength);

  // Must start with a letter
  if (!/^[a-z]/.test(normalized)) {
    return null;
  }

  // Minimum length
  if (normalized.length < 3) {
    return null;
  }

  return normalized;
}

// ============================================================================
// Name Normalization
// ============================================================================

/**
 * Normalize a person's name.
 * - Trims whitespace
 * - Capitalizes first letter of each word
 * - Handles common prefixes (Mc, Mac, O', etc.)
 *
 * @param name - Name to normalize
 * @returns Normalized name
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';

      // Handle prefixes like Mc, Mac, O'
      if (word.startsWith("o'") && word.length > 2) {
        return "O'" + word.charAt(2).toUpperCase() + word.slice(3);
      }
      if (word.startsWith('mc') && word.length > 2) {
        return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3);
      }
      if (word.startsWith('mac') && word.length > 3) {
        return 'Mac' + word.charAt(3).toUpperCase() + word.slice(4);
      }

      // Standard capitalization
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Normalize a company name.
 * - Trims whitespace
 * - Normalizes common suffixes (Inc, LLC, Ltd, etc.)
 *
 * @param name - Company name to normalize
 * @returns Normalized company name
 */
export function normalizeCompanyName(name: string): string {
  let normalized = name.trim();

  // Normalize common suffixes
  const suffixMap: Record<string, string> = {
    'inc.': 'Inc.',
    'inc': 'Inc.',
    'incorporated': 'Inc.',
    'llc': 'LLC',
    'l.l.c.': 'LLC',
    'ltd': 'Ltd.',
    'ltd.': 'Ltd.',
    'limited': 'Ltd.',
    'corp': 'Corp.',
    'corp.': 'Corp.',
    'corporation': 'Corp.',
    'co': 'Co.',
    'co.': 'Co.',
    'company': 'Co.',
  };

  // Check for suffix at end
  const words = normalized.split(/\s+/);
  const lastWord = words[words.length - 1]?.toLowerCase();

  if (lastWord && suffixMap[lastWord]) {
    words[words.length - 1] = suffixMap[lastWord];
    normalized = words.join(' ');
  }

  return normalized;
}

// ============================================================================
// Currency/Number Normalization
// ============================================================================

/**
 * Normalize a currency amount string to a number.
 * Handles various formats: $1,234.56, 1.234,56, etc.
 *
 * @param amount - Currency string to normalize
 * @param locale - Locale for parsing (default: 'en-US')
 * @returns Normalized number or null if invalid
 */
export function normalizeCurrencyAmount(
  amount: string,
  locale: 'en-US' | 'de-DE' | 'fr-FR' = 'en-US'
): number | null {
  // Remove currency symbols and whitespace
  let normalized = amount.replace(/[^\d.,\-]/g, '').trim();

  if (!normalized) {
    return null;
  }

  // Handle different decimal separators
  if (locale === 'de-DE' || locale === 'fr-FR') {
    // European format: 1.234,56 -> 1234.56
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,234.56 -> 1234.56
    normalized = normalized.replace(/,/g, '');
  }

  const parsed = parseFloat(normalized);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  // Round to 2 decimal places for currency
  return Math.round(parsed * 100) / 100;
}

/**
 * Normalize a percentage string to a decimal.
 * "50%" -> 0.5, "50" -> 0.5
 *
 * @param percentage - Percentage string
 * @param asDecimal - Return as decimal (0.5) or percentage (50)
 * @returns Normalized number or null if invalid
 */
export function normalizePercentage(
  percentage: string,
  asDecimal = true
): number | null {
  // Remove % sign and whitespace
  const normalized = percentage.replace(/%/g, '').trim();

  const parsed = parseFloat(normalized);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  // Clamp to valid percentage range
  const clamped = Math.max(0, Math.min(100, parsed));

  return asDecimal ? clamped / 100 : clamped;
}

// ============================================================================
// URL Normalization
// ============================================================================

/**
 * Normalize a URL.
 * - Adds https:// if no protocol
 * - Removes trailing slash
 * - Lowercases domain
 *
 * @param url - URL to normalize
 * @returns Normalized URL or null if invalid
 */
export function normalizeUrl(url: string): string | null {
  let normalized = url.trim();

  // Add protocol if missing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  try {
    const parsed = new URL(normalized);

    // Lowercase the hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
      parsed.port = '';
    }

    // Remove trailing slash from path (unless it's just /)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extract domain from URL.
 */
export function extractDomain(url: string): string | null {
  try {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;

    const parsed = new URL(normalized);
    return parsed.hostname;
  } catch {
    return null;
  }
}
