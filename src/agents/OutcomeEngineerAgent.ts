/**
 * OutcomeEngineerAgent
 * 
 * Builds systemic outcome hypotheses that bridge system changes to KPI deltas
 * and value stories. Part of the Systemic Outcome Framework (SOF).
 */

import type {
  SystemMap,
  InterventionPoint,
  OutcomeHypothesis,
  KPIDelta,
  CausalChainStep,
  HypothesisAssumption,
  HypothesisType,
} from '../types/sof';

/**
 * Agent input for outcome engineering
 */
export interface OutcomeEngineerInput {
  organizationId: string;
  systemMap: SystemMap;
  interventionPoint: InterventionPoint;
  kpis: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    unit: string;
    measurement_method?: string;
  }>;
  context?: {
    industry?: string;
    stakeholders?: string[];
    timeframe?: string;
  };
}

/**
 * Agent output with outcome hypotheses
 */
export interface OutcomeEngineerOutput {
  outcomeHypotheses: Array<Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'>>;
  sduiLayout: {
    type: 'OutcomeEngineeringPage';
    components: Array<{
      type: string;
      props: Record<string, any>;
    }>;
  };
  insights: {
    primaryHypothesis: string;
    causalPathways: number;
    criticalAssumptions: string[];
    validationApproach: string;
    confidenceLevel: string;
  };
  confidence: number;
}

/**
 * OutcomeEngineerAgent class
 */
export class OutcomeEngineerAgent {
  private agentId = 'outcome-engineer-v1';
  private agentName = 'Outcome Engineer';

  /**
   * Engineer outcome hypotheses
   */
  async engineer(input: OutcomeEngineerInput): Promise<OutcomeEngineerOutput> {
    console.log(`[${this.agentName}] Engineering outcome hypotheses...`);

    const hypotheses: Array<Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'>> = [];

    // Create primary hypothesis (direct impact)
    const primaryHypothesis = this.createPrimaryHypothesis(input);
    hypotheses.push(primaryHypothesis);

    // Create secondary hypotheses (indirect impacts, systemic changes)
    const secondaryHypotheses = this.createSecondaryHypotheses(input);
    hypotheses.push(...secondaryHypotheses);

    // Create feedback loop hypothesis if applicable
    const feedbackHypothesis = this.createFeedbackHypothesis(input);
    if (feedbackHypothesis) {
      hypotheses.push(feedbackHypothesis);
    }

    // Generate insights
    const insights = this.generateInsights(hypotheses, input);

    // Generate SDUI layout
    const sduiLayout = this.generateSDUILayout(hypotheses, insights);

    // Calculate confidence
    const confidence = this.calculateConfidence(input, hypotheses);

    console.log(`[${this.agentName}] Created ${hypotheses.length} outcome hypotheses. Confidence: ${confidence}`);

    return {
      outcomeHypotheses: hypotheses,
      sduiLayout,
      insights,
      confidence,
    };
  }

  /**
   * Create primary hypothesis (direct impact)
   */
  private createPrimaryHypothesis(
    input: OutcomeEngineerInput
  ): Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'> {
    // Build hypothesis statement
    const hypothesisStatement = this.buildHypothesisStatement(
      input.interventionPoint,
      input.interventionPoint.outcome_pathways,
      'direct'
    );

    // Build system change description
    const systemChangeDescription = this.buildSystemChangeDescription(
      input.interventionPoint,
      input.systemMap
    );

    // Map to KPI deltas
    const kpiDeltas = this.mapToKPIDeltas(input.interventionPoint.outcome_pathways, input.kpis);

    // Build value story
    const valueStory = this.buildValueStory(input.interventionPoint, kpiDeltas, input.context);

    // Build causal chain
    const causalChain = this.buildCausalChain(input.interventionPoint, input.systemMap, kpiDeltas);

    // Identify assumptions
    const assumptions = this.identifyAssumptions(input.interventionPoint, input.systemMap);

