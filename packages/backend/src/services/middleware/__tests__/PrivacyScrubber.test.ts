import { describe, expect, it } from 'vitest';

import { PrivacyScrubber } from '../PrivacyScrubber.js';

describe('PrivacyScrubber', () => {
  const scrubber = new PrivacyScrubber();

  describe('scrubText', () => {
    it('masks email addresses', () => {
      expect(scrubber.scrubText('Contact john.doe@example.com for info')).toBe(
        'Contact [EMAIL] for info'
      );
    });

    it('masks multiple emails', () => {
      const result = scrubber.scrubText('a@b.com and c@d.org');
      expect(result).toBe('[EMAIL] and [EMAIL]');
    });

    it('masks SSN patterns', () => {
      expect(scrubber.scrubText('SSN: 123-45-6789')).toBe('SSN: [SSN]');
    });

    it('masks API keys with sk- prefix', () => {
      expect(scrubber.scrubText('key: sk-abc123def456ghi789jkl012')).toBe(
        'key: [API_KEY]'
      );
    });

    it('masks GitHub personal access tokens', () => {
      expect(
        scrubber.scrubText('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')
      ).toBe('token: [API_KEY]');
    });

    it('masks Bearer tokens', () => {
      expect(scrubber.scrubText('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test.sig')).toBe(
        'Authorization: Bearer [API_KEY]'
      );
    });

    it('masks JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = scrubber.scrubText(`Token: ${jwt}`);
      expect(result).toContain('[JWT]');
      expect(result).not.toContain('eyJhbGci');
    });

    it('masks IPv4 addresses', () => {
      expect(scrubber.scrubText('Server at 192.168.1.100')).toBe(
        'Server at [IP]'
      );
    });

    it('masks US phone numbers', () => {
      expect(scrubber.scrubText('Call (555) 123-4567')).toBe('Call [PHONE]');
    });

    it('masks international phone numbers', () => {
      expect(scrubber.scrubText('Call +1-555-123-4567')).toBe('Call [PHONE]');
    });

    it('does not alter clean text', () => {
      const clean = 'This is a normal business query about ROI analysis.';
      expect(scrubber.scrubText(clean)).toBe(clean);
    });

    it('masks Slack bot tokens', () => {
      expect(
        scrubber.scrubText('xoxb-123456789012-1234567890123-abcdefghijklmnopqrstuvwx')
      ).toContain('[API_KEY]');
    });

    it('masks AWS access key IDs', () => {
      expect(scrubber.scrubText('AKIAIOSFODNN7EXAMPLE')).toBe('[API_KEY]');
    });
  });

  describe('scrub (recursive)', () => {
    it('scrubs strings', () => {
      expect(scrubber.scrub('email: test@test.com')).toBe('email: [EMAIL]');
    });

    it('scrubs arrays', () => {
      const result = scrubber.scrub(['test@test.com', 'clean text']);
      expect(result).toEqual(['[EMAIL]', 'clean text']);
    });

    it('redacts blocklisted field names', () => {
      const result = scrubber.scrub({
        username: 'john',
        password: 'secret123',
        token: 'abc',
        apiKey: 'xyz',
        data: 'safe',
      });
      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        data: 'safe',
      });
    });

    it('scrubs nested objects', () => {
      const result = scrubber.scrub({
        user: {
          email: 'test@test.com',
          secret: 'hidden',
        },
      });
      expect(result).toEqual({
        user: {
          email: '[EMAIL]',
          secret: '[REDACTED]',
        },
      });
    });

    it('passes through numbers and booleans', () => {
      expect(scrubber.scrub(42)).toBe(42);
      expect(scrubber.scrub(true)).toBe(true);
      expect(scrubber.scrub(null)).toBe(null);
    });

    it('handles mixed arrays', () => {
      const result = scrubber.scrub([
        'test@test.com',
        42,
        { password: 'x', ip: '10.0.0.1' },
      ]);
      expect(result).toEqual([
        '[EMAIL]',
        42,
        { password: '[REDACTED]', ip: '[IP]' },
      ]);
    });
  });

  describe('custom configuration', () => {
    it('supports extra blocklist fields', () => {
      const custom = new PrivacyScrubber({
        extraBlocklistFields: ['mySecret'],
      });
      const result = custom.scrub({ mySecret: 'value', safe: 'ok' });
      expect(result).toEqual({ mySecret: '[REDACTED]', safe: 'ok' });
    });
  });

  describe('no PII leakage', () => {
    it('scrubs a realistic reasoning step with mixed PII', () => {
      const input = `User john@company.com (SSN: 123-45-6789) from 10.0.0.5 called +1-555-123-4567. API key: sk-proj1234567890abcdefghij. Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U`;
      const result = scrubber.scrubText(input);
      expect(result).not.toContain('john@company.com');
      expect(result).not.toContain('123-45-6789');
      expect(result).not.toContain('10.0.0.5');
      expect(result).not.toContain('555-123-4567');
      expect(result).not.toContain('sk-proj1234567890');
      expect(result).not.toContain('eyJhbGci');
    });
  });
});
