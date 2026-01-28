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
  },
];
