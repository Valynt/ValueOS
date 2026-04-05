/**
 * Shared integration types
 */

export interface IntegrationCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tenantId: string;
}

export interface IntegrationConfig {
  provider: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitPerMinute?: number;
  credentials?: Record<string, unknown>;
}

export const INTEGRATION_CAPABILITY_KEYS = [
  "oauth",
  "webhookSupport",
  "deltaSync",
  "manualSync",
  "fieldMapping",
  "backfill",
] as const;

export type IntegrationCapabilityKey = (typeof INTEGRATION_CAPABILITY_KEYS)[number];

export type IntegrationCapabilities = Record<IntegrationCapabilityKey, boolean>;

export interface NormalizedEntity {
  id: string;
  externalId: string;
  provider: string;
  type: string;
  data: Record<string, unknown>;
  metadata: {
    fetchedAt: Date;
    version?: string;
    tenantId?: string;
    organizationId?: string;
  };
}

export interface SyncResult {
  success: boolean;
  entitiesProcessed: number;
  errors: IntegrationErrorInfo[];
  duration: number;
}

export interface IntegrationErrorInfo {
  code: string;
  message: string;
  entityId?: string;
  retryable: boolean;
}

export type IntegrationProvider =
  | "hubspot"
  | "salesforce"
  | "servicenow"
  | "sharepoint"
  | "slack";
