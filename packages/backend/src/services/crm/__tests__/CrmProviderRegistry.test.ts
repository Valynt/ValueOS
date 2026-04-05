/**
 * CRM Provider Registry Tests
 */

import { describe, expect, it } from 'vitest';

import {
  getCrmProvider,
  getProviderCapabilities,
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

  it('exposes capabilities for each supported provider', () => {
    const capabilities = getProviderCapabilities();

    expect(capabilities.salesforce.oauth.supported).toBe(true);
    expect(capabilities.hubspot.manual_sync.supported).toBe(true);
    expect(capabilities.hubspot.backfill.supported).toBe(false);
  });
});
