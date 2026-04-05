/**
 * CRM Provider Registry Tests
 */

import { describe, expect, it } from 'vitest';

import {
  getCrmProvider,
  getProviderCapabilityRegistry,
  getSupportedProviders,
} from '../CrmProviderRegistry.js';
import { SalesforceProvider } from '../SalesforceProvider.js';

describe('CrmProviderRegistry', () => {
  it('returns Salesforce provider', () => {
    const provider = getCrmProvider('salesforce');
    expect(provider).toBeInstanceOf(SalesforceProvider);
    expect(provider.provider).toBe('salesforce');
  });

  it('throws for unsupported provider', () => {
    expect(() => getCrmProvider('unknown' as any)).toThrow('Unsupported CRM provider');
  });

  it('lists supported providers', () => {
    const providers = getSupportedProviders();
    expect(providers).toContain('salesforce');
  });

  it('returns capability descriptors for all providers', () => {
    const registry = getProviderCapabilityRegistry();
    const salesforce = registry.find((entry) => entry.provider === 'salesforce');

    expect(salesforce).toBeDefined();
    expect(salesforce?.capabilities).toEqual(
      expect.objectContaining({
        oauth: true,
        webhookSupport: true,
        deltaSync: true,
        manualSync: true,
        fieldMapping: true,
        backfill: true,
      }),
    );
  });
});
