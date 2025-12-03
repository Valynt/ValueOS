/**
 * Opportunity Agent
 *
 * VOS Lifecycle Stage: OPPORTUNITY
 *
 * Discovers customer pain and maps capabilities to outcomes during the value opportunity stage.
 *
 * Responsibilities:
 * - Analyze discovery data (transcripts, notes, emails)
 * - Identify pain points and quantify impact
 * - Map buyer persona to product capabilities
 * - Generate business objectives
 * - Create initial value hypothesis
 * - Recommend relevant capabilities from Value Fabric
 */

import { logger } from '../../../lib/logger';
import { BaseAgent } from './BaseAgent';
import { ValueFabricService } from '../../../services/ValueFabricService';
import type {
  BusinessObjective,
  Capability,
  OpportunityAgentInput,
  OpportunityAgentOutput
} from '../../../types/vos';

import { AgentConfig } from '../../../types/agent';


export class OpportunityAgent extends BaseAgent {
  private valueFabricService: ValueFabricService;

  public lifecycleStage = 'opportunity';
  public version = '1.0';
  public name = 'Opportunity Agent';

  constructor(config: AgentConfig) {
    super(config);
    if (!config.supabase) {
      throw new Error("Supabase client is required for OpportunityAgent");
    }
    this.valueFabricService = new ValueFabricService(config.supabase);
  }

