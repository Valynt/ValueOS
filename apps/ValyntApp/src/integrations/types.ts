export type IntegrationType = "crm" | "communication" | "storage" | "analytics" | "auth";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
export type IntegrationProviderId = "hubspot" | "salesforce";
export type IntegrationCapabilityKey =
  | "oauth"
  | "webhook_support"
  | "delta_sync"
  | "manual_sync"
  | "field_mapping"
  | "backfill"
  | "test_connection"
  | "credential_rotation";

export interface IntegrationCapability {
  supported: boolean;
  reason?: string;
}

export type IntegrationCapabilityMap = Record<
  IntegrationCapabilityKey,
  IntegrationCapability
>;

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
  accessToken: string;
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
  capabilities: IntegrationCapabilityMap;
}

const defaultCapabilities: IntegrationCapabilityMap = {
  oauth: { supported: false },
  webhook_support: { supported: false },
  delta_sync: { supported: false },
  manual_sync: { supported: false },
  field_mapping: { supported: false },
  backfill: { supported: false },
  test_connection: { supported: true },
  credential_rotation: { supported: true },
};

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
      ...defaultCapabilities,
      oauth: { supported: true },
      webhook_support: { supported: true },
      delta_sync: { supported: true },
      manual_sync: { supported: true },
      field_mapping: { supported: true },
      backfill: { supported: true },
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
      ...defaultCapabilities,
      oauth: { supported: true },
      webhook_support: { supported: true },
      delta_sync: { supported: true },
      manual_sync: { supported: true },
      field_mapping: { supported: true },
      backfill: { supported: true },
    },
  },
];
