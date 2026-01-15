export type IntegrationType = "crm" | "communication" | "storage" | "analytics" | "auth";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";

export interface Integration {
  id: string;
  type: IntegrationType;
  provider: string;
  name: string;
  description: string;
  icon?: string;
  status: IntegrationStatus;
  config?: Record<string, unknown>;
  connectedAt?: string;
  lastSyncAt?: string;
}

export interface IntegrationCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface IntegrationProvider {
  id: string;
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  authType: "oauth" | "apikey" | "basic";
  configSchema: Record<string, unknown>;
}

// Known providers
export const PROVIDERS: IntegrationProvider[] = [
  {
    id: "salesforce",
    type: "crm",
    name: "Salesforce",
    description: "Connect your Salesforce CRM",
    icon: "salesforce",
    authType: "oauth",
    configSchema: {},
  },
  {
    id: "hubspot",
    type: "crm",
    name: "HubSpot",
    description: "Connect your HubSpot CRM",
    icon: "hubspot",
    authType: "oauth",
    configSchema: {},
  },
  {
    id: "slack",
    type: "communication",
    name: "Slack",
    description: "Connect Slack for notifications",
    icon: "slack",
    authType: "oauth",
    configSchema: {},
  },
];