    // Determine validation method
    const validationMethod = this.determineValidationMethod(input.interventionPoint, kpiDeltas);

    return {
      organization_id: input.organizationId,
      system_map_id: input.systemMap.id,
      intervention_point_id: input.interventionPoint.id,
      hypothesis_statement: hypothesisStatement,
      hypothesis_type: 'direct_impact',
      system_change_description: systemChangeDescription,
      kpi_deltas: kpiDeltas,
      value_story: valueStory,
      causal_chain: causalChain,
      assumptions,
      status: 'draft',
      validation_method: validationMethod,
      validation_criteria: this.buildValidationCriteria(kpiDeltas),
      validation_results: null,
      confidence_score: this.calculateHypothesisConfidence(causalChain, assumptions),
      evidence_quality: 'observational',
      created_by: input.interventionPoint.created_by,
      validated_by: null,
      validated_at: null,
    };
  }

  /**
   * Create secondary hypotheses (indirect impacts)
   */
  private createSecondaryHypotheses(
    input: OutcomeEngineerInput
  ): Array<Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'>> {
    const hypotheses: Array<Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'>> = [];

    // Identify indirect impacts through system relationships
    const indirectImpacts = this.identifyIndirectImpacts(input.interventionPoint, input.systemMap);

    for (const impact of indirectImpacts.slice(0, 2)) {
      // Limit to 2 secondary hypotheses
      const hypothesis = this.createIndirectHypothesis(input, impact);
      hypotheses.push(hypothesis);
    }

    return hypotheses;
  }

  /**
   * Create feedback loop hypothesis
   */
  private createFeedbackHypothesis(
    input: OutcomeEngineerInput
  ): Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'> | null {
    // Check if intervention creates or affects a feedback loop
    const feedbackOpportunity = this.identifyFeedbackOpportunity(input.interventionPoint, input.systemMap);

    if (!feedbackOpportunity) return null;

    const hypothesisStatement = `Implementing ${input.interventionPoint.name} will create a ${feedbackOpportunity.type} feedback loop that ${feedbackOpportunity.effect}`;

    return {
      organization_id: input.organizationId,
      system_map_id: input.systemMap.id,
      intervention_point_id: input.interventionPoint.id,
      hypothesis_statement: hypothesisStatement,
      hypothesis_type: 'feedback_loop',
      system_change_description: feedbackOpportunity.description,
      kpi_deltas: [],
      value_story: `This feedback loop will ${feedbackOpportunity.longTermEffect} over time, creating sustainable value.`,
      causal_chain: feedbackOpportunity.causalChain,
      assumptions: [
        {
          assumption: 'Feedback loop remains stable',
          criticality: 'high',
          validation_method: 'Monitor loop dynamics over time',
        },
        {
          assumption: 'No external disruptions break the loop',
          criticality: 'medium',
          validation_method: 'Environmental scanning',
        },
      ],
      status: 'draft',
      validation_method: 'Longitudinal monitoring of feedback loop metrics',
      validation_criteria: null,
      validation_results: null,
      confidence_score: 0.6,
      evidence_quality: 'observational',
      created_by: input.interventionPoint.created_by,
      validated_by: null,
      validated_at: null,
    };
  }

  /**
   * Build hypothesis statement
   */
  private buildHypothesisStatement(
    intervention: InterventionPoint,
    pathways: InterventionPoint['outcome_pathways'],
    type: 'direct' | 'indirect'
  ): string {
    const impactType = type === 'direct' ? 'will directly improve' : 'will indirectly affect';
    const kpiCount = pathways.length;

    if (kpiCount === 0) {
      return `Implementing ${intervention.name} ${impactType} system performance`;
    }

    if (kpiCount === 1) {
      return `Implementing ${intervention.name} ${impactType} ${pathways[0].expected_delta > 0 ? 'increase' : 'decrease'} in target KPI`;
    }

    return `Implementing ${intervention.name} ${impactType} ${kpiCount} key performance indicators`;
  }

  /**
   * Build system change description
   */
  private buildSystemChangeDescription(intervention: InterventionPoint, systemMap: SystemMap): string {
    const target = systemMap.entities.find((e) => e.id === intervention.target_entity_id);
    const targetName = target?.name || 'system element';

    const typeDescriptions: Record<string, string> = {
      leverage_point: `modifies high-leverage point at ${targetName}`,
      constraint_removal: `removes constraint affecting ${targetName}`,
      feedback_amplification: `amplifies feedback loop involving ${targetName}`,
      feedback_dampening: `dampens feedback loop involving ${targetName}`,
      structure_change: `restructures relationships around ${targetName}`,
      goal_alignment: `aligns goals related to ${targetName}`,
      information_flow: `improves information flow to/from ${targetName}`,
      rule_change: `updates rules governing ${targetName}`,
      paradigm_shift: `shifts paradigm around ${targetName}`,
    };

    const changeType = typeDescriptions[intervention.intervention_type] || 'modifies system';

    return `This intervention ${changeType}, creating cascading effects through connected system elements. ` +
      `The change operates at leverage level ${intervention.leverage_level}/10, indicating ${
        intervention.leverage_level >= 8 ? 'high' : intervention.leverage_level >= 6 ? 'moderate' : 'low'
      } systemic impact.`;
  }

  /**
   * Map to KPI deltas
   */
  private mapToKPIDeltas(
    pathways: InterventionPoint['outcome_pathways'],
    kpis: OutcomeEngineerInput['kpis']
  ): KPIDelta[] {
    return pathways.map((pathway) => {
      const kpi = kpis.find((k) => k.id === pathway.kpi_id);

      return {
        kpi_id: pathway.kpi_id,
        baseline: kpi?.current || 0,
        target: (kpi?.current || 0) + pathway.expected_delta,
        timeframe: pathway.timeframe,
        confidence: pathway.confidence,
        measurement_method: kpi?.measurement_method || 'Standard measurement protocol',
      };
    });
  }

  /**
   * Build value story
   */
  private buildValueStory(
    intervention: InterventionPoint,
    kpiDeltas: KPIDelta[],
    context?: OutcomeEngineerInput['context']
  ): string {
    const industry = context?.industry || 'the organization';
    const timeframe = context?.timeframe || intervention.time_to_impact;

    let story = `In ${industry}, implementing ${intervention.name} will drive measurable value over ${timeframe}. `;

    if (kpiDeltas.length > 0) {
      const primaryDelta = kpiDeltas[0];
      const improvement = ((primaryDelta.target - primaryDelta.baseline) / primaryDelta.baseline * 100).toFixed(1);
      story += `The primary impact will be a ${improvement}% improvement in key metrics. `;
    }

    story += `This systemic change addresses root causes rather than symptoms, creating sustainable value. `;

    if (intervention.leverage_level >= 8) {
      story += `As a high-leverage intervention, the benefits will compound over time through positive feedback effects.`;
    }

    return story;
  }

  /**
   * Build causal chain
   */
  private buildCausalChain(
    intervention: InterventionPoint,
    systemMap: SystemMap,
    kpiDeltas: KPIDelta[]
  ): CausalChainStep[] {
    const chain: CausalChainStep[] = [];

    // Step 1: Intervention implementation
    chain.push({
      step: 1,
      description: `Implement ${intervention.name}`,
      evidence_type: 'implementation_record',
      confidence: 0.9,
    });

    // Step 2: Immediate system change
    const target = systemMap.entities.find((e) => e.id === intervention.target_entity_id);
    chain.push({
      step: 2,
      description: `${target?.name || 'Target element'} behavior changes as designed`,
      evidence_type: 'direct_observation',
      confidence: 0.8,
    });

    // Step 3: Cascading effects
    chain.push({
      step: 3,
      description: 'Changes cascade through connected system elements',
      evidence_type: 'system_monitoring',
      confidence: 0.7,
    });

    // Step 4: KPI impact
    if (kpiDeltas.length > 0) {
      chain.push({
        step: 4,
        description: `KPI metrics shift toward targets`,
        evidence_type: 'measurement',
        confidence: kpiDeltas[0].confidence,
      });
    }

    // Step 5: Value realization
    chain.push({
      step: 5,
      description: 'Business value is realized and sustained',
      evidence_type: 'financial_analysis',
      confidence: 0.6,
    });

    return chain;
  }

  /**
   * Identify assumptions
   */
  private identifyAssumptions(
    intervention: InterventionPoint,
    systemMap: SystemMap
  ): HypothesisAssumption[] {
    const assumptions: HypothesisAssumption[] = [];

    // Implementation assumption
    assumptions.push({
      assumption: 'Intervention can be implemented as designed',
      criticality: 'critical',
      validation_method: 'Feasibility study and pilot testing',
      validated: false,
    });

    // Stakeholder assumption
    assumptions.push({
      assumption: 'Key stakeholders support the change',
      criticality: 'high',
      validation_method: 'Stakeholder interviews and commitment assessment',
      validated: false,
    });

    // System stability assumption
    assumptions.push({
      assumption: 'System structure remains stable during implementation',
      criticality: 'medium',
      validation_method: 'Environmental monitoring',
      validated: false,
    });

    // Measurement assumption
    assumptions.push({
      assumption: 'KPI measurements are accurate and reliable',
      criticality: 'high',
      validation_method: 'Measurement system analysis',
      validated: false,
    });

    // Add intervention-specific assumptions
    if (intervention.intervention_type === 'constraint_removal') {
      assumptions.push({
        assumption: 'Removing constraint does not create new bottlenecks',
        criticality: 'high',
        validation_method: 'System capacity analysis',
        validated: false,
      });
    }

    if (intervention.leverage_level >= 8) {
      assumptions.push({
        assumption: 'High-leverage effects are controllable and beneficial',
        criticality: 'critical',
        validation_method: 'Risk assessment and scenario planning',
        validated: false,
      });
    }

    return assumptions;
  }

  /**
   * Determine validation method
   */
  private determineValidationMethod(
    intervention: InterventionPoint,
    kpiDeltas: KPIDelta[]
  ): string {
    const methods: string[] = [];

    // Always include baseline measurement
    methods.push('Establish baseline measurements for all KPIs');

    // Pilot testing for high-risk interventions
    if (intervention.risks.length > 2 || intervention.leverage_level >= 8) {
      methods.push('Conduct pilot test in controlled environment');
    }

    // A/B testing if feasible
    if (intervention.effort_estimate === 'low' || intervention.effort_estimate === 'medium') {
      methods.push('Consider A/B testing where feasible');
    }

    // Longitudinal monitoring
    methods.push('Monitor KPIs continuously over implementation period');

    // Statistical analysis
    if (kpiDeltas.length > 0) {
      methods.push('Apply statistical analysis to confirm causal relationship');
    }

    return methods.join('. ') + '.';
  }

  /**
   * Build validation criteria
   */
  private buildValidationCriteria(kpiDeltas: KPIDelta[]): Record<string, any> {
    return {
      success_criteria: kpiDeltas.map((delta) => ({
        kpi_id: delta.kpi_id,
        minimum_improvement: delta.target - delta.baseline,
        timeframe: delta.timeframe,
        confidence_threshold: delta.confidence,
      })),
      monitoring_frequency: 'weekly',
      review_milestones: ['30 days', '60 days', '90 days'],
      early_indicators: ['Stakeholder feedback', 'Process metrics', 'Leading indicators'],
    };
  }

  /**
   * Calculate hypothesis confidence
   */
  private calculateHypothesisConfidence(
    causalChain: CausalChainStep[],
    assumptions: HypothesisAssumption[]
  ): number {
    // Average confidence across causal chain
    const chainConfidence = causalChain.reduce((sum, step) => sum + step.confidence, 0) / causalChain.length;

    // Penalty for critical unvalidated assumptions
    const criticalAssumptions = assumptions.filter((a) => a.criticality === 'critical' && !a.validated);
    const assumptionPenalty = criticalAssumptions.length * 0.1;

    return Math.max(0.3, Math.min(0.95, chainConfidence - assumptionPenalty));
  }

  /**
   * Identify indirect impacts
   */
  private identifyIndirectImpacts(
    intervention: InterventionPoint,
    systemMap: SystemMap
  ): Array<{ entity: string; impact: string; pathway: string[] }> {
    const impacts: Array<{ entity: string; impact: string; pathway: string[] }> = [];

    // Find entities 2-3 hops away from intervention target
    const targetId = intervention.target_entity_id;
    if (!targetId) return impacts;

    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; path: string[] }> = [
      { id: targetId, depth: 0, path: [targetId] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth > 3) continue;

      visited.add(current.id);

      // Find connected entities
      const connections = systemMap.relationships.filter((r) => r.from === current.id);

      for (const conn of connections) {
        const entity = systemMap.entities.find((e) => e.id === conn.to);
        if (!entity) continue;

        if (current.depth >= 2 && entity.type === 'kpi') {
          impacts.push({
            entity: entity.name,
            impact: `Indirect effect through ${current.path.length}-step pathway`,
            pathway: [...current.path, entity.id],
          });
        }

        queue.push({
          id: conn.to,
          depth: current.depth + 1,
          path: [...current.path, conn.to],
        });
      }
    }

    return impacts;
  }

  /**
   * Create indirect hypothesis
   */
  private createIndirectHypothesis(
    input: OutcomeEngineerInput,
    impact: { entity: string; impact: string; pathway: string[] }
  ): Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'> {
    return {
      organization_id: input.organizationId,
      system_map_id: input.systemMap.id,
      intervention_point_id: input.interventionPoint.id,
      hypothesis_statement: `${input.interventionPoint.name} will indirectly affect ${impact.entity} through system dynamics`,
      hypothesis_type: 'indirect_impact',
      system_change_description: impact.impact,
      kpi_deltas: [],
      value_story: `Through cascading system effects, this intervention will influence ${impact.entity}, creating additional value beyond direct impacts.`,
      causal_chain: [
        {
          step: 1,
          description: `Intervention affects ${impact.pathway[0]}`,
          evidence_type: 'direct_observation',
          confidence: 0.8,
        },
        {
          step: 2,
          description: `Effects propagate through ${impact.pathway.length - 2} intermediate elements`,
          evidence_type: 'system_monitoring',
          confidence: 0.6,
        },
        {
          step: 3,
          description: `${impact.entity} responds to accumulated changes`,
          evidence_type: 'measurement',
          confidence: 0.5,
        },
      ],
      assumptions: [
        {
          assumption: 'Pathway remains active during implementation',
          criticality: 'medium',
          validation_method: 'System monitoring',
        },
      ],
      status: 'draft',
      validation_method: 'Monitor indirect effects through system telemetry',
      validation_criteria: null,
      validation_results: null,
      confidence_score: 0.5,
      evidence_quality: 'observational',
      created_by: input.interventionPoint.created_by,
      validated_by: null,
      validated_at: null,
    };
  }

  /**
   * Identify feedback opportunity
   */
  private identifyFeedbackOpportunity(
    intervention: InterventionPoint,
    systemMap: SystemMap
  ): {
    type: 'reinforcing' | 'balancing';
    effect: string;
    description: string;
    longTermEffect: string;
    causalChain: CausalChainStep[];
  } | null {
    // Check if intervention creates a loop back to itself
    const targetId = intervention.target_entity_id;
    if (!targetId) return null;

    // Simple check: does target have a path back to itself?
    const hasLoop = this.findLoop(targetId, systemMap.relationships);

    if (hasLoop) {
      return {
        type: 'reinforcing',
        effect: 'amplifies its own effects over time',
        description: 'Creates a reinforcing feedback loop that strengthens the intervention impact',
        longTermEffect: 'compound and accelerate improvements',
        causalChain: [
          {
            step: 1,
            description: 'Intervention creates initial change',
            evidence_type: 'direct_observation',
            confidence: 0.8,
          },
          {
            step: 2,
            description: 'Change propagates through system',
            evidence_type: 'system_monitoring',
            confidence: 0.7,
          },
          {
            step: 3,
            description: 'Effects loop back to reinforce original change',
            evidence_type: 'feedback_analysis',
            confidence: 0.6,
          },
        ],
      };
    }

    return null;
  }

  /**
   * Find loop in relationships
   */
  private findLoop(startId: string, relationships: SystemMap['relationships']): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (stack.has(nodeId)) return true; // Found cycle
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      stack.add(nodeId);

      const neighbors = relationships.filter((r) => r.from === nodeId).map((r) => r.to);

      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      stack.delete(nodeId);
      return false;
    };

    return dfs(startId);
  }

  /**
   * Generate insights
   */
  private generateInsights(
    hypotheses: Array<Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'>>,
    input: OutcomeEngineerInput
  ) {
    const primary = hypotheses.find((h) => h.hypothesis_type === 'direct_impact');
    const causalPathways = hypotheses.reduce((sum, h) => sum + h.causal_chain.length, 0);

    const criticalAssumptions = hypotheses
      .flatMap((h) => h.assumptions)
      .filter((a) => a.criticality === 'critical')
      .map((a) => a.assumption)
      .slice(0, 3);

    return {
      primaryHypothesis: primary?.hypothesis_statement || 'No primary hypothesis',
      causalPathways,
      criticalAssumptions,
      validationApproach: primary?.validation_method || 'Standard validation protocol',
      confidenceLevel: this.getConfidenceLabel(primary?.confidence_score || 0.5),
    };
  }

  /**
   * Get confidence label
   */
  private getConfidenceLabel(score: number): string {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Moderate';
    if (score >= 0.4) return 'Low';
    return 'Very Low';
  }

  /**
   * Generate SDUI layout
   */
  private generateSDUILayout(
    hypotheses: Array<Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'>>,
    insights: OutcomeEngineerOutput['insights']
  ) {
    return {
      type: 'OutcomeEngineeringPage' as const,
      components: [
        {
          type: 'OutcomeHypothesisSummary',
          props: {
            totalHypotheses: hypotheses.length,
            primaryHypothesis: insights.primaryHypothesis,
            confidenceLevel: insights.confidenceLevel,
          },
        },
        {
          type: 'CausalChainVisualization',
          props: {
            hypotheses: hypotheses.slice(0, 3),
            title: 'Causal Pathways: Intervention → Outcome',
          },
        },
        {
          type: 'AssumptionValidationChecklist',
          props: {
            assumptions: hypotheses.flatMap((h) => h.assumptions),
            criticalOnly: true,
          },
        },
        {
          type: 'ValueStoryCard',
          props: {
            story: hypotheses[0]?.value_story || '',
            kpiDeltas: hypotheses[0]?.kpi_deltas || [],
          },
        },
      ],
    };
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    input: OutcomeEngineerInput,
    hypotheses: Array<Omit<OutcomeHypothesis, 'id' | 'created_at' | 'updated_at'>>
  ): number {
    let confidence = 0.6; // Base confidence

    // Validated system map = higher confidence
    if (input.systemMap.status === 'validated') confidence += 0.1;

    // Approved intervention = higher confidence
    if (input.interventionPoint.status === 'approved') confidence += 0.1;

    // Multiple hypotheses with consistent confidence
    const avgHypothesisConfidence =
      hypotheses.reduce((sum, h) => sum + (h.confidence_score || 0.5), 0) / hypotheses.length;
    confidence += avgHypothesisConfidence * 0.2;

    return Math.min(0.95, confidence);
  }
}

/**
 * Export singleton instance
 */
export const outcomeEngineerAgent = new OutcomeEngineerAgent();
