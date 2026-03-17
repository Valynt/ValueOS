/**
 * Safe Regex Utilities Tests
 */

import { describe, expect, it } from 'vitest';

import {
  analyzeRegexSafety,
  createSearchPattern,
  escapeRegex,
  isValidEmail,
  isValidIdentifier,
  isValidIsoDate,
  isValidIsoDateTime,
  isValidPhoneE164,
  isValidSlug,
  isValidUrl,
  isValidUuid,
  SafePatterns,
  safeRegexTest,
} from '../safeRegex';

describe('Safe Regex Utilities', () => {
  // ============================================================================
  // ReDoS Detection
  // ============================================================================

  describe('analyzeRegexSafety', () => {
    it('detects nested quantifiers (a+)+', () => {
      const result = analyzeRegexSafety(/(a+)+$/);
      expect(result.safe).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('detects nested quantifiers (a*)*', () => {
      const result = analyzeRegexSafety(/(a*)*$/);
      expect(result.safe).toBe(false);
    });

    it('detects overlapping alternations (a|a)+', () => {
      const result = analyzeRegexSafety(/(a|a)+$/);
      expect(result.safe).toBe(false);
    });

    it('detects (.*)+', () => {
      const result = analyzeRegexSafety(/(.*)+$/);
      expect(result.safe).toBe(false);
    });

    it('allows simple patterns', () => {
      expect(analyzeRegexSafety(/^[a-z]+$/).safe).toBe(true);
      expect(analyzeRegexSafety(/^\d{4}-\d{2}-\d{2}$/).safe).toBe(true);
      expect(analyzeRegexSafety(/^[a-zA-Z0-9_]+$/).safe).toBe(true);
    });

    it('warns about greedy unbounded repetition', () => {
      const result = analyzeRegexSafety(/.*test/);
      expect(result.warnings.some(w => w.includes('greedy'))).toBe(true);
    });

    it('warns about excessive quantifiers', () => {
      const result = analyzeRegexSafety(/a+b+c+d+e+f+g+h+i+j+k+l+/);
      expect(result.warnings.some(w => w.includes('quantifiers'))).toBe(true);
    });

    it('warns about very long patterns', () => {
      const longPattern = 'a'.repeat(600);
      // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
      const result = analyzeRegexSafety(new RegExp(longPattern));
      expect(result.warnings.some(w => w.includes('long'))).toBe(true);
    });
  });

  describe('safeRegexTest', () => {
    it('returns true for matching input', () => {
      expect(safeRegexTest(/^test$/, 'test')).toBe(true);
    });

    it('returns false for non-matching input', () => {
      expect(safeRegexTest(/^test$/, 'other')).toBe(false);
    });

    it('truncates very long input', () => {
      const longInput = 'a'.repeat(20000);
      // Should not hang, just test with truncated input
      const result = safeRegexTest(/^a+$/, longInput);
      expect(typeof result).toBe('boolean');
    });
  });

  // ============================================================================
  // Safe Patterns
  // ============================================================================

  describe('SafePatterns', () => {
    it('all patterns are safe', () => {
      for (const [name, pattern] of Object.entries(SafePatterns)) {
        const result = analyzeRegexSafety(pattern);
        expect(result.safe).toBe(true);
      }
    });

    describe('email pattern', () => {
      it('matches valid emails', () => {
        expect(SafePatterns.email.test('test@example.com')).toBe(true);
        expect(SafePatterns.email.test('user.name@domain.co.uk')).toBe(true);
        expect(SafePatterns.email.test('user+tag@example.com')).toBe(true);
      });

      it('rejects invalid emails', () => {
        expect(SafePatterns.email.test('not-an-email')).toBe(false);
        expect(SafePatterns.email.test('@example.com')).toBe(false);
        expect(SafePatterns.email.test('test@')).toBe(false);
      });
    });

    describe('uuid pattern', () => {
      it('matches valid UUIDs', () => {
        expect(SafePatterns.uuid.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(SafePatterns.uuidAny.test('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
      });

      it('rejects invalid UUIDs', () => {
        expect(SafePatterns.uuid.test('not-a-uuid')).toBe(false);
        expect(SafePatterns.uuid.test('550e8400-e29b-61d4-a716-446655440000')).toBe(false);
      });
    });

    describe('url pattern', () => {
      it('matches valid URLs', () => {
        expect(SafePatterns.url.test('https://example.com')).toBe(true);
        expect(SafePatterns.url.test('http://sub.domain.com/path')).toBe(true);
        expect(SafePatterns.url.test('https://example.com:8080/path?query=1')).toBe(true);
      });

      it('rejects invalid URLs', () => {
        expect(SafePatterns.url.test('not-a-url')).toBe(false);
        expect(SafePatterns.url.test('ftp://example.com')).toBe(false);
      });
    });

    describe('phone patterns', () => {
      it('matches E.164 format', () => {
        expect(SafePatterns.phoneE164.test('+14155551234')).toBe(true);
        expect(SafePatterns.phoneE164.test('+442071234567')).toBe(true);
      });

      it('rejects invalid E.164', () => {
        expect(SafePatterns.phoneE164.test('4155551234')).toBe(false);
        expect(SafePatterns.phoneE164.test('+0123456789')).toBe(false);
      });
    });

    describe('identifier pattern', () => {
      it('matches valid identifiers', () => {
        expect(SafePatterns.identifier.test('myVar')).toBe(true);
        expect(SafePatterns.identifier.test('_private')).toBe(true);
        expect(SafePatterns.identifier.test('camelCase123')).toBe(true);
      });

      it('rejects invalid identifiers', () => {
        expect(SafePatterns.identifier.test('123start')).toBe(false);
        expect(SafePatterns.identifier.test('has-dash')).toBe(false);
        expect(SafePatterns.identifier.test('has space')).toBe(false);
      });
    });

    describe('isoDate pattern', () => {
      it('matches valid dates', () => {
        expect(SafePatterns.isoDate.test('2024-01-15')).toBe(true);
        expect(SafePatterns.isoDate.test('2024-12-31')).toBe(true);
      });

      it('rejects invalid dates', () => {
        expect(SafePatterns.isoDate.test('2024-13-01')).toBe(false);
        expect(SafePatterns.isoDate.test('2024-00-15')).toBe(false);
        expect(SafePatterns.isoDate.test('24-01-15')).toBe(false);
      });
    });

    describe('isoDateTime pattern', () => {
      it('matches valid datetimes', () => {
        expect(SafePatterns.isoDateTime.test('2024-01-15T10:30:00Z')).toBe(true);
        expect(SafePatterns.isoDateTime.test('2024-01-15T10:30:00.123Z')).toBe(true);
        expect(SafePatterns.isoDateTime.test('2024-01-15T10:30:00+05:30')).toBe(true);
      });

      it('rejects invalid datetimes', () => {
        expect(SafePatterns.isoDateTime.test('2024-01-15')).toBe(false);
        expect(SafePatterns.isoDateTime.test('2024-01-15T25:00:00Z')).toBe(false);
      });
    });
  });

  // ============================================================================
  // Validation Functions
  // ============================================================================

  describe('isValidEmail', () => {
    it('validates correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('rejects emails over 254 chars', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });
  });

  describe('isValidUuid', () => {
    it('validates correct UUIDs', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('validates correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('rejects URLs over 2048 chars', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2050);
      expect(isValidUrl(longUrl)).toBe(false);
    });
  });

  describe('isValidPhoneE164', () => {
    it('validates E.164 phones', () => {
      expect(isValidPhoneE164('+14155551234')).toBe(true);
    });

    it('rejects non-E.164 phones', () => {
      expect(isValidPhoneE164('(415) 555-1234')).toBe(false);
    });
  });

  describe('isValidIdentifier', () => {
    it('validates identifiers', () => {
      expect(isValidIdentifier('myVar')).toBe(true);
    });

    it('rejects identifiers over 100 chars', () => {
      expect(isValidIdentifier('a'.repeat(101))).toBe(false);
    });
  });

  describe('isValidSlug', () => {
    it('validates slugs', () => {
      expect(isValidSlug('my-slug-123')).toBe(true);
    });

    it('rejects slugs over 200 chars', () => {
      expect(isValidSlug('a'.repeat(201))).toBe(false);
    });
  });

  describe('isValidIsoDate', () => {
    it('validates real dates', () => {
      expect(isValidIsoDate('2024-01-15')).toBe(true);
    });

    it('rejects invalid dates like Feb 30', () => {
      expect(isValidIsoDate('2024-02-30')).toBe(false);
    });
  });

  describe('isValidIsoDateTime', () => {
    it('validates real datetimes', () => {
      expect(isValidIsoDateTime('2024-01-15T10:30:00Z')).toBe(true);
    });

    it('rejects invalid datetimes', () => {
      expect(isValidIsoDateTime('2024-02-30T10:30:00Z')).toBe(false);
    });
  });

  // ============================================================================
  // Pattern Building
  // ============================================================================

  describe('escapeRegex', () => {
    it('escapes special characters', () => {
      expect(escapeRegex('test.value')).toBe('test\\.value');
      expect(escapeRegex('a+b*c?')).toBe('a\\+b\\*c\\?');
      expect(escapeRegex('[test]')).toBe('\\[test\\]');
      expect(escapeRegex('(group)')).toBe('\\(group\\)');
    });
  });

  describe('createSearchPattern', () => {
    it('creates case-insensitive pattern by default', () => {
      const pattern = createSearchPattern('Test');
      expect(pattern?.test('test')).toBe(true);
      expect(pattern?.test('TEST')).toBe(true);
    });

    it('escapes special characters in search term', () => {
      const pattern = createSearchPattern('test.value');
      expect(pattern?.test('test.value')).toBe(true);
      expect(pattern?.test('testXvalue')).toBe(false);
    });

    it('supports whole word matching', () => {
      const pattern = createSearchPattern('test', { wholeWord: true });
      expect(pattern?.test('test')).toBe(true);
      expect(pattern?.test('testing')).toBe(false);
    });

    it('truncates long search terms', () => {
      const pattern = createSearchPattern('a'.repeat(200), { maxLength: 50 });
      expect(pattern).not.toBeNull();
    });

    it('returns null for empty search', () => {
      expect(createSearchPattern('')).toBeNull();
      expect(createSearchPattern('   ')).toBeNull();
    });
  });
});
