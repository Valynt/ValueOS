/**
 * @valueos/integrations
 *
 * Enterprise integration adapters for ValueOS.
 *
 * Active adapters: HubSpot, Salesforce, ServiceNow, SharePoint, Slack.
 */

export * from "./base/index.js";
export { HubSpotAdapter } from "./hubspot/index.js";
export {
  SalesforceAdapter,
  SalesforceOAuth,
  SalesforceOpportunityFetcher,
} from "./salesforce/index.js";
export type {
  SalesforceOAuthConfig,
  AuthorizationUrlResult,
  TokenExchangeResult,
  TokenRefreshResult,
  SalesforceOpportunity,
  OpportunityFetchOptions,
  ValueCaseInput,
} from "./salesforce/index.js";
export { ServiceNowAdapter } from "./servicenow/index.js";
export { SharePointAdapter } from "./sharepoint/index.js";
export { SlackAdapter } from "./slack/index.js";
