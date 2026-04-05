import type { IntegrationCapabilities, IntegrationProvider } from "./types.js";

export interface ProviderCapabilityDescriptor {
  provider: IntegrationProvider;
  displayName: string;
  capabilities: IntegrationCapabilities;
}

export const PROVIDER_CAPABILITY_REGISTRY: Record<IntegrationProvider, ProviderCapabilityDescriptor> = {
  hubspot: {
    provider: "hubspot",
    displayName: "HubSpot",
    capabilities: {
      oauth: true,
      webhookSupport: true,
      deltaSync: true,
      manualSync: true,
      fieldMapping: true,
      backfill: true,
    },
  },
  salesforce: {
    provider: "salesforce",
    displayName: "Salesforce",
    capabilities: {
      oauth: true,
      webhookSupport: true,
      deltaSync: true,
      manualSync: true,
      fieldMapping: true,
      backfill: true,
    },
  },
  servicenow: {
    provider: "servicenow",
    displayName: "ServiceNow",
    capabilities: {
      oauth: true,
      webhookSupport: true,
      deltaSync: true,
      manualSync: true,
      fieldMapping: true,
      backfill: false,
    },
  },
  sharepoint: {
    provider: "sharepoint",
    displayName: "SharePoint",
    capabilities: {
      oauth: true,
      webhookSupport: false,
      deltaSync: true,
      manualSync: true,
      fieldMapping: false,
      backfill: false,
    },
  },
  slack: {
    provider: "slack",
    displayName: "Slack",
    capabilities: {
      oauth: true,
      webhookSupport: true,
      deltaSync: false,
      manualSync: true,
      fieldMapping: false,
      backfill: false,
    },
  },
};

export function getProviderCapabilities(provider: IntegrationProvider): IntegrationCapabilities {
  return PROVIDER_CAPABILITY_REGISTRY[provider].capabilities;
}

export function listProviderCapabilities(): ProviderCapabilityDescriptor[] {
  return Object.values(PROVIDER_CAPABILITY_REGISTRY);
}
