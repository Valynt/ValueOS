/**
 * CRM Integration Module
 *
 * Barrel export for all CRM integration services.
 */

export { crmConnectionService, CrmConnectionService } from './CrmConnectionService.js';
export { crmWebhookService, CrmWebhookService } from './CrmWebhookService.js';
export { crmSyncService, CrmSyncService } from './CrmSyncService.js';
export { valueCaseScaffolder, ValueCaseScaffolder } from './ValueCaseScaffolder.js';
export { agentPrefetchService, AgentPrefetchService } from './AgentPrefetchService.js';
export { getCrmProvider, registerCrmProvider, getSupportedProviders } from './CrmProviderRegistry.js';
export { SalesforceProvider } from './SalesforceProvider.js';
export { encryptToken, decryptToken } from './tokenEncryption.js';

export type {
  CrmProvider,
  ConnectionStatus,
  OAuthTokens,
  CanonicalOpportunity,
  CanonicalAccount,
  DeltaSyncResult,
  CrmConnectionRow,
  WebhookEventRow,
  ProvenanceInput,
} from './types.js';

export type { CrmProviderInterface } from './CrmProviderInterface.js';
export type { PrefetchJobInput, PrefetchResult } from './AgentPrefetchService.js';
