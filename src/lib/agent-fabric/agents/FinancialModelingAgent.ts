import { BaseAgent } from './BaseAgent';
import { FinancialModel } from '../types';

export interface FinancialModelingInput {
  value_case_id: string;
  kpi_hypotheses: any[];
  cost_breakdown: any;
}

export interface FinancialModelingOutput {
  financial_model: Omit<FinancialModel, 'id' | 'created_at' | 'updated_at'>;
}

export class FinancialModelingAgent extends BaseAgent {
  async execute(
    sessionId: string,
    input: FinancialModelingInput
  ): Promise<FinancialModelingOutput> {
    const startTime = Date.now();

    const prompt = `You are a financial modeling expert. Calculate ROI, NPV, and payback period.

KPI HYPOTHESES:
${JSON.stringify(input.kpi_hypotheses, null, 2)}

COST BREAKDOWN:
${JSON.stringify(input.cost_breakdown, null, 2)}

Calculate:
1. Total Investment (sum of all costs)
2. Total Benefit (3-year value from KPI improvements)
3. ROI % = ((Total Benefit - Total Investment) / Total Investment) * 100
4. NPV (use 10% discount rate)
5. Payback Period in months

Return ONLY valid JSON:
{
  "total_investment": <number>,
  "total_benefit": <number>,
  "roi_percentage": <number>,
  "npv_amount": <number>,
  "payback_months": <number>,
  "cost_breakdown": {
    "software": <number>,
    "implementation": <number>,
    "training": <number>,
    "support": <number>
  },
  "benefit_breakdown": {
    "year_1": <number>,
    "year_2": <number>,
    "year_3": <number>,
    "by_kpi": {
      "<kpi_name>": <value>
    }
  },
  "sensitivity_analysis": {
    "pessimistic": {"roi": <number>, "payback_months": <number>},
    "realistic": {"roi": <number>, "payback_months": <number>},
    "optimistic": {"roi": <number>, "payback_months": <number>}
  },
  "confidence_level": "<high|medium|low>",
  "assumptions": ["<assumption1>", "<assumption2>"],
  "reasoning": "<calculation methodology and key assumptions>"
}`;

    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are a financial analyst. Perform accurate ROI, NPV, and payback calculations with clear assumptions.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.2,
      max_tokens: 2000
    });

    const parsed = this.extractJSON(response.content);

    const durationMs = Date.now() - startTime;

    await this.logMetric(sessionId, 'tokens_used', response.tokens_used, 'tokens');
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logPerformanceMetric(sessionId, 'financial_modeling_execute', durationMs, {
      calculations: parsed.calculations?.length || 0,
    });

    await this.logExecution(
      sessionId,
      'financial_modeling',
      input,
      parsed,
      parsed.reasoning,
      parsed.confidence_level,
      [{
        type: 'financial_calculation',
        roi: parsed.roi_percentage,
        npv: parsed.npv_amount,
        payback: parsed.payback_months
      }]
    );

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `ROI: ${parsed.roi_percentage}%, NPV: $${(parsed.npv_amount / 1000000).toFixed(2)}M, Payback: ${parsed.payback_months} months`,
      { financial_model: parsed }
    );

    return {
      financial_model: {
        value_case_id: input.value_case_id,
        roi_percentage: parsed.roi_percentage,
        npv_amount: parsed.npv_amount,
        payback_months: parsed.payback_months,
        total_investment: parsed.total_investment,
        total_benefit: parsed.total_benefit,
        cost_breakdown: parsed.cost_breakdown,
        benefit_breakdown: parsed.benefit_breakdown,
        sensitivity_analysis: parsed.sensitivity_analysis,
        confidence_level: parsed.confidence_level
      }
    };
  }
}
