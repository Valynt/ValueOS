/**
 * CRM Provider Registry
 *
 * Singleton registry that maps provider names to their implementations.
 * Add new providers here as they are implemented.
 */

import type { CrmProviderInterface } from './CrmProviderInterface.js';
import type { CrmProvider } from './types.js';
import { SalesforceProvider } from './SalesforceProvider.js';

const providers = new Map<CrmProvider, CrmProviderInterface>();

// Register built-in providers
providers.set('salesforce', new SalesforceProvider());

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
