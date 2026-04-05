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
  | "disconnect";

export interface IntegrationCapabilitySupport {
  supported: boolean;
  note?: string;
}

export type IntegrationProviderCapabilities = Record<
  IntegrationCapabilityKey,
  IntegrationCapabilitySupport
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
  capabilities: IntegrationProviderCapabilities;
}

export const DEFAULT_PROVIDER_CAPABILITIES: IntegrationProviderCapabilities = {
  oauth: { supported: false, note: "OAuth is not available for this provider." },
  webhook_support: { supported: false, note: "Webhook support is not available." },
  delta_sync: { supported: false, note: "Delta sync is not available." },
  manual_sync: { supported: false, note: "Manual sync is not available." },
  field_mapping: { supported: false, note: "Field mapping is not available." },
  backfill: { supported: false, note: "Backfill is not available." },
  test_connection: { supported: false, note: "Connection testing is not available." },
  disconnect: { supported: true, note: "Disconnect is supported." },
};

export const CRM_PROVIDER_DEFAULT_CAPABILITIES: IntegrationProviderCapabilities = {
  oauth: { supported: true, note: "OAuth is supported." },
  webhook_support: { supported: true, note: "Webhook support is available." },
  delta_sync: { supported: true, note: "Delta sync is supported." },
  manual_sync: { supported: true, note: "Manual sync is supported." },
  field_mapping: { supported: true, note: "Field mapping is supported." },
  backfill: { supported: false, note: "Backfill is not currently supported." },
  test_connection: { supported: true, note: "Connection testing is supported." },
  disconnect: { supported: true, note: "Disconnect is supported." },
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
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Paste Salesforce access token",
        required: true,
      },
      {
        key: "refreshToken",
        label: "Refresh Token (optional)",
        type: "password",
        placeholder: "Paste refresh token if available",
        required: false,
      },
      {
        key: "instanceUrl",
        label: "Instance URL",
        type: "url",
        placeholder: "https://your-instance.my.salesforce.com",
        required: true,
      },
    ],
    capabilities: CRM_PROVIDER_DEFAULT_CAPABILITIES,
  },
  {
    id: "hubspot",
    type: "crm",
    name: "HubSpot",
    description: "Connect your HubSpot CRM",
    icon: "HS",
    authType: "apikey",
    fields: [
      {
        key: "accessToken",
        label: "Private App Token",
        type: "password",
        placeholder: "Paste HubSpot private app token",
        required: true,
      },
    ],
    capabilities: CRM_PROVIDER_DEFAULT_CAPABILITIES,
  },
];
