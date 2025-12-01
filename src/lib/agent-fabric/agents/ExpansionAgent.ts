/**
 * Expansion Agent
 *
 * VOS Lifecycle Stage: EXPANSION
 *
 * Detects upsell and expansion opportunities based on realization performance.
 *
 * Responsibilities:
 * - Analyze realization reports for expansion opportunities
 * - Identify gaps between current and potential value
 * - Model incremental value from additional capabilities
 * - Score expansion opportunities by confidence and impact
 * - Generate executive summaries for upsell conversations
 */

import { BaseAgent } from './BaseAgent';
import { ValueFabricService } from '../../../services/ValueFabricService';
import type {
  ExpansionModel,
  ExpansionImprovement,
  ValueTree,
  RealizationReport,
  Capability,
  ExpansionAgentInput,
  ExpansionAgentOutput
} from '../../../types/vos';

import { AgentConfig } from '../../../types/agent';

export class ExpansionAgent extends BaseAgent {
  private valueFabricService: ValueFabricService;

  public lifecycleStage = 'expansion';
  public version = '1.0';
  public name = 'Expansion Agent';

  constructor(config: AgentConfig) {
    super(config);
    if (!config.supabase) {
      throw new Error("Supabase client is required for ExpansionAgent");
    }
    this.valueFabricService = new ValueFabricService(config.supabase);
  }

