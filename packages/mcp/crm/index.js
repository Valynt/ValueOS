"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesforceModule = exports.HubSpotModule = exports.getContextInjectionBridge = exports.ContextInjectionBridge = exports.CRM_TOOLS = exports.getMCPCRMServer = exports.MCPCRMServer = void 0;
// Core
var MCPCRMServer_1 = require("./core/MCPCRMServer");
Object.defineProperty(exports, "MCPCRMServer", { enumerable: true, get: function () { return MCPCRMServer_1.MCPCRMServer; } });
Object.defineProperty(exports, "getMCPCRMServer", { enumerable: true, get: function () { return MCPCRMServer_1.getMCPCRMServer; } });
Object.defineProperty(exports, "CRM_TOOLS", { enumerable: true, get: function () { return MCPCRMServer_1.CRM_TOOLS; } });
// Context Injection Bridge (CRM → Ground Truth Engine → Templates)
var ContextInjectionBridge_1 = require("./core/ContextInjectionBridge");
Object.defineProperty(exports, "ContextInjectionBridge", { enumerable: true, get: function () { return ContextInjectionBridge_1.ContextInjectionBridge; } });
Object.defineProperty(exports, "getContextInjectionBridge", { enumerable: true, get: function () { return ContextInjectionBridge_1.getContextInjectionBridge; } });
// Modules
var HubSpotModule_1 = require("./modules/HubSpotModule");
Object.defineProperty(exports, "HubSpotModule", { enumerable: true, get: function () { return HubSpotModule_1.HubSpotModule; } });
var SalesforceModule_1 = require("./modules/SalesforceModule");
Object.defineProperty(exports, "SalesforceModule", { enumerable: true, get: function () { return SalesforceModule_1.SalesforceModule; } });
//# sourceMappingURL=index.js.map