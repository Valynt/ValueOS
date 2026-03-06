import { LoopResultSchema, ValueHypothesisSchema } from '@valueos/agents/orchestration';

import { supabase } from '../lib/supabase.js';
import { CanvasComponent } from '../types';

interface AgentFabricResult {
  value_case_id: string;
  company_profile: { company_name: string; industry: string };
  value_maps: Array<{ feature: string; capability: string; business_outcome: string; value_driver: string }>;
  kpi_hypotheses: Array<{ kpi_name: string; target_value: number }>;
  financial_model: {
    roi_percentage: number;
    npv_amount: number;
    payback_months: number;
    cost_breakdown: Record<string, number>;
  };
  assumptions: Array<{ name: string; value: string }>;
  quality_score: number;
  execution_metadata: {
    execution_id: string;
    iteration_count: number;
    total_tokens: number;
    total_latency_ms: number;
    agent_contributions: Record<string, unknown>;
    loop_contract_valid: boolean;
  };
}

export class AgentFabricService {
  async generateValueCase(userInput: string): Promise<{
    result: AgentFabricResult;
    canvasComponents: CanvasComponent[];
  }> {
    const result = this.buildAgentFabricResult(userInput);

    const canvasComponents = this.convertToCanvasComponents(result);

    return { result, canvasComponents };
  }


  private buildAgentFabricResult(userInput: string): AgentFabricResult {
    const hypothesis = ValueHypothesisSchema.parse({
      id: 'hyp-1',
      description: userInput,
      confidence: 0.8,
      category: 'opportunity',
      estimatedValue: 100000,
    });

    const loopContract = LoopResultSchema.safeParse({
      valueCaseId: 'value-case-preview',
      tenantId: 'preview-tenant',
      hypotheses: [hypothesis],
      valueTree: null,
      evidenceBundle: null,
      narrative: null,
      objections: [],
      revisionCount: 0,
      finalState: 'DRAFT',
      success: true,
    });

    return {
      value_case_id: 'value-case-preview',
      company_profile: { company_name: 'Prospect', industry: 'Unknown' },
      value_maps: [],
      kpi_hypotheses: [{ kpi_name: 'Conversion Rate', target_value: 5 }],
      financial_model: {
        roi_percentage: 15,
        npv_amount: 1500000,
        payback_months: 12,
        cost_breakdown: { implementation: 500000, operations: 250000 },
      },
      assumptions: [],
      quality_score: 12,
      execution_metadata: {
        execution_id: 'preview-exec',
        iteration_count: 1,
        total_tokens: 0,
        total_latency_ms: 0,
        agent_contributions: { opportunity: hypothesis },
        loop_contract_valid: loopContract.success,
      },
    };
  }

  private convertToCanvasComponents(result: AgentFabricResult): CanvasComponent[] {
    const components: CanvasComponent[] = [];
    let xPosition = 50;
    let yPosition = 50;

    components.push({
      id: crypto.randomUUID(),
      type: 'metric-card',
      position: { x: xPosition, y: yPosition },
      size: { width: 300, height: 120 },
      props: {
        title: 'ROI',
        value: `${result.financial_model.roi_percentage?.toFixed(0)}%`,
        trend: 'up' as const,
        change: 'Projected'
      }
    });

    xPosition += 350;

    components.push({
      id: crypto.randomUUID(),
      type: 'metric-card',
      position: { x: xPosition, y: yPosition },
      size: { width: 300, height: 120 },
      props: {
        title: 'Net Present Value',
        value: `$${((result.financial_model.npv_amount || 0) / 1000000).toFixed(2)}M`,
        trend: 'up' as const,
        change: '3-year projection'
      }
    });

    xPosition += 350;

    components.push({
      id: crypto.randomUUID(),
      type: 'metric-card',
      position: { x: xPosition, y: yPosition },
      size: { width: 300, height: 120 },
      props: {
        title: 'Payback Period',
        value: `${result.financial_model.payback_months} months`,
        trend: 'neutral' as const,
        change: 'Time to break even'
      }
    });

    yPosition += 180;
    xPosition = 50;

    if (result.kpi_hypotheses && result.kpi_hypotheses.length > 0) {
      const kpiData = result.kpi_hypotheses.map((kpi, index) => ({
        name: kpi.kpi_name,
        value: kpi.target_value || 0,
        id: `kpi-${index}`
      }));

      components.push({
        id: crypto.randomUUID(),
        type: 'interactive-chart',
        position: { x: xPosition, y: yPosition },
        size: { width: 500, height: 300 },
        props: {
          title: 'Key Performance Indicators',
          data: kpiData,
          type: 'bar' as const,
          config: { showValue: true }
        }
      });

      xPosition += 550;
    }

    if (result.financial_model.cost_breakdown) {
      const costData = Object.entries(result.financial_model.cost_breakdown).map(([key, value], index) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: value as number,
        id: `cost-${index}`
      }));