  async execute(
    sessionId: string,
    input: OpportunityAgentInput
  ): Promise<OpportunityAgentOutput> {
    const startTime = Date.now();

    const discoveryText = input.discoveryData.join('\n\n---\n\n');

    const companyContext = JSON.stringify(input.customerProfile, null, 2);

    const prompt = `You are a value discovery specialist analyzing customer discovery data.

CUSTOMER PROFILE:
${companyContext}

DISCOVERY DATA (call transcripts, emails, notes):
${discoveryText}

Your task is to perform deep opportunity analysis and output:

1. **Opportunity Summary**: A concise executive summary of the value opportunity
2. **Persona Fit**: How well this persona aligns with our solution (0-1 score)
3. **Business Objectives**: 3-5 strategic goals this customer is trying to achieve
4. **Pain Points**: Quantified pain points with financial impact estimates
5. **Initial Value Model**: Preliminary value hypothesis with outcomes and KPIs

Return ONLY valid JSON in this exact format:
{
  "opportunity_summary": "<executive summary of the opportunity>",
  "persona_fit": {
    "score": 0.85,
    "role": "<their role>",
    "seniority": "<level>",
    "decision_authority": "<low|medium|high>",
    "fit_reasoning": "<why this persona is a good fit>"
  },
  "business_objectives": [
    {
      "name": "<objective name>",
      "description": "<detailed description>",
      "priority": 1,
      "owner": "<stakeholder>"
    }
  ],
  "pain_points": [
    {
      "category": "<efficiency|cost|revenue|risk>",
      "description": "<what the pain point is>",
      "severity": "<high|medium|low>",
      "frequency": "<how often it occurs>",
      "estimated_annual_cost": 50000,
      "affected_stakeholders": ["<stakeholder1>", "<stakeholder2>"]
    }
  ],
  "initial_value_model": {
    "outcomes": [
      {
        "name": "<outcome name>",
        "description": "<what changes>",
        "measurement": "<how to measure>",
        "timeframe": "<when impact is realized>"
      }
    ],
    "kpis": [
      {
        "name": "<KPI name>",
        "baseline": 100,
        "target": 150,
        "unit": "<unit>",
        "measurement_type": "percentage|currency|time|count"
      }
    ],
    "financial_impact": {
      "revenue_opportunity": 100000,
      "cost_savings": 50000,
      "risk_reduction": 25000,
      "total_value": 175000,
      "confidence_level": "medium"
    }
  },
  "recommended_capability_tags": ["automation", "analytics", "integration"],
  "confidence_level": "<high|medium|low>",
  "reasoning": "<your analysis reasoning>"
}`;

    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are an expert value discovery agent. You analyze customer conversations and extract actionable business intelligence, pain points, and value opportunities. Always quantify impact where possible.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.4,
      max_tokens: 3000
    });

    const parsed = await this.extractJSON(response.content);

    // Ensure required arrays exist with defaults
    const painPoints = parsed.pain_points || [];
    const businessObjectives = parsed.business_objectives || [];
    const recommendedCapabilityTags = parsed.recommended_capability_tags || [];

    const capabilities = await this.findRelevantCapabilities(
      recommendedCapabilityTags,
      painPoints.map((p: any) => p.description).join(' ')
    );

    const durationMs = Date.now() - startTime;

    await this.logMetric(sessionId, 'tokens_used', response.tokens_used, 'tokens');
    await this.logMetric(sessionId, 'latency_ms', durationMs, 'ms');
    await this.logMetric(sessionId, 'pain_points_identified', painPoints.length, 'count');
    await this.logMetric(sessionId, 'capabilities_matched', capabilities.length, 'count');
    await this.logPerformanceMetric(sessionId, 'opportunity_execute', durationMs, {
      discovery_documents: input.discoveryData.length,
      matched_capabilities: capabilities.length,
    });

    await this.logExecution(
      sessionId,
      'opportunity_analysis',
      input,
      {
        ...parsed,
        recommended_capabilities: capabilities.map(c => c.name)
      },
      parsed.reasoning,
      parsed.confidence_level,
      [{
        type: 'llm_analysis',
        model: response.model,
        tokens: response.tokens_used
      }]
    );

    await this.memorySystem.storeSemanticMemory(
      sessionId,
      this.agentId,
      `Opportunity: ${parsed.opportunity_summary}`,
      {
        persona_fit: parsed.persona_fit,
        business_objectives: businessObjectives,
        pain_points: parsed.pain_points
      }
    );

    return {
      opportunitySummary: parsed.opportunity_summary,
      personaFit: parsed.persona_fit,
      initialValueModel: parsed.initial_value_model,
      businessObjectives,
      recommendedCapabilities: capabilities
    };
  }

  /**
   * Find relevant capabilities from Value Fabric based on tags and semantic search
   */
  private async findRelevantCapabilities(
    tags: string[],
    contextText: string
  ): Promise<Capability[]> {
    let capabilities: Capability[] = [];

    if (tags.length > 0) {
      const byTags = await this.valueFabricService.getCapabilities({ tags });
      capabilities.push(...byTags);
    }

    if (capabilities.length < 5 && contextText) {
      try {
        const semanticResults = await this.valueFabricService.semanticSearchCapabilities(
          contextText,
          5
        );
        const semanticCapabilities = semanticResults.map(r => r.item);

        capabilities.push(...semanticCapabilities.filter(
          sc => !capabilities.find(c => c.id === sc.id)
        ));
      } catch (error) {
        logger.warn('Semantic search failed, using tag-based results only:', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return capabilities.slice(0, 10);
  }

  /**
   * Persist business objectives to database
   */
  async persistBusinessObjectives(
    valueCaseId: string,
    objectives: Array<Omit<BusinessObjective, 'id' | 'value_case_id' | 'created_at' | 'updated_at'>>,
    sessionId?: string
  ): Promise<BusinessObjective[]> {
    if (!this.supabase) {
      throw new Error('Supabase client is required for persistBusinessObjectives');
    }

    const results: BusinessObjective[] = [];

    for (const objective of objectives) {
      const { data, error } = await this.supabase
        .from('business_objectives')
        .insert({
          value_case_id: valueCaseId,
          ...objective
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to persist business objective:', error);
        continue;
      }

      results.push(data);

      if (sessionId) {
        await this.logArtifactProvenance(sessionId, 'business_objective', data.id, 'artifact_created', {
          artifact_data: {
            value_case_id: valueCaseId,
            objective: objective,
          },
          reasoning_trace: 'Captured during opportunity analysis with linked discovery context',
        });

        await this.recordLifecycleLink(sessionId, {
          source_type: 'value_case',
          source_id: valueCaseId,
          target_type: 'business_objective',
          target_id: data.id,
          relationship_type: 'opportunity_to_target',
          reasoning_trace: 'Objective captured during opportunity analysis'
        });
      }
    }

    return results;
  }
}
