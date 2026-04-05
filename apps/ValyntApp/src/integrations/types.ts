export type IntegrationType = "crm" | "communication" | "storage" | "analytics" | "auth";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
export type IntegrationProviderId = "hubspot" | "salesforce" | "servicenow" | "sharepoint" | "slack";
export type CrmIntegrationProviderId = "hubspot" | "salesforce";

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

export interface IntegrationCapabilities {
  oauth: boolean;
  webhook_support: boolean;
  delta_sync: boolean;
  manual_sync: boolean;
  field_mapping: boolean;
  backfill: boolean;
  credential_rotation: boolean;
  connection_test: boolean;
}

export type IntegrationActionKey =
  | "connect"
  | "reconnect"
  | "configure"
  | "test"
  | "sync"
  | "disconnect";

export interface IntegrationProvider {
  id: IntegrationProviderId;
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  authType: "oauth" | "apikey" | "basic";
  fields: IntegrationConfigField[];
  requiresInstanceUrl?: boolean;
  capabilities: IntegrationCapabilities;
  unsupportedActionReasons?: Partial<Record<IntegrationActionKey, string>>;
}

export interface IntegrationOperationEntry {
  id: string;
  provider: CrmIntegrationProviderId;
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
  provider: CrmIntegrationProviderId | "all";
  connectionEvents: IntegrationOperationEntry[];
  webhookFailures: IntegrationOperationEntry[];
  syncFailures: IntegrationOperationEntry[];
  lifecycleHistory: IntegrationOperationEntry[];
}

export const PROVIDERS: IntegrationProvider[] = [
  {
    id: "salesforce",
    type: "crm",
    name: "Salesforce",
    description: "Connect your Salesforce CRM",
    icon: "SF",
    authType: "oauth",
    fields: [],
    requiresInstanceUrl: true,
    capabilities: {
      oauth: true,
      webhook_support: true,
      delta_sync: true,
      manual_sync: true,
      field_mapping: true,
      backfill: true,
      credential_rotation: true,
      connection_test: true,
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
      webhook_support: true,
      delta_sync: true,
      manual_sync: true,
      field_mapping: true,
      backfill: true,
      credential_rotation: true,
      connection_test: true,
    },
  },
];
