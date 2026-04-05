/**
 * ValyntApp MCP CRM surface.
 *
 * Canonical MCP CRM runtime now lives under packages/mcp/crm.
 */

// App adapter around canonical core runtime
export { MCPCRMServer, getMCPCRMServer, CRM_TOOLS } from "./core/MCPCRMServer";

// Canonical bridge implementation
export {
  ContextInjectionBridge,
  getContextInjectionBridge,
  type NormalizedDealContext,
  type ContextInjectionOptions,
  type InjectedTemplateData,
} from "../../../../packages/mcp/crm/index.ts";

// Canonical modules
export { HubSpotModule, SalesforceModule } from "../../../../packages/mcp/crm/index.ts";

// Canonical shared types
export type {
  CRMProvider,
  CRMConnection,
  CRMDeal,
  CRMContact,
  CRMCompany,
  CRMActivity,
  CRMModule,
  MCPCRMConfig,
  MCPCRMToolResult,
  DealSearchParams,
  DealSearchResult,
} from "../mcp-common";
