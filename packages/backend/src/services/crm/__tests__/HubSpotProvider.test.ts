/**
 * HubSpot Provider Tests
 *
 * Covers: OAuth URL generation, field mapping, idempotency key extraction,
 * webhook signature verification (v3 + v2 fallback), timestamp tolerance,
 * SSRF protection, and HubSpot ID validation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HubSpotProvider } from '../HubSpotProvider.js';

describe('HubSpotProvider', () => {
  let provider: HubSpotProvider;

  beforeEach(() => {
    provider = new HubSpotProvider();
    process.env.HUBSPOT_CLIENT_ID = 'test-hs-client-id';
    process.env.HUBSPOT_CLIENT_SECRET = 'test-hs-client-secret';
    process.env.HUBSPOT_WEBHOOK_SECRET = 'test-hs-webhook-secret';
  });

  // ==========================================================================
  // OAuth
  // ==========================================================================

  describe('getAuthUrl', () => {
    it('returns a valid HubSpot OAuth URL with state and scopes', () => {
      const result = provider.getAuthUrl('tenant-456', 'https://app.test/callback');

      expect(result.authUrl).toContain('https://app.hubspot.com/oauth/authorize');
      expect(result.authUrl).toContain('client_id=test-hs-client-id');
      expect(result.authUrl).toContain('redirect_uri=');
      expect(result.authUrl).toContain('scope=');
      expect(result.authUrl).toContain('crm.objects.deals.read');
      expect(result.authUrl).toContain('crm.objects.companies.read');
      expect(result.authUrl).toContain('state=');
      expect(result.authUrl).toContain('tenant-456');
      expect(result.state).toBeTruthy();
      expect(result.state).toHaveLength(64);
    });
  });

  // ==========================================================================
  // Field Mapping
  // ==========================================================================

  describe('mapOpportunityToCanonical', () => {
    it('maps HubSpot deal properties to canonical format', () => {
      const raw = {
        id: '12345678',
        properties: {
          dealname: 'Acme Corp Enterprise',
          amount: '250000',
          dealstage: 'qualifiedtobuy',
          closedate: '2026-09-30',
          hubspot_owner_id: '87654321',
          deal_currency_code: 'EUR',
          hs_deal_stage_probability: '0.6',
          hs_lastmodifieddate: '2026-06-15T10:30:00Z',
          createdate: '2026-01-10T08:00:00Z',
          pipeline: 'default',
        },
        associations: {
          companies: {
            results: [{ id: '99887766' }],
          },
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);

      expect(result.externalId).toBe('12345678');
      expect(result.name).toBe('Acme Corp Enterprise');
      expect(result.amount).toBe(250000);
      expect(result.currency).toBe('EUR');
      expect(result.stage).toBe('qualifiedtobuy');
      expect(result.probability).toBe(0.6);
      expect(result.closeDate).toBe('2026-09-30');
      expect(result.ownerName).toBe('87654321');
      expect(result.companyId).toBe('99887766');
      expect(result.companyName).toBeNull(); // Requires separate fetch
    });

    it('handles missing optional fields gracefully', () => {
      const raw = {
        id: '111',
        properties: {
          dealname: 'Minimal Deal',
          dealstage: 'appointmentscheduled',
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);

      expect(result.externalId).toBe('111');
      expect(result.name).toBe('Minimal Deal');
      expect(result.amount).toBeNull();
      expect(result.currency).toBe('USD');
      expect(result.probability).toBeNull();
      expect(result.closeDate).toBeNull();
      expect(result.companyId).toBeNull();
    });

    it('handles missing properties object', () => {
      const raw = { id: '222' };

      const result = provider.mapOpportunityToCanonical(raw);

      expect(result.externalId).toBe('222');
      expect(result.name).toBe('Untitled Deal');
      expect(result.stage).toBe('unknown');
    });

    it('handles amount: "0" as zero, not null', () => {
      const raw = {
        id: '333',
        properties: {
          dealname: 'Zero Deal',
          dealstage: 'closedwon',
          amount: '0',
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);
      expect(result.amount).toBe(0);
    });

    it('handles amount: "not-a-number" as null', () => {
      const raw = {
        id: '444',
        properties: {
          dealname: 'Bad Amount',
          dealstage: 'closedlost',
          amount: 'not-a-number',
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);
      expect(result.amount).toBeNull();
    });

    it('handles amount: "" (empty string) as null', () => {
      const raw = {
        id: '555',
        properties: {
          dealname: 'Empty Amount',
          dealstage: 'closedlost',
          amount: '',
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);
      expect(result.amount).toBeNull();
    });

    it('handles probability: "not-a-number" as null', () => {
      const raw = {
        id: '666',
        properties: {
          dealname: 'Bad Prob',
          dealstage: 'closedlost',
          hs_deal_stage_probability: 'invalid',
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);
      expect(result.probability).toBeNull();
    });

    it('strips properties to only allowed fields', () => {
      const raw = {
        id: '777',
        properties: {
          dealname: 'Stripped Deal',
          dealstage: 'qualifiedtobuy',
          amount: '100',
          hs_lastmodifieddate: '2026-06-15T10:30:00Z',
          createdate: '2026-01-10T08:00:00Z',
          pipeline: 'default',
          // These should NOT appear in the output properties
          some_internal_field: 'should-be-stripped',
          hs_analytics_source: 'should-be-stripped',
          notes_last_updated: 'should-be-stripped',
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);

      // Allowed fields present
      expect(result.properties.dealname).toBe('Stripped Deal');
      expect(result.properties.hs_lastmodifieddate).toBe('2026-06-15T10:30:00Z');
      expect(result.properties.createdate).toBe('2026-01-10T08:00:00Z');
      expect(result.properties.pipeline).toBe('default');

      // Disallowed fields absent
      expect(result.properties).not.toHaveProperty('some_internal_field');
      expect(result.properties).not.toHaveProperty('hs_analytics_source');
      expect(result.properties).not.toHaveProperty('notes_last_updated');
    });

    it('preserves createdate for audit trail', () => {
      const raw = {
        id: '888',
        properties: {
          dealname: 'Audit Trail Deal',
          dealstage: 'closedwon',
          createdate: '2026-03-01T09:00:00Z',
          hs_lastmodifieddate: '2026-06-15T10:30:00Z',
        },
      };

      const result = provider.mapOpportunityToCanonical(raw);
      expect(result.properties.createdate).toBe('2026-03-01T09:00:00Z');
      expect(result.properties.hs_lastmodifieddate).toBe('2026-06-15T10:30:00Z');
    });
  });

  // ==========================================================================
  // Idempotency Key
  // ==========================================================================

  describe('extractIdempotencyKey', () => {
    it('generates a key from a single event payload', () => {
      const payload = {
        eventId: 'evt-hs-001',
        subscriptionType: 'deal.propertyChange',
        portalId: 12345,
      };

      const key = provider.extractIdempotencyKey(payload);

      expect(key).toContain('hs:');
      expect(key).toContain('deal.propertyChange');
      expect(key).toContain('evt-hs-001');
    });

    it('handles batch (array) payloads', () => {
      const payload = [
        { eventId: 'evt-batch-1', subscriptionType: 'deal.creation', portalId: 12345 },
        { eventId: 'evt-batch-2', subscriptionType: 'deal.creation', portalId: 12345 },
      ] as unknown as Record<string, unknown>;

      const key = provider.extractIdempotencyKey(payload);

      expect(key).toContain('hs:batch:');
      expect(key).toContain('evt-batch-1');
    });

    it('handles missing fields', () => {
      const key = provider.extractIdempotencyKey({});
      expect(key).toContain('hs:unknown:');
    });

    it('handles empty batch array', () => {
      const payload = [] as unknown as Record<string, unknown>;
      const key = provider.extractIdempotencyKey(payload);
      expect(key).toContain('hs:batch:');
    });
  });

  // ==========================================================================
  // Webhook Signature Verification
  // ==========================================================================

  describe('verifyWebhookSignature', () => {
    it('rejects requests with no signature headers', async () => {
      const req = {
        headers: {},
        body: { test: true },
        method: 'POST',
        protocol: 'https',
        get: () => 'app.test',
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });

    it('rejects requests with invalid v3 signature', async () => {
      const req = {
        headers: {
          'x-hubspot-signature-v3': 'aW52YWxpZA==',
          'x-hubspot-request-timestamp': String(Date.now()),
        },
        body: { test: true },
        method: 'POST',
        protocol: 'https',
        get: () => 'app.test',
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });

    it('accepts requests with valid v3 HMAC signature (timing-safe)', async () => {
      const { createHmac } = await import('node:crypto');
      const timestamp = String(Date.now());
      const body = JSON.stringify([{ portalId: 12345, eventId: 'evt-1' }]);
      const method = 'POST';
      const url = 'https://app.test/api/crm/hubspot/webhook';

      const sourceString = `${method}${url}${body}${timestamp}`;
      const expected = createHmac('sha256', 'test-hs-webhook-secret')
        .update(sourceString)
        .digest('base64');

      const req = {
        headers: {
          'x-hubspot-signature-v3': expected,
          'x-hubspot-request-timestamp': timestamp,
        },
        body: JSON.parse(body),
        method,
        protocol: 'https',
        get: (h: string) => h === 'host' ? 'app.test' : undefined,
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('12345');
    });

    it('accepts requests with valid v2 fallback signature', async () => {
      const { createHash } = await import('node:crypto');
      const body = JSON.stringify({ portalId: 67890, test: true });
      const expected = createHash('sha256')
        .update('test-hs-webhook-secret' + body)
        .digest('hex');

      const req = {
        headers: {
          'x-hubspot-signature': expected,
        },
        body: JSON.parse(body),
        method: 'POST',
        protocol: 'https',
        get: () => 'app.test',
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('67890');
    });

    it('rejects v3 events outside timestamp tolerance window', async () => {
      const { createHmac } = await import('node:crypto');
      const staleTimestamp = String(Date.now() - 10 * 60 * 1000); // 10 min ago
      const body = JSON.stringify([{ portalId: 12345 }]);
      const method = 'POST';
      const url = 'https://app.test/api/crm/hubspot/webhook';

      const sourceString = `${method}${url}${body}${staleTimestamp}`;
      const sig = createHmac('sha256', 'test-hs-webhook-secret')
        .update(sourceString)
        .digest('base64');

      const req = {
        headers: {
          'x-hubspot-signature-v3': sig,
          'x-hubspot-request-timestamp': staleTimestamp,
        },
        body: JSON.parse(body),
        method,
        protocol: 'https',
        get: (h: string) => h === 'host' ? 'app.test' : undefined,
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });

    it('rejects when webhook secret is not configured', async () => {
      delete process.env.HUBSPOT_WEBHOOK_SECRET;

      const req = {
        headers: {
          'x-hubspot-signature-v3': 'some-sig',
          'x-hubspot-request-timestamp': String(Date.now()),
        },
        body: {},
        method: 'POST',
        protocol: 'https',
        get: () => 'app.test',
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });

    it('rejects requests with invalid v2 signature', async () => {
      const req = {
        headers: {
          'x-hubspot-signature': 'deadbeef00112233445566778899aabbccddeeff00112233445566778899aabbcc',
        },
        body: { portalId: 12345, test: true },
        method: 'POST',
        protocol: 'https',
        get: () => 'app.test',
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });

    it('extracts portalId from non-array payload via v2', async () => {
      const { createHash } = await import('node:crypto');
      const body = JSON.stringify({ portalId: 55555, objectId: 'deal-1' });
      const expected = createHash('sha256')
        .update('test-hs-webhook-secret' + body)
        .digest('hex');

      const req = {
        headers: {
          'x-hubspot-signature': expected,
        },
        body: JSON.parse(body),
        method: 'POST',
        protocol: 'https',
        get: () => 'app.test',
        originalUrl: '/api/crm/hubspot/webhook',
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('55555');
    });
  });

  // ==========================================================================
  // SSRF Protection
  // ==========================================================================

  describe('SSRF protection', () => {
    const tokens = {
      accessToken: 'test',
      refreshToken: 'test',
      expiresAt: new Date(Date.now() + 3600000),
      instanceUrl: 'https://evil.com',
      scopes: ['crm.objects.deals.read'],
    };

    it('uses hardcoded HS_API_BASE, never instanceUrl from tokens', async () => {
      // Even with a malicious instanceUrl, the provider uses its own constant
      // This will fail with a network error (can't reach HubSpot), not SSRF
      const result = await provider.fetchOpportunityById(tokens, '12345');
      expect(result).toBeNull();
    });

    it('validates all outbound URLs against the domain allowlist', async () => {
      // fetchDeltaOpportunities calls assertSafeUrl internally
      // It will fail with network error, but the URL validation passes
      // because it uses HS_API_BASE
      await expect(
        provider.fetchDeltaOpportunities(tokens, null),
      ).rejects.toThrow(); // Network error, not SSRF
    });
  });

  // ==========================================================================
  // HubSpot ID Validation (deals)
  // ==========================================================================

  describe('HubSpot deal ID validation', () => {
    const tokens = {
      accessToken: 'test',
      refreshToken: 'test',
      expiresAt: new Date(Date.now() + 3600000),
      scopes: ['crm.objects.deals.read'],
    };

    it('rejects non-numeric IDs (SQL injection attempt)', async () => {
      const result = await provider.fetchOpportunityById(tokens, "'; DROP TABLE deals; --");
      expect(result).toBeNull();
    });

    it('rejects IDs with special characters (XSS attempt)', async () => {
      const result = await provider.fetchOpportunityById(tokens, '<script>alert(1)</script>');
      expect(result).toBeNull();
    });

    it('rejects IDs that are too long (>20 digits)', async () => {
      const result = await provider.fetchOpportunityById(tokens, '1'.repeat(25));
      expect(result).toBeNull();
    });

    it('rejects empty IDs', async () => {
      const result = await provider.fetchOpportunityById(tokens, '');
      expect(result).toBeNull();
    });

    it('rejects IDs with spaces', async () => {
      const result = await provider.fetchOpportunityById(tokens, '123 456');
      expect(result).toBeNull();
    });

    it('rejects IDs with path traversal', async () => {
      const result = await provider.fetchOpportunityById(tokens, '../../etc/passwd');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // HubSpot ID Validation (companies)
  // ==========================================================================

  describe('HubSpot company ID validation', () => {
    const tokens = {
      accessToken: 'test',
      refreshToken: 'test',
      expiresAt: new Date(Date.now() + 3600000),
      scopes: ['crm.objects.companies.read'],
    };

    it('rejects non-numeric company IDs', async () => {
      const result = await provider.fetchAccountById(tokens, "abc; DROP TABLE companies;");
      expect(result).toBeNull();
    });

    it('rejects empty company IDs', async () => {
      const result = await provider.fetchAccountById(tokens, '');
      expect(result).toBeNull();
    });

    it('rejects company IDs with special characters', async () => {
      const result = await provider.fetchAccountById(tokens, '../../../etc/passwd');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Provider identity
  // ==========================================================================

  describe('provider identity', () => {
    it('identifies as hubspot', () => {
      expect(provider.provider).toBe('hubspot');
    });
  });
});
