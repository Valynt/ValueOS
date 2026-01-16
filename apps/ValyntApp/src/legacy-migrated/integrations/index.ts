/**
 * Integration Index
 * Exports all enterprise adapters
 */

export { IEnterpriseAdapter } from "./base/IEnterpriseAdapter";
export { EnterpriseAdapter } from "./base/EnterpriseAdapter";
export { RateLimiter, RateLimitError } from "./base/RateLimiter";

export { SalesforceAdapter } from "./salesforce/SalesforceAdapter";
export { HubSpotAdapter } from "./hubspot/HubSpotAdapter";
export { ServiceNowAdapter } from "./servicenow/ServiceNowAdapter";
export { SlackAdapter } from "./slack/SlackAdapter";
export { SharePointAdapter } from "./sharepoint/SharePointAdapter";

export type {
  AdapterConfig,
  SyncOptions,
  SyncResult,
  HealthStatus,
  AdapterMetrics,
} from "./base/IEnterpriseAdapter";
