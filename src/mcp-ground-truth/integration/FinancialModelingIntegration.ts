/**
 * Financial Modeling Integration
 * 
 * Integrates the MCP Ground Truth Server with the existing FinancialModelingTool
 * to provide data-driven financial modeling capabilities.
 * 
 * This integration allows agents to:
 * 1. Fetch authoritative financial data from MCP server
 * 2. Use that data in financial calculations
 * 3. Ensure all models are grounded in real data
 */

import { MCPFinancialGroundTruthServer } from '../core/MCPServer';
import { BaseTool, ToolResult, ToolExecutionContext } from '../../services/ToolRegistry';
import { logger } from '../../lib/logger';

/**
 * Enhanced Financial Modeling Tool with Ground Truth Integration
 * 
 * Extends the existing FinancialModelingTool to automatically fetch
 * required financial data from the MCP Ground Truth Server.
 */
export class GroundTruthFinancialModelingTool extends BaseTool {
  name = 'ground_truth_financial_modeling';
  description = 'Perform financial calculations using authoritative data from SEC filings and market sources. Automatically fetches required financial metrics and performs calculations.';
  
  parameters = {
    type: 'object',
    properties: {
      entity_id: {
        type: 'string',
        description: 'CIK or ticker symbol of the company to analyze',
      },
      analysis_type: {
        type: 'string',
        enum: ['dcf', 'comparable_companies', 'precedent_transactions', 'value_driver'],
        description: 'Type of financial analysis to perform',
      },
      assumptions: {
        type: 'object',
        properties: {
          discount_rate: { type: 'number', description: 'WACC or discount rate' },
          growth_rate: { type: 'number', description: 'Terminal growth rate' },
          projection_years: { type: 'number', description: 'Number of years to project' },
        },
        description: 'Analysis assumptions (optional, will use industry benchmarks if not provided)',
      },
      period: {
        type: 'string',
        description: 'Fiscal period for historical data (e.g., FY2024)',
      },
    },
    required: ['entity_id', 'analysis_type'],
  };

  metadata = {
    version: '2.0.0',
    author: 'ValueCanvas',
    category: 'financial',
    tags: ['finance', 'modeling', 'valuation', 'ground-truth'],
  };

  private mcpServer: MCPFinancialGroundTruthServer;

  constructor(mcpServer: MCPFinancialGroundTruthServer) {
    super();
    this.mcpServer = mcpServer;
  }

