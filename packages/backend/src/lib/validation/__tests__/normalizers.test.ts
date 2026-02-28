/**
 * Normalizer Utilities Tests
 */

import { describe, expect, it } from 'vitest';

import {
  extractDomain,
  extractEmailDomain,
  formatPhoneForDisplay,
  normalizeCompanyName,
  normalizeCurrencyAmount,
  normalizeEmail,
  normalizeName,
  normalizePercentage,
  normalizePhone,
  normalizeSlug,
  normalizeUrl,
  normalizeUsername,
  normalizeUuid,
} from '../normalizers';

describe('Normalizer Utilities', () => {
  // ============================================================================
  // Email Normalization
  // ============================================================================

  describe('normalizeEmail', () => {
    it('lowercases email', () => {
      expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
    });

    it('trims whitespace', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('returns null for invalid email', () => {
      expect(normalizeEmail('not-an-email')).toBeNull();
      expect(normalizeEmail('@example.com')).toBeNull();
      expect(normalizeEmail('test@')).toBeNull();
    });

    it('removes plus addressing when enabled', () => {
      expect(normalizeEmail('user+tag@example.com', { removePlusAddressing: true }))
        .toBe('user@example.com');
    });

    it('preserves plus addressing by default', () => {
      expect(normalizeEmail('user+tag@example.com'))
        .toBe('user+tag@example.com');
    });

    it('removes Gmail dots when enabled', () => {
      expect(normalizeEmail('u.s.e.r@gmail.com', { removeGmailDots: true }))
        .toBe('user@gmail.com');
    });

    it('preserves dots for non-Gmail', () => {
      expect(normalizeEmail('u.s.e.r@example.com', { removeGmailDots: true }))
        .toBe('u.s.e.r@example.com');
    });
  });

  describe('extractEmailDomain', () => {
    it('extracts domain from email', () => {
      expect(extractEmailDomain('test@example.com')).toBe('example.com');
    });

    it('returns null for invalid email', () => {
      expect(extractEmailDomain('not-an-email')).toBeNull();
    });
  });

  // ============================================================================
  // Phone Normalization
  // ============================================================================

  describe('normalizePhone', () => {
    it('normalizes US phone with default country code', () => {
      expect(normalizePhone('(415) 555-1234', '1')).toBe('+14155551234');
    });

    it('normalizes phone with dashes', () => {
      expect(normalizePhone('415-555-1234', '1')).toBe('+14155551234');
    });

    it('normalizes phone with dots', () => {
      expect(normalizePhone('415.555.1234', '1')).toBe('+14155551234');
    });

    it('preserves existing E.164 format', () => {
      expect(normalizePhone('+14155551234')).toBe('+14155551234');
    });

    it('returns null for invalid phone', () => {
      expect(normalizePhone('123', '1')).toBeNull();
      expect(normalizePhone('', '1')).toBeNull();
    });

    it('returns null without country code for non-E.164', () => {
      expect(normalizePhone('4155551234')).toBeNull();
    });
  });

  describe('formatPhoneForDisplay', () => {
    it('formats US phone as national', () => {
      expect(formatPhoneForDisplay('+14155551234', 'national'))
        .toBe('(415) 555-1234');
    });

    it('formats US phone as international', () => {
      expect(formatPhoneForDisplay('+14155551234', 'international'))
        .toBe('+1 415 555 1234');
    });

    it('returns E.164 format', () => {
      expect(formatPhoneForDisplay('+14155551234', 'e164'))
        .toBe('+14155551234');
    });
  });

  // ============================================================================
  // ID Normalization
  // ============================================================================

  describe('normalizeUuid', () => {
    it('lowercases UUID', () => {
      expect(normalizeUuid('550E8400-E29B-41D4-A716-446655440000'))
        .toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('trims whitespace', () => {
      expect(normalizeUuid('  550e8400-e29b-41d4-a716-446655440000  '))
        .toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('returns null for invalid UUID', () => {
      expect(normalizeUuid('not-a-uuid')).toBeNull();
    });
  });

  describe('normalizeSlug', () => {
    it('lowercases and replaces spaces', () => {
      expect(normalizeSlug('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(normalizeSlug('Test@#$%Slug!')).toBe('testslug');
    });

    it('collapses multiple hyphens', () => {
      expect(normalizeSlug('test---slug')).toBe('test-slug');
    });

    it('removes leading/trailing hyphens', () => {
      expect(normalizeSlug('-test-slug-')).toBe('test-slug');
    });

    it('respects max length', () => {
      expect(normalizeSlug('a'.repeat(200), 50).length).toBe(50);
    });
  });

  describe('normalizeUsername', () => {
    it('lowercases username', () => {
      expect(normalizeUsername('JohnDoe')).toBe('johndoe');
    });

    it('removes invalid characters', () => {
      expect(normalizeUsername('john.doe@123')).toBe('johndoe123');
    });

    it('returns null if starts with number', () => {
      expect(normalizeUsername('123john')).toBeNull();
    });

    it('returns null if too short', () => {
      expect(normalizeUsername('ab')).toBeNull();
    });

    it('respects max length', () => {
      expect(normalizeUsername('a'.repeat(50), 20)?.length).toBe(20);
    });
  });

  // ============================================================================
  // Name Normalization
  // ============================================================================

  describe('normalizeName', () => {
    it('capitalizes first letter of each word', () => {
      expect(normalizeName('john doe')).toBe('John Doe');
    });

    it('handles all caps', () => {
      expect(normalizeName('JOHN DOE')).toBe('John Doe');
    });

    it('handles Mc prefix', () => {
      expect(normalizeName('mcdonald')).toBe('McDonald');
    });

    it('handles Mac prefix', () => {
      expect(normalizeName('macdonald')).toBe('MacDonald');
    });

    it("handles O' prefix", () => {
      expect(normalizeName("o'brien")).toBe("O'Brien");
    });

    it('trims whitespace', () => {
      expect(normalizeName('  john  ')).toBe('John');
    });
  });

  describe('normalizeCompanyName', () => {
    it('normalizes Inc suffix', () => {
      expect(normalizeCompanyName('Acme inc')).toBe('Acme Inc.');
      expect(normalizeCompanyName('Acme incorporated')).toBe('Acme Inc.');
    });

    it('normalizes LLC suffix', () => {
      expect(normalizeCompanyName('Acme llc')).toBe('Acme LLC');
      expect(normalizeCompanyName('Acme l.l.c.')).toBe('Acme LLC');
    });

    it('normalizes Ltd suffix', () => {
      expect(normalizeCompanyName('Acme ltd')).toBe('Acme Ltd.');
      expect(normalizeCompanyName('Acme limited')).toBe('Acme Ltd.');
    });

    it('normalizes Corp suffix', () => {
      expect(normalizeCompanyName('Acme corp')).toBe('Acme Corp.');
      expect(normalizeCompanyName('Acme corporation')).toBe('Acme Corp.');
    });

    it('preserves names without suffix', () => {
      expect(normalizeCompanyName('Acme')).toBe('Acme');
    });
  });

  // ============================================================================
  // Currency/Number Normalization
  // ============================================================================

  describe('normalizeCurrencyAmount', () => {
    it('parses US format', () => {
      expect(normalizeCurrencyAmount('$1,234.56')).toBe(1234.56);
    });

    it('parses European format', () => {
      expect(normalizeCurrencyAmount('1.234,56', 'de-DE')).toBe(1234.56);
    });

    it('handles negative amounts', () => {
      expect(normalizeCurrencyAmount('-$100.00')).toBe(-100);
    });

    it('rounds to 2 decimal places', () => {
      expect(normalizeCurrencyAmount('100.999')).toBe(101);
    });

    it('returns null for invalid input', () => {
      expect(normalizeCurrencyAmount('not a number')).toBeNull();
      expect(normalizeCurrencyAmount('')).toBeNull();
    });
  });

  describe('normalizePercentage', () => {
    it('parses percentage with symbol', () => {
      expect(normalizePercentage('50%')).toBe(0.5);
    });

    it('parses percentage without symbol', () => {
      expect(normalizePercentage('50')).toBe(0.5);
    });

    it('returns as percentage when requested', () => {
      expect(normalizePercentage('50%', false)).toBe(50);
    });

    it('clamps to 0-100 range', () => {
      expect(normalizePercentage('150%')).toBe(1);
      expect(normalizePercentage('-10%')).toBe(0);
    });

    it('returns null for invalid input', () => {
      expect(normalizePercentage('not a number')).toBeNull();
    });
  });

  // ============================================================================
  // URL Normalization
  // ============================================================================

  describe('normalizeUrl', () => {
    it('adds https:// if missing', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com/');
    });

    it('lowercases hostname', () => {
      expect(normalizeUrl('https://EXAMPLE.COM')).toBe('https://example.com/');
    });

    it('removes default ports', () => {
      expect(normalizeUrl('https://example.com:443')).toBe('https://example.com/');
      expect(normalizeUrl('http://example.com:80')).toBe('http://example.com/');
    });

    it('preserves non-default ports', () => {
      expect(normalizeUrl('https://example.com:8080')).toBe('https://example.com:8080/');
    });

    it('removes trailing slash from path', () => {
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('preserves root path slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('returns null for invalid URL', () => {
      expect(normalizeUrl('not a url')).toBeNull();
    });
  });

  describe('extractDomain', () => {
    it('extracts domain from URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
    });

    it('returns null for invalid URL', () => {
      expect(extractDomain('not a url')).toBeNull();
    });
  });
});
