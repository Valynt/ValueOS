export type IntegrationType = "crm" | "communication" | "storage" | "analytics" | "auth";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
export type IntegrationProviderId = "hubspot" | "salesforce";

export interface IntegrationCapabilities {
  oauth: boolean;
  webhookSupport: boolean;
  deltaSync: boolean;
  manualSync: boolean;
  fieldMapping: boolean;
  backfill: boolean;
}

export interface IntegrationCapabilityFlags {
  oauth: boolean;
  webhook_support: boolean;
  delta_sync: boolean;
  manual_sync: boolean;
  field_mapping: boolean;
  backfill: boolean;
}

export type IntegrationCapabilityKey = keyof IntegrationCapabilities;

export const INTEGRATION_CAPABILITY_META: Record<
  IntegrationCapabilityKey,
  { label: string; unsupportedText: string }
> = {
  oauth: {
    label: "OAuth",
    unsupportedText: "OAuth is not supported for this provider.",
  },
  webhookSupport: {
    label: "Webhook ingestion",
    unsupportedText: "Webhook ingestion is not supported for this provider.",
  },
  deltaSync: {
    label: "Delta sync",
    unsupportedText: "Delta sync is not supported for this provider.",
  },
  manualSync: {
    label: "Manual sync",
    unsupportedText: "Manual sync is not available for this provider.",
  },
  fieldMapping: {
    label: "Field mapping",
    unsupportedText: "Field mapping configuration is unavailable.",
  },
  backfill: {
    label: "Historical backfill",
    unsupportedText: "Historical backfill is unavailable.",
  },
};

export interface IntegrationConnection {
  id: string;
  provider: IntegrationProviderId;
  status: IntegrationStatus;
  connectedAt?: string;
  lastSyncAt?: string;
  errorMessage?: string;
  instanceUrl?: string;
  scopes?: string[];
}

export interface IntegrationConfigField {
  key: "accessToken" | "refreshToken" | "instanceUrl";
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}

export interface IntegrationCredentialsInput {
  accessToken?: string;
  refreshToken?: string;
  instanceUrl?: string;
}

export interface IntegrationProvider {
  id: IntegrationProviderId;
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  authType: "oauth" | "apikey" | "basic";
  fields: IntegrationConfigField[];
  capabilities: IntegrationCapabilities;
}

export interface IntegrationOperationEntry {
  id: string;
  provider: IntegrationProviderId;
  category: "connection_event" | "webhook_failure" | "sync_failure";
  action: string;
  status: "success" | "failed";
  timestamp: string;
  correlationId: string | null;
  details: Record<string, unknown>;
}

export interface IntegrationOperationsResponse {
  tenantId: string;
  generatedAt: string;
  provider: IntegrationProviderId | "all";
  connectionEvents: IntegrationOperationEntry[];
  webhookFailures: IntegrationOperationEntry[];
  syncFailures: IntegrationOperationEntry[];
  lifecycleHistory: IntegrationOperationEntry[];
}

// Known providers (CRM-focused for production readiness)
export const PROVIDERS: IntegrationProvider[] = [
  {
    id: "salesforce",
    type: "crm",
    name: "Salesforce",
    description: "Connect your Salesforce CRM",
    icon: "SF",
    authType: "oauth",
    fields: [],
    capabilities: {
      oauth: true,
      webhookSupport: true,
      deltaSync: true,
      manualSync: true,
      fieldMapping: true,
      backfill: true,
    },
  },
  {
    id: "hubspot",
    type: "crm",
    name: "HubSpot",
    description: "Connect your HubSpot CRM",
    icon: "HS",
    authType: "oauth",
    fields: [],
    capabilities: {
      oauth: true,
      webhookSupport: true,
      deltaSync: true,
      manualSync: true,
      fieldMapping: true,
      backfill: true,
    },
  },
];
