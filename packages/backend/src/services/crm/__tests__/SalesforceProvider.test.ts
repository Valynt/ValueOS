/**
 * Salesforce Provider Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesforceProvider } from '../SalesforceProvider.js';

describe('SalesforceProvider', () => {
  let provider: SalesforceProvider;

  beforeEach(() => {
    provider = new SalesforceProvider();
    process.env.SALESFORCE_CLIENT_ID = 'test-client-id';
    process.env.SALESFORCE_CLIENT_SECRET = 'test-client-secret';
    process.env.SALESFORCE_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  describe('getAuthUrl', () => {
    it('returns a valid Salesforce OAuth URL with state', () => {
      const result = provider.getAuthUrl('tenant-123', 'https://app.test/callback');

      expect(result.authUrl).toContain('https://login.salesforce.com/services/oauth2/authorize');
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('redirect_uri=');
      expect(result.authUrl).toContain('state=');
      expect(result.authUrl).toContain('tenant-123');
      expect(result.state).toBeTruthy();
      expect(result.state.length).toBe(64); // 32 bytes hex
    });
  });

  describe('mapOpportunityToCanonical', () => {
    it('maps Salesforce opportunity fields to canonical format', () => {
      const raw = {
        Id: '006ABC123',
        Name: 'Acme Corp Deal',
        Amount: 150000,
        StageName: 'Qualification',
        Probability: 40,
        CloseDate: '2026-06-15',
        CurrencyIsoCode: 'USD',
        AccountId: '001XYZ789',
        Account: { Name: 'Acme Corp' },
        Owner: { Name: 'Jane Doe' },
      };

      const result = provider.mapOpportunityToCanonical(raw);

      expect(result.externalId).toBe('006ABC123');
      expect(result.name).toBe('Acme Corp Deal');
      expect(result.amount).toBe(150000);
      expect(result.stage).toBe('Qualification');
      expect(result.probability).toBe(40);
      expect(result.closeDate).toBe('2026-06-15');
      expect(result.currency).toBe('USD');
      expect(result.companyName).toBe('Acme Corp');
      expect(result.companyId).toBe('001XYZ789');
      expect(result.ownerName).toBe('Jane Doe');
    });

    it('handles missing optional fields gracefully', () => {
      const raw = {
        Id: '006MIN',
        Name: 'Minimal Deal',
        StageName: 'Prospecting',
      };

      const result = provider.mapOpportunityToCanonical(raw);

      expect(result.externalId).toBe('006MIN');
      expect(result.name).toBe('Minimal Deal');
      expect(result.amount).toBeNull();
      expect(result.currency).toBe('USD');
      expect(result.companyName).toBeNull();
      expect(result.ownerName).toBeNull();
    });
  });

  describe('extractIdempotencyKey', () => {
    it('generates a key from event payload', () => {
      const payload = {
        eventId: 'evt-001',
        sobjectType: 'Opportunity',
      };

      const key = provider.extractIdempotencyKey(payload);

      expect(key).toContain('sf:');
      expect(key).toContain('Opportunity');
      expect(key).toContain('evt-001');
    });

    it('handles missing fields', () => {
      const key = provider.extractIdempotencyKey({});
      expect(key).toContain('sf:unknown:');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('rejects requests with no signature header', async () => {
      const req = {
        headers: {},
        body: { test: true },
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });

    it('rejects requests with invalid signature', async () => {
      const req = {
        headers: { 'x-sfdc-signature': 'aW52YWxpZA==' },
        body: { test: true },
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });

    it('accepts requests with valid HMAC signature (timing-safe)', async () => {
      const { createHmac } = await import('node:crypto');
      const body = JSON.stringify({ organizationId: 'org-123', test: true });
      const expected = createHmac('sha256', 'test-webhook-secret')
        .update(body)
        .digest('base64');

      const req = {
        headers: { 'x-sfdc-signature': expected },
        body: JSON.parse(body),
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('org-123');
    });

    it('rejects events outside timestamp tolerance window', async () => {
      const { createHmac } = await import('node:crypto');
      const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
      const body = JSON.stringify({
        organizationId: 'org-123',
        timestamp: staleTimestamp,
      });
      const sig = createHmac('sha256', 'test-webhook-secret')
        .update(body)
        .digest('base64');

      const req = {
        headers: { 'x-sfdc-signature': sig },
        body: JSON.parse(body),
      } as any;

      const result = await provider.verifyWebhookSignature(req);
      expect(result.valid).toBe(false);
    });
  });

  describe('SSRF protection', () => {
    it('rejects non-Salesforce instance URLs', async () => {
      const tokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: new Date(Date.now() + 3600000),
        instanceUrl: 'https://evil-attacker.com',
        scopes: ['api'],
      };

      await expect(
        provider.fetchOpportunityById(tokens, '006ABC123456789'),
      ).rejects.toThrow('Invalid Salesforce instance URL');
    });

    it('rejects internal/localhost URLs', async () => {
      const tokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: new Date(Date.now() + 3600000),
        instanceUrl: 'http://localhost:8080',
        scopes: ['api'],
      };

      await expect(
        provider.fetchDeltaOpportunities(tokens, null),
      ).rejects.toThrow('Invalid Salesforce instance URL');
    });
  });

  describe('Salesforce ID validation', () => {
    it('rejects malformed Salesforce IDs (SOQL injection)', async () => {
      const tokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: new Date(Date.now() + 3600000),
        instanceUrl: 'https://na1.salesforce.com',
        scopes: ['api'],
      };

      // SOQL injection attempt
      const result = await provider.fetchOpportunityById(
        tokens,
        "' OR 1=1 --",
      );
      expect(result).toBeNull();
    });

    it('rejects IDs with special characters', async () => {
      const tokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: new Date(Date.now() + 3600000),
        instanceUrl: 'https://na1.salesforce.com',
        scopes: ['api'],
      };

      const result = await provider.fetchOpportunityById(tokens, '<script>alert(1)</script>');
      expect(result).toBeNull();
    });
  });
});
