/**
 * Financial Modeling Tool
 * 
 * MCP-compatible tool for complex financial calculations using sandboxed code execution.
 * Enables agents to perform calculations that LLMs struggle with directly.
 */

import { BaseTool, ToolResult, ToolExecutionContext } from '../services/ToolRegistry';
import { financialCalculator } from '../services/SandboxedExecutor';
import { logger } from '../utils/logger';

export class FinancialModelingTool extends BaseTool {
  name = 'financial_modeling';
  description = 'Perform complex financial calculations including NPV, IRR, payback period, and Monte Carlo simulations. Use this for accurate financial analysis.';
  
  parameters = {
    type: 'object',
    properties: {
      calculation: {
        type: 'string',
        enum: ['npv', 'irr', 'payback_period', 'monte_carlo'],
        description: 'Type of financial calculation to perform',
      },
      cashFlows: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of cash flows (required for npv, irr, payback_period)',
      },
      discountRate: {
        type: 'number',
        description: 'Discount rate as decimal (e.g., 0.1 for 10%) (required for npv)',
      },
      initialInvestment: {
        type: 'number',
        description: 'Initial investment amount (required for payback_period)',
      },
      monteCarloParams: {
        type: 'object',
        properties: {
          initialValue: { type: 'number' },
          expectedReturn: { type: 'number' },
          volatility: { type: 'number' },
          periods: { type: 'number' },
          simulations: { type: 'number' },
        },
        description: 'Parameters for Monte Carlo simulation',
      },
    },
    required: ['calculation'],
  };

  metadata = {
    version: '1.0.0',
    author: 'ValueCanvas',
    category: 'financial',
    tags: ['finance', 'modeling', 'calculations'],
    rateLimit: {
      maxCalls: 20,
      windowMs: 60000, // 20 calls per minute
    },
  };

  async execute(
    params: {
      calculation: 'npv' | 'irr' | 'payback_period' | 'monte_carlo';
      cashFlows?: number[];
      discountRate?: number;
      initialInvestment?: number;
      monteCarloParams?: {
        initialValue: number;
        expectedReturn: number;
        volatility: number;
        periods: number;
        simulations: number;
      };
    },
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      logger.info('Financial calculation requested', {
        calculation: params.calculation,
        userId: context?.userId,
      });

      let result: any;

      switch (params.calculation) {
        case 'npv':
          if (!params.cashFlows || !params.discountRate) {
            return {
              success: false,
              error: {
                code: 'MISSING_PARAMETERS',
                message: 'NPV calculation requires cashFlows and discountRate',
              },
            };
          }
          result = await financialCalculator.calculateNPV(
            params.cashFlows,
            params.discountRate
          );
          break;

        case 'irr':
          if (!params.cashFlows) {
            return {
              success: false,
              error: {
                code: 'MISSING_PARAMETERS',
                message: 'IRR calculation requires cashFlows',
              },
            };
          }
          result = await financialCalculator.calculateIRR(params.cashFlows);
          break;

        case 'payback_period':
          if (!params.cashFlows || !params.initialInvestment) {
            return {
              success: false,
              error: {
                code: 'MISSING_PARAMETERS',
                message: 'Payback period calculation requires cashFlows and initialInvestment',
              },
            };
          }
          result = await financialCalculator.calculatePaybackPeriod(
            params.initialInvestment,
            params.cashFlows
          );
          break;

        case 'monte_carlo':
          if (!params.monteCarloParams) {
            return {
              success: false,
              error: {
                code: 'MISSING_PARAMETERS',
                message: 'Monte Carlo simulation requires monteCarloParams',
              },
            };
          }
          result = await financialCalculator.monteCarloSimulation(
            params.monteCarloParams
          );
          break;

        default:
          return {
            success: false,
            error: {
              code: 'INVALID_CALCULATION',
              message: `Unknown calculation type: ${params.calculation}`,
            },
          };
      }

      return {
        success: true,
        data: {
          calculation: params.calculation,
          result,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Financial calculation failed', {
        calculation: params.calculation,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: {
          code: 'CALCULATION_FAILED',
          message: error instanceof Error ? error.message : 'Calculation failed',
        },
      };
    }
  }

  async validate(params: any): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!params.calculation) {
      errors.push('Missing required parameter: calculation');
    }

    if (params.calculation === 'npv') {
      if (!params.cashFlows) errors.push('NPV requires cashFlows');
      if (!params.discountRate) errors.push('NPV requires discountRate');
    }

    if (params.calculation === 'irr') {
      if (!params.cashFlows) errors.push('IRR requires cashFlows');
    }

    if (params.calculation === 'payback_period') {
      if (!params.cashFlows) errors.push('Payback period requires cashFlows');
      if (!params.initialInvestment) errors.push('Payback period requires initialInvestment');
    }

    if (params.calculation === 'monte_carlo') {
      if (!params.monteCarloParams) {
        errors.push('Monte Carlo requires monteCarloParams');
      } else {
        const required = ['initialValue', 'expectedReturn', 'volatility', 'periods', 'simulations'];
        for (const field of required) {
          if (!(field in params.monteCarloParams)) {
            errors.push(`Monte Carlo requires monteCarloParams.${field}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
