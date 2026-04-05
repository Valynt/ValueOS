export type IntegrationType = "crm" | "communication" | "storage" | "analytics" | "auth";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
export type IntegrationProviderId = "hubspot" | "salesforce";

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
  },
  {
    id: "hubspot",
    type: "crm",
    name: "HubSpot",
    description: "Connect your HubSpot CRM",
    icon: "HS",
    authType: "oauth",
    fields: [],
  },
];
