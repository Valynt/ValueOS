/**
 * MCP Tools for LLM Function Calling
 * 
 * Defines the tools that LLMs can call to fetch ground truth financial data
 * and CRM data (HubSpot, Salesforce).
 */

import type { LLMTool } from '../lib/agent-fabric/llm-types';
import { mcpGroundTruthService } from './MCPGroundTruthService';
import { getMCPCRMServer, CRM_TOOLS } from '../mcp-crm';
import { logger } from '../lib/logger';

// ============================================================================
// Tool Definitions
// ============================================================================

export const MCP_TOOLS: LLMTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_company_financials',
      description: 'Fetch authoritative financial data for a public company from SEC filings. Use this when you need actual revenue, income, margins, or other financial metrics.',
      parameters: {
        type: 'object',
        properties: {
          ticker_or_cik: {
            type: 'string',
            description: 'Stock ticker symbol (e.g., "AAPL") or CIK number',
          },
          metrics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Financial metrics to retrieve. Options: revenue, netIncome, operatingIncome, totalAssets, operatingMargin, grossMargin, ebitda',
            default: ['revenue', 'netIncome', 'operatingMargin'],
          },
          period: {
            type: 'string',
            description: 'Fiscal period (e.g., "FY2024", "Q3-2024", "latest")',
            default: 'latest',
          },
        },
        required: ['ticker_or_cik'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_industry_benchmarks',
      description: 'Fetch industry benchmark data for comparison. Use this to compare a company against industry peers.',
      parameters: {
        type: 'object',
        properties: {
          industry_code: {
            type: 'string',
            description: 'NAICS industry code (e.g., "5112" for software publishers)',
          },
          metrics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Metrics to get benchmarks for',
          },
        },
        required: ['industry_code', 'metrics'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_financial_claim',
      description: 'Verify a specific financial claim against authoritative sources. Use this to fact-check numbers before including them.',
      parameters: {
        type: 'object',
        properties: {
          company: {
            type: 'string',
            description: 'Company ticker or name',
          },
          metric: {
            type: 'string',
            description: 'The financial metric (e.g., "revenue")',
          },
          claimed_value: {
            type: 'number',
            description: 'The value to verify',
          },
          period: {
            type: 'string',
            description: 'The period for the claim',
          },
        },
        required: ['company', 'metric', 'claimed_value'],
      },
    },
  },
];

// ============================================================================
// Tool Executor
// ============================================================================

/**
 * Execute an MCP tool call
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_company_financials': {
        const data = await mcpGroundTruthService.getFinancialData({
          entityId: args.ticker_or_cik,
          metrics: args.metrics,
          period: args.period,
          includeIndustryBenchmarks: true,
        });

        if (!data) {
          return JSON.stringify({
            success: false,
            error: 'Could not retrieve financial data. The company may be private or data unavailable.',
          });
        }

        return JSON.stringify({
          success: true,
          company: data.entityName,
          period: data.period,
          metrics: data.metrics,
          benchmarks: data.industryBenchmarks,
          sources: data.sources,
        });
      }

      case 'get_industry_benchmarks': {
        const benchmarks = await mcpGroundTruthService.getIndustryBenchmarks(
          args.industry_code,
          args.metrics
        );

        if (!benchmarks) {
          return JSON.stringify({
            success: false,
            error: 'Could not retrieve industry benchmarks.',
          });
        }

        return JSON.stringify({
          success: true,
          industry_code: args.industry_code,
          benchmarks,
        });
      }

      case 'verify_financial_claim': {
        const result = await mcpGroundTruthService.verifyClaim({
          entityId: args.company,
          metric: args.metric,
          value: args.claimed_value,
          period: args.period,
        });

        return JSON.stringify({
          success: true,
          verified: result.verified,
          actual_value: result.actualValue,
          deviation_percent: result.deviation,
          confidence: result.confidence,
          source: result.source,
        });
      }

      default:
        return JSON.stringify({
          success: false,
          error: `Unknown tool: ${toolName}`,
        });
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    });
  }
}

// ============================================================================
// CRM Tool Executor
// ============================================================================

// Cached CRM server instance
let crmServerInstance: Awaited<ReturnType<typeof getMCPCRMServer>> | null = null;

/**
 * Execute a CRM tool call
 */
async function executeCRMTool(
  toolName: string,
  args: Record<string, unknown>,
  tenantId: string,
  userId: string
): Promise<string> {
  try {
    // Get or create CRM server instance
    if (!crmServerInstance) {
      crmServerInstance = await getMCPCRMServer(tenantId, userId);
    }

    const result = await crmServerInstance.executeTool(toolName, args);
    return JSON.stringify(result);
  } catch (error) {
    logger.error('CRM tool execution failed', error instanceof Error ? error : undefined);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'CRM tool execution failed',
    });
  }
}

// ============================================================================
// Combined Tool Functions
// ============================================================================

/**
 * Get all available tools based on context
 */
export async function getAllTools(
  tenantId?: string,
  userId?: string
): Promise<LLMTool[]> {
  const tools: LLMTool[] = [...MCP_TOOLS];

  // Add CRM tools if tenant context is available
  if (tenantId && userId) {
    try {
      const crmServer = await getMCPCRMServer(tenantId, userId);
      if (crmServer.isConnected()) {
        // CRM_TOOLS already has the right format
        tools.push(...CRM_TOOLS as LLMTool[]);
      }
    } catch {
      // CRM not available, continue without CRM tools
    }
  }

  return tools;
}

/**
 * Create a tool executor that handles both MCP and CRM tools
 */
export function createToolExecutor(
  tenantId?: string,
  userId?: string
): (toolName: string, args: Record<string, unknown>) => Promise<string> {
  return async (toolName: string, args: Record<string, unknown>): Promise<string> => {
    // Check if it's a CRM tool
    if (toolName.startsWith('crm_') && tenantId && userId) {
      return executeCRMTool(toolName, args, tenantId, userId);
    }

    // Otherwise use standard MCP tool executor
    return executeMCPTool(toolName, args as Record<string, any>);
  };
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Check if MCP tools should be enabled
 */
export function isMCPToolsEnabled(): boolean {
  // Enable if MCP service is available
  return mcpGroundTruthService.isAvailable();
}

/**
 * Check if CRM tools are available for a tenant
 */
export async function isCRMToolsEnabled(tenantId: string, userId: string): Promise<boolean> {
  try {
    const crmServer = await getMCPCRMServer(tenantId, userId);
    return crmServer.isConnected();
  } catch {
    return false;
  }
}
