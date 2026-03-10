/**
 * @valueos/integrations
 *
 * Enterprise integration adapters for ValueOS.
 *
 * Active adapters: HubSpot, Salesforce.
 * Scaffolded (NOT_IMPLEMENTED): ServiceNow, SharePoint, Slack — see DEBT-008.
 */

export * from "./base/index.js";
export { HubSpotAdapter } from "./hubspot/index.js";
export { SalesforceAdapter } from "./salesforce/index.js";
