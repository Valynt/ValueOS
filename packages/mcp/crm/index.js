/**
 * MCP CRM Server
 *
 * Provides LLM tool access to CRM data via tenant-level OAuth connections.
 * Supports HubSpot and Salesforce with bi-directional sync.
 *
 * Usage:
 * ```typescript
 * import { getMCPCRMServer, getContextInjectionBridge, CRM_TOOLS } from './mcp-crm';
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
 *
 * // Context Injection - Connect CRM to Financial Templates
 * const bridge = await getContextInjectionBridge(tenantId, userId);
 * const templateData = await bridge.injectIntoTemplate(dealId);
 * // templateData.dataSource is ready for Trinity Dashboard, Impact Cascade, etc.
 * ```
 */
// Core
export { MCPCRMServer, getMCPCRMServer, CRM_TOOLS } from './core/MCPCRMServer';
// Context Injection Bridge (CRM → Ground Truth Engine → Templates)
export { ContextInjectionBridge, getContextInjectionBridge, } from './core/ContextInjectionBridge';
// Modules
export { HubSpotModule } from './modules/HubSpotModule';
export { SalesforceModule } from './modules/SalesforceModule';
//# sourceMappingURL=index.js.map