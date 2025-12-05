/**
 * MCP CRM Server
 * 
 * Provides LLM tool access to CRM data via tenant-level OAuth connections.
 * Supports HubSpot and Salesforce.
 * 
 * Usage:
 * ```typescript
 * import { getMCPCRMServer, CRM_TOOLS } from './mcp-crm';
 * 
 * // Get server instance for a tenant
 * const crmServer = await getMCPCRMServer(tenantId, userId);
 * 
 * // Check if connected
 * if (crmServer.isConnected()) {
 *   // Get available tools for LLM
 *   const tools = crmServer.getTools();
 *   
 *   // Execute a tool
 *   const result = await crmServer.executeTool('crm_search_deals', {
 *     company_name: 'Acme Corp'
 *   });
 * }
 * ```
 */

// Core
export { MCPCRMServer, getMCPCRMServer, CRM_TOOLS } from './core/MCPCRMServer';

// Modules
export { HubSpotModule } from './modules/HubSpotModule';
export { SalesforceModule } from './modules/SalesforceModule';

// Types
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
} from './types';
