import { AgentFabric, AgentFabricResult } from '../lib/agent-fabric';
import { CanvasComponent } from '../types';
import { supabase } from '../lib/supabase';

export class AgentFabricService {
  private fabric: AgentFabric;
  private initialized: boolean = false;

  constructor() {
    this.fabric = new AgentFabric(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      'together'
    );
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.fabric.initialize();
      this.initialized = true;
    }
  }

  async generateValueCase(userInput: string): Promise<{
    result: AgentFabricResult;
    canvasComponents: CanvasComponent[];
  }> {
    await this.initialize();

    const result = await this.fabric.processUserInput(userInput);

    const canvasComponents = this.convertToCanvasComponents(result);

    return { result, canvasComponents };
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

    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('value_case_id', valueCaseId)
      .single();

    const { data: valueMaps } = await supabase
      .from('value_maps')
      .select('*')
      .eq('value_case_id', valueCaseId);

    const { data: kpiHypotheses } = await supabase
      .from('kpi_hypotheses')
      .select('*')
      .eq('value_case_id', valueCaseId);

    const { data: financialModel } = await supabase
      .from('financial_models')
      .select('*')
      .eq('value_case_id', valueCaseId)
      .single();

    const { data: assumptions } = await supabase
      .from('assumptions')
      .select('*')
      .eq('value_case_id', valueCaseId);

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