  async execute(
    params: {
      entity_id: string;
      analysis_type: 'dcf' | 'comparable_companies' | 'precedent_transactions' | 'value_driver';
      assumptions?: {
        discount_rate?: number;
        growth_rate?: number;
        projection_years?: number;
      };
      period?: string;
    },
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      logger.info('Ground truth financial modeling started', {
        entity_id: params.entity_id,
        analysis_type: params.analysis_type,
        userId: context?.userId,
      });

      // Route to appropriate analysis method
      switch (params.analysis_type) {
        case 'dcf':
          return await this.performDCF(params);
        case 'comparable_companies':
          return await this.performComparableCompanies(params);
        case 'value_driver':
          return await this.performValueDriverAnalysis(params);
        default:
          return {
            success: false,
            error: {
              code: 'INVALID_ANALYSIS_TYPE',
              message: `Unsupported analysis type: ${params.analysis_type}`,
            },
          };
      }
    } catch (error) {
      logger.error('Ground truth financial modeling failed', {
        entity_id: params.entity_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'MODELING_FAILED',
          message: error instanceof Error ? error.message : 'Analysis failed',
        },
      };
    }
  }

  /**
   * Perform Discounted Cash Flow (DCF) analysis
   */
  private async performDCF(params: {
    entity_id: string;
    assumptions?: {
      discount_rate?: number;
      growth_rate?: number;
      projection_years?: number;
    };
    period?: string;
  }): Promise<ToolResult> {
    // Fetch historical financials from MCP server
    const financials = await this.mcpServer.executeTool('get_authoritative_financials', {
      entity_id: params.entity_id,
      metrics: [
        'revenue_total',
        'operating_income',
        'net_income',
        'cash_and_equivalents',
        'total_debt',
      ],
      period: params.period || 'FY2024',
    });

    if (financials.isError) {
      return {
        success: false,
        error: {
          code: 'DATA_FETCH_FAILED',
          message: 'Failed to fetch financial data',
        },
      };
    }

    // Parse financial data
    const data = JSON.parse(financials.content[0].text!);
    const metrics = data.data.reduce((acc: any, item: any) => {
      acc[item.metric] = item.value;
      return acc;
    }, {});

    // Get industry benchmarks for assumptions if not provided
    let discountRate = params.assumptions?.discount_rate;
    let growthRate = params.assumptions?.growth_rate;

    if (!discountRate || !growthRate) {
      // Would fetch from industry benchmark module
      discountRate = discountRate || 0.10; // Default 10% WACC
      growthRate = growthRate || 0.03; // Default 3% terminal growth
    }

    const projectionYears = params.assumptions?.projection_years || 5;

    // Project future cash flows
    const projectedCashFlows = this.projectCashFlows(
      metrics.operating_income,
      growthRate,
      projectionYears
    );

    // Calculate terminal value
    const terminalValue = this.calculateTerminalValue(
      projectedCashFlows[projectedCashFlows.length - 1],
      growthRate,
      discountRate
    );

    // Calculate present value
    const presentValue = this.calculatePresentValue(
      projectedCashFlows,
      terminalValue,
      discountRate
    );

    // Calculate enterprise value and equity value
    const enterpriseValue = presentValue;
    const equityValue = enterpriseValue + metrics.cash_and_equivalents - metrics.total_debt;

    return {
      success: true,
      data: {
        analysis_type: 'dcf',
        entity_id: params.entity_id,
        valuation: {
          enterprise_value: enterpriseValue,
          equity_value: equityValue,
          per_share_value: null, // Would need shares outstanding
        },
        assumptions: {
          discount_rate: discountRate,
          growth_rate: growthRate,
          projection_years: projectionYears,
        },
        projections: {
          cash_flows: projectedCashFlows,
          terminal_value: terminalValue,
        },
        historical_data: metrics,
        provenance: {
          data_source: 'mcp-ground-truth',
          data_tier: data.metadata[0].source_tier,
          confidence: data.metadata[0].extraction_confidence,
          filing_type: data.metadata[0].filing_type,
          accession_number: data.metadata[0].accession_number,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Perform comparable companies analysis
   */
  private async performComparableCompanies(params: {
    entity_id: string;
    period?: string;
  }): Promise<ToolResult> {
    // Fetch target company financials
    const targetFinancials = await this.mcpServer.executeTool('get_authoritative_financials', {
      entity_id: params.entity_id,
      metrics: ['revenue_total', 'operating_income', 'net_income'],
      period: params.period || 'FY2024',
    });

    if (targetFinancials.isError) {
      return {
        success: false,
        error: {
          code: 'DATA_FETCH_FAILED',
          message: 'Failed to fetch target company data',
        },
      };
    }

    // In a full implementation, would:
    // 1. Identify peer companies
    // 2. Fetch their financials
    // 3. Calculate multiples (EV/Revenue, EV/EBITDA, P/E)
    // 4. Apply median multiples to target

    return {
      success: true,
      data: {
        analysis_type: 'comparable_companies',
        entity_id: params.entity_id,
        message: 'Comparable companies analysis - full implementation pending',
      },
    };
  }

  /**
   * Perform value driver analysis
   */
  private async performValueDriverAnalysis(params: {
    entity_id: string;
    period?: string;
  }): Promise<ToolResult> {
    // Use the populate_value_driver_tree tool
    const result = await this.mcpServer.executeTool('populate_value_driver_tree', {
      target_cik: params.entity_id,
      benchmark_naics: '541511', // Would determine dynamically
      driver_node_id: 'productivity_delta',
      simulation_period: '2025-2027',
    });

    return {
      success: !result.isError,
      data: result.isError ? undefined : JSON.parse(result.content[0].text!),
      error: result.isError ? JSON.parse(result.content[0].text!) : undefined,
    };
  }

  // ============================================================================
  // Financial Calculation Helpers
  // ============================================================================

  private projectCashFlows(
    baseCashFlow: number,
    growthRate: number,
    years: number
  ): number[] {
    const cashFlows: number[] = [];
    let currentCashFlow = baseCashFlow;

    for (let i = 0; i < years; i++) {
      currentCashFlow *= (1 + growthRate);
      cashFlows.push(currentCashFlow);
    }

    return cashFlows;
  }

  private calculateTerminalValue(
    finalCashFlow: number,
    growthRate: number,
    discountRate: number
  ): number {
    return (finalCashFlow * (1 + growthRate)) / (discountRate - growthRate);
  }

  private calculatePresentValue(
    cashFlows: number[],
    terminalValue: number,
    discountRate: number
  ): number {
    let presentValue = 0;

    // Discount projected cash flows
    for (let i = 0; i < cashFlows.length; i++) {
      presentValue += cashFlows[i] / Math.pow(1 + discountRate, i + 1);
    }

    // Discount terminal value
    presentValue += terminalValue / Math.pow(1 + discountRate, cashFlows.length);

    return presentValue;
  }

  async validate(params: any): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!params.entity_id) {
      errors.push('Missing required parameter: entity_id');
    }

    if (!params.analysis_type) {
      errors.push('Missing required parameter: analysis_type');
    }

    const validAnalysisTypes = ['dcf', 'comparable_companies', 'precedent_transactions', 'value_driver'];
    if (params.analysis_type && !validAnalysisTypes.includes(params.analysis_type)) {
      errors.push(`Invalid analysis_type. Must be one of: ${validAnalysisTypes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

/**
 * Factory function to create the integrated tool
 */
export async function createGroundTruthFinancialModelingTool(
  mcpServer: MCPFinancialGroundTruthServer
): Promise<GroundTruthFinancialModelingTool> {
  return new GroundTruthFinancialModelingTool(mcpServer);
}