      components.push({
        id: crypto.randomUUID(),
        type: 'interactive-chart',
        position: { x: xPosition, y: yPosition },
        size: { width: 450, height: 300 },
        props: {
          title: 'Cost Breakdown',
          data: costData,
          type: 'pie' as const,
          config: { showValue: true, showLegend: true }
        }
      });
    }

    yPosition += 350;
    xPosition = 50;

    if (result.value_maps && result.value_maps.length > 0) {
      const valueMapRows = result.value_maps.map(vm => [
        vm.feature,
        vm.capability,
        vm.business_outcome,
        vm.value_driver.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
      ]);

      components.push({
        id: crypto.randomUUID(),
        type: 'data-table',
        position: { x: xPosition, y: yPosition },
        size: { width: 900, height: 250 },
        props: {
          title: 'Value Chain Analysis',
          headers: ['Feature', 'Capability', 'Business Outcome', 'Value Driver'],
          rows: valueMapRows,
          editableColumns: []
        }
      });
    }

    yPosition += 300;

    components.push({
      id: crypto.randomUUID(),
      type: 'narrative-block',
      position: { x: xPosition, y: yPosition },
      size: { width: 900, height: 180 },
      props: {
        title: 'Executive Summary',
        content: `Value case for ${result.company_profile.company_name} in the ${result.company_profile.industry} sector. The analysis projects an ROI of ${result.financial_model.roi_percentage?.toFixed(0)}% with a payback period of ${result.financial_model.payback_months} months. Quality score: ${result.quality_score}/18.`,
        isEditable: true
      }
    });

    return components;
  }

  async getValueCaseById(valueCaseId: string): Promise<AgentFabricResult | null> {
    const { data: valueCase } = await supabase
      .from('value_cases')
      .select('*')
      .eq('id', valueCaseId)
      .single();

    if (!valueCase) return null;

    const [
      { data: companyProfile },
      { data: valueMaps },
      { data: kpiHypotheses },
      { data: financialModel },
      { data: assumptions },
    ] = await Promise.all([
      supabase.from('company_profiles').select('*').eq('value_case_id', valueCaseId).single(),
      supabase.from('value_maps').select('*').eq('value_case_id', valueCaseId),
      supabase.from('kpi_hypotheses').select('*').eq('value_case_id', valueCaseId),
      supabase.from('financial_models').select('*').eq('value_case_id', valueCaseId).single(),
      supabase.from('assumptions').select('*').eq('value_case_id', valueCaseId),
    ]);

    return {
      value_case_id: valueCaseId,
      company_profile: companyProfile,
      value_maps: valueMaps || [],
      kpi_hypotheses: kpiHypotheses || [],
      financial_model: financialModel,
      assumptions: assumptions || [],
      quality_score: valueCase.quality_score || 0,
      execution_metadata: {
        execution_id: '',
        iteration_count: 0,
        total_tokens: 0,
        total_latency_ms: 0,
        agent_contributions: {}
      }
    };
  }
}

export const agentFabricService = new AgentFabricService();
