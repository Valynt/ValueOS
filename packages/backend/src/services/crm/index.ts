/**
 * CRM Integration Module
 *
 * Barrel export for all CRM integration services.
 */

// Services
export { crmConnectionService, CrmConnectionService } from './CrmConnectionService.js';
export { crmWebhookService, CrmWebhookService } from './CrmWebhookService.js';
export { crmSyncService, CrmSyncService } from './CrmSyncService.js';
export { valueCaseScaffolder, ValueCaseScaffolder } from './ValueCaseScaffolder.js';
export { agentPrefetchService, AgentPrefetchService } from './AgentPrefetchService.js';
export { crmHealthService, CrmHealthService } from './CrmHealthService.js';

// Provider registry
export { getCrmProvider, registerCrmProvider, getSupportedProviders } from './CrmProviderRegistry.js';
export { SalesforceProvider } from './SalesforceProvider.js';
export { HubSpotProvider } from './HubSpotProvider.js';

// Token encryption
export { encryptToken, decryptToken, tokenFingerprint, needsReEncryption } from './tokenEncryption.js';

// Security utilities
export { redactSecrets } from './secretsRedaction.js';
export { validateAuditDetails, CrmAuditEventSchema } from './auditSchema.js';

// Types
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
export type { SyncHealthStatus, HealthAlert } from './CrmHealthService.js';
export type { CrmAuditAction, CrmAuditEvent } from './auditSchema.js';
