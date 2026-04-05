import type { IntegrationProvider } from "./IntegrationConnectionService";

export type IntegrationCapabilityKey =
  | "oauth"
  | "webhookSupport"
  | "deltaSync"
  | "manualSync"
  | "fieldMapping"
  | "backfill";

export type IntegrationCapabilities = Record<IntegrationCapabilityKey, boolean>;

export interface IntegrationCapabilitiesWire {
  oauth: boolean;
  webhook_support: boolean;
  delta_sync: boolean;
  manual_sync: boolean;
  field_mapping: boolean;
  backfill: boolean;
}

export interface IntegrationCapabilityRegistryEntry {
  provider: IntegrationProvider;
  displayName: string;
  capabilities: IntegrationCapabilities;
  capabilityFlags: IntegrationCapabilitiesWire;
}

const CAPABILITY_REGISTRY: IntegrationCapabilityRegistryEntry[] = [
  {
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
  {
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
  {
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
  {
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
  {
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
];

export function getIntegrationCapabilityRegistry(): IntegrationCapabilityRegistryEntry[] {
  return CAPABILITY_REGISTRY.map((entry) => ({
    ...entry,
    capabilityFlags: {
      oauth: entry.capabilities.oauth,
      webhook_support: entry.capabilities.webhookSupport,
      delta_sync: entry.capabilities.deltaSync,
      manual_sync: entry.capabilities.manualSync,
      field_mapping: entry.capabilities.fieldMapping,
      backfill: entry.capabilities.backfill,
    },
  }));
}
