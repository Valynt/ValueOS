/**
 * Redaction utility tests
 */

import { describe, it, expect } from 'vitest';
import { redactSensitiveData, redactHeaders } from '../redaction.js'

describe('redaction utilities', () => {
  it('redacts sensitive header values', () => {
    const result = redactHeaders({
      Authorization: 'Bearer secret-token',
      Cookie: 'session=abc123',
      'X-API-Key': 'key-123',
      'User-Agent': 'test-agent',
    });

    expect(result).toEqual({
      Authorization: '[REDACTED]',
      Cookie: '[REDACTED]',
      'X-API-Key': '[REDACTED]',
      'User-Agent': 'test-agent',
    });
  });

  it('redacts sensitive nested fields and PII', () => {
    const input = {
      email: 'user@example.com',
      profile: {
        phone: '555-123-4567',
        token: 'abc123',
      },
      metadata: {
        notes: 'Customer SSN 123-45-6789',
      },
    };

    const result = redactSensitiveData(input);

    expect(result).toEqual({
      email: '[REDACTED]',
      profile: {
        phone: '[REDACTED]',
        token: '[REDACTED]',
      },
      metadata: {
        notes: '[REDACTED]',
      },
    });
  });

  it('preserves non-sensitive values', () => {
    const input = {
      id: 'req-123',
      count: 4,
      tags: ['alpha', 'beta'],
    };

    const result = redactSensitiveData(input);

    expect(result).toEqual(input);
  });
});