  async execute(
    sessionId: string,
    input: ExpansionAgentInput
  ): Promise<ExpansionAgentOutput> {
    const startTime = Date.now();

    const realizationReport = await this.getRealizationReport(input.realizationReportId);

    const valueTree = await this.getValueTree(input.currentValueTree.id);

    const currentCapabilities = await this.getCurrentCapabilities(input.currentValueTree.id);

    const allCapabilities = await this.valueFabricService.getCapabilities();

    const unusedCapabilities = allCapabilities.filter(
      cap => !currentCapabilities.find(c => c.id === cap.id)
    );

    const prompt = `You are an expansion opportunity analyst identifying upsell and cross-sell opportunities.

CURRENT VALUE TREE:
${JSON.stringify(valueTree, null, 2)}

CURRENT CAPABILITIES IN USE:
${JSON.stringify(currentCapabilities.map(c => c.name), null, 2)}

REALIZATION PERFORMANCE:
${JSON.stringify(realizationReport.metadata, null, 2)}

AVAILABLE CAPABILITIES (Not Yet Deployed):
${JSON.stringify(unusedCapabilities.slice(0, 20).map(c => ({ name: c.name, description: c.description })), null, 2)}

Your task is to identify expansion opportunities:
1. **Gap Analysis**: Where are they not meeting targets? What capabilities could help?
2. **Value Expansion**: What additional value could be unlocked with more capabilities?
3. **Optimization**: What current processes could be further improved?
4. **New Use Cases**: What adjacent workflows could benefit from the solution?

Return ONLY valid JSON:
{
  "expansion_model": {
    "name": "<descriptive name for this expansion opportunity>",
    "opportunity_type": "upsell|cross_sell|optimization|expansion",
    "estimated_value": 50000,
    "confidence_score": 0.75
  },
  "proposed_improvements": [
    {
      "kpi_name": "<KPI that would improve>",
      "current_value": 100,
      "proposed_value": 150,
      "incremental_value": 50,
      "unit": "<unit>",
      "confidence": 0.8,
      "rationale": "<why this improvement is achievable>",
      "required_capability": "<capability name needed>"
    }
  ],
  "executive_summary": "<compelling narrative for expansion conversation>",
  "recommended_capabilities": [
    {
      "capability_name": "<name>",
      "value_proposition": "<how it helps>",
      "implementation_effort": "<low|medium|high>"
    }
  ],
  "opportunity_score": 85,
  "confidence_level": "<high|medium|low>",
  "reasoning": "<your analytical process>"
}`;

    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are an expansion opportunity expert. You analyze customer performance data to identify high-value upsell and cross-sell opportunities with quantified business cases.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.5,
      max_tokens: 3000
    });

    const parsed = this.extractJSON(response.content);

    const expansionModel: Omit<ExpansionModel, 'id' | 'created_at' | 'updated_at'> = {
      value_case_id: input.valueCaseId,
      value_tree_id: input.currentValueTree.id,
      realization_report_id: input.realizationReportId,
      name: parsed.expansion_model.name,
      executive_summary: parsed.executive_summary,
      opportunity_type: parsed.expansion_model.opportunity_type,
      estimated_value: parsed.expansion_model.estimated_value,
      confidence_score: parsed.expansion_model.confidence_score,
      status: 'proposed'
    };

    const expansionImprovements: Array<Omit<ExpansionImprovement, 'id' | 'expansion_model_id' | 'created_at'>> =
      parsed.proposed_improvements.map((imp: any) => ({
        kpi_hypothesis_id: '',
        kpi_name: imp.kpi_name,
        current_value: imp.current_value,
        proposed_value: imp.proposed_value,
        incremental_value: imp.incremental_value,
        unit: imp.unit,
        confidence: imp.confidence,
        rationale: imp.rationale
      }));

    const durationMs = Date.now() - startTime;

    await this.logMetric(sessionId, 'tokens_used', response.tokens_used, 'tokens');
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logMetric(sessionId, 'opportunity_score', parsed.opportunity_score, 'score');
    await this.logMetric(sessionId, 'estimated_value', parsed.expansion_model.estimated_value, 'USD');
    await this.logPerformanceMetric(sessionId, 'expansion_execute', durationMs, {
      improvements: expansionImprovements.length,
      opportunity_score: parsed.opportunity_score,
    });

    await this.logExecution(
      sessionId,
      'expansion_opportunity_analysis',
      input,
      {
        opportunity_type: parsed.expansion_model.opportunity_type,
        estimated_value: parsed.expansion_model.estimated_value,
        improvements_count: expansionImprovements.length
      },
      parsed.reasoning,
      parsed.confidence_level,
      [{
        type: 'expansion_analysis',
        model: response.model,
        tokens: response.tokens_used
      }]
    );

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Expansion Opportunity: ${parsed.expansion_model.name} - $${parsed.expansion_model.estimated_value.toLocaleString()}`,
      {
        opportunity_type: parsed.expansion_model.opportunity_type,
        confidence_score: parsed.expansion_model.confidence_score
      }
    );

    return {
      expansionModel: expansionModel as ExpansionModel,
      expansionImprovements: expansionImprovements as ExpansionImprovement[],
      opportunityScore: parsed.opportunity_score,
      executiveSummary: parsed.executive_summary
    };
  }

  private async getRealizationReport(reportId: string): Promise<RealizationReport> {
    const { data, error } = await this.supabase
      .from('realization_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getValueTree(valueTreeId: string): Promise<ValueTree> {
    const { data, error } = await this.supabase
      .from('value_trees')
      .select('*')
      .eq('id', valueTreeId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getCurrentCapabilities(valueTreeId: string): Promise<Capability[]> {
    const { data: nodes } = await this.supabase
      .from('value_tree_nodes')
      .select('reference_id')
      .eq('value_tree_id', valueTreeId)
      .eq('type', 'capability');

    if (!nodes || nodes.length === 0) return [];

    const capabilityIds = nodes
      .map(n => n.reference_id)
      .filter((id): id is string => id !== null && id !== undefined);

    if (capabilityIds.length === 0) return [];

    const { data: capabilities } = await this.supabase
      .from('capabilities')
      .select('*')
      .in('id', capabilityIds);

    return capabilities || [];
  }

  /**
   * Persist expansion model and improvements
   */
  async persistExpansionModel(
    output: ExpansionAgentOutput,
    realizationReportId: string,
    sessionId?: string
  ): Promise<string> {
    const { data: modelData, error: modelError } = await this.supabase
      .from('expansion_models')
      .insert(output.expansionModel)
      .select()
      .single();

    if (modelError) throw new Error(`Failed to create expansion model: ${modelError.message}`);

    const expansionModelId = modelData.id;

    if (sessionId) {
      await this.logArtifactProvenance(sessionId, 'expansion_model', expansionModelId, 'artifact_created', {
        artifact_data: {
          opportunity_score: output.opportunityScore,
          executive_summary: output.executiveSummary,
        },
      });

      await this.recordLifecycleLink(sessionId, {
        source_type: 'realization_report',
        source_id: realizationReportId,
        target_type: 'expansion_model',
        target_id: expansionModelId,
        relationship_type: 'expansion',
        reasoning_trace: 'Expansion model generated from realized value outcomes',
        chain_depth: 4,
        metadata: { stage: 'expansion' }
      });
    }

    for (const improvement of output.expansionImprovements) {
      await this.supabase
        .from('expansion_improvements')
        .insert({
          ...improvement,
          expansion_model_id: expansionModelId
        });

      if (sessionId) {
        await this.logArtifactProvenance(sessionId, 'expansion_improvement', expansionModelId, 'improvement_added', {
          artifact_data: {
            kpi_name: improvement.kpi_name,
            incremental_value: improvement.incremental_value,
            proposed_value: improvement.proposed_value,
          },
        });
      }
    }

    return expansionModelId;
  }
}
