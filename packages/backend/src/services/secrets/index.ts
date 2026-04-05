/**
 * Tenant-Safe Secret Layer — Public API
 *
 * Exports are intentionally narrow:
 *  - Types and interfaces for consumers
 *  - Service singletons for dependency injection
 *  - NO decrypted values, NO raw database access
 *
 * Design ref: tenant_safe_secret_layer_design_brief.md
 */

// Types
export type {
  CapabilityRequirement,
  SecretAwareToolHandler,
  SecretAwareToolResult,
  SecretContext,
} from './SecretAwareToolExecutor.js';
export type { CapabilityRequestContext } from './CapabilityResolver.js';
export type {
  ISecretBrokerService,
  RotateTenantSecretInput,
  SecretAccessAuditRecord,
  SecretAccessGrant,
  SecretAccessRequest,
  SecretAuditFilters,
  SecretBrokerDecision,
  SecretDenyReason,
  SecretEnvironment,
  SecretRotationMetadata,
  TenantSecretRecord,
  UpsertTenantSecretInput,
} from './TenantSecretTypes.js';

// Errors
export { SecretAccessDeniedError } from './SecretBrokerService.js';

// Singletons
export {
  getCapabilityResolver,
  resetCapabilityResolverForTests,
} from './CapabilityResolver.js';
export {
  getSecretAwareToolExecutor,
  resetSecretAwareToolExecutorForTests,
} from './SecretAwareToolExecutor.js';
export {
  getSecretBrokerService,
  parseCapability,
  resetSecretBrokerServiceForTests,
} from './SecretBrokerService.js';
export {
  getTenantSecretRepository,
  resetTenantSecretRepositoryForTests,
} from './TenantSecretRepository.js';
