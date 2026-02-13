/**
 * Secrets Redaction Tests
 */

import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../secretsRedaction.js';

describe('redactSecrets', () => {
  it('redacts known sensitive keys', () => {
    const input = {
      access_token: 'secret-token-123',
      refresh_token: 'refresh-abc',
      name: 'visible',
    };

    const result = redactSecrets(input) as Record<string, unknown>;

    expect(result.access_token).toBe('[REDACTED]');
    expect(result.refresh_token).toBe('[REDACTED]');
    expect(result.name).toBe('visible');
  });

  it('redacts nested sensitive keys', () => {
    const input = {
      data: {
        credentials: {
          accessToken: 'secret',
          clientSecret: 'also-secret',
        },
        name: 'safe',
      },
    };

    const result = redactSecrets(input) as any;

    expect(result.data.credentials.accessToken).toBe('[REDACTED]');
    expect(result.data.credentials.clientSecret).toBe('[REDACTED]');
    expect(result.data.name).toBe('safe');
  });

  it('redacts values that look like bearer tokens', () => {
    const input = {
      header: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
    };

    const result = redactSecrets(input) as any;
    expect(result.header).toBe('[REDACTED]');
  });

  it('redacts long base64-like strings', () => {
    const input = {
      someField: 'aVeryLongBase64StringThatLooksLikeATokenAbcDefGhiJklMnoPqrStuVwxYz123456',
    };

    const result = redactSecrets(input) as any;
    expect(result.someField).toBe('[REDACTED]');
  });

  it('does not redact short normal strings', () => {
    const input = {
      name: 'Acme Corp',
      stage: 'Qualification',
      amount: 50000,
    };

    const result = redactSecrets(input) as any;
    expect(result.name).toBe('Acme Corp');
    expect(result.stage).toBe('Qualification');
    expect(result.amount).toBe(50000);
  });

  it('handles null and undefined', () => {
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(undefined)).toBeUndefined();
  });

  it('handles arrays', () => {
    const input = [
      { access_token: 'secret', name: 'safe' },
      { refresh_token: 'secret2', value: 42 },
    ];

    const result = redactSecrets(input) as any[];
    expect(result[0].access_token).toBe('[REDACTED]');
    expect(result[0].name).toBe('safe');
    expect(result[1].refresh_token).toBe('[REDACTED]');
    expect(result[1].value).toBe(42);
  });

  it('does not mutate the original object', () => {
    const input = { access_token: 'secret', name: 'safe' };
    redactSecrets(input);
    expect(input.access_token).toBe('secret');
  });

  it('redacts HubSpot v3 signature header', () => {
    const input = {
      'x-hubspot-signature-v3': 'base64-hmac-value',
      'x-hubspot-signature': 'hex-hash-value',
      'x-sfdc-signature': 'sfdc-sig',
      eventType: 'deal.creation',
    };

    const result = redactSecrets(input) as any;
    expect(result['x-hubspot-signature-v3']).toBe('[REDACTED]');
    expect(result['x-hubspot-signature']).toBe('[REDACTED]');
    expect(result['x-sfdc-signature']).toBe('[REDACTED]');
    expect(result.eventType).toBe('deal.creation');
  });
});
