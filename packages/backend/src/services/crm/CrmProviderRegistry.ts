/**
 * CRM Provider Registry
 *
 * Singleton registry that maps provider names to their implementations.
 * Add new providers here as they are implemented.
 */

import type { CrmProviderInterface } from './CrmProviderInterface.js';
import { HubSpotProvider } from './HubSpotProvider.js';
import { SalesforceProvider } from './SalesforceProvider.js';
import type { CrmProvider, CrmProviderCapabilities } from './types.js';

const providers = new Map<CrmProvider, CrmProviderInterface>();

// Register built-in providers
providers.set('salesforce', new SalesforceProvider());
providers.set('hubspot', new HubSpotProvider());

export function getCrmProvider(provider: CrmProvider): CrmProviderInterface {
  const impl = providers.get(provider);
  if (!impl) {
    throw new Error(`Unsupported CRM provider: ${provider}`);
  }
  return impl;
}

export function registerCrmProvider(provider: CrmProvider, impl: CrmProviderInterface): void {
  providers.set(provider, impl);
}

export function getSupportedProviders(): CrmProvider[] {
  return Array.from(providers.keys());
}

export function getProviderCapabilities(): Record<CrmProvider, CrmProviderCapabilities> {
  const capabilities = {} as Record<CrmProvider, CrmProviderCapabilities>;

  for (const [provider, impl] of providers.entries()) {
    capabilities[provider] = impl.capabilities;
  }

  return capabilities;
}
