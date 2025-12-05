/**
 * TargetAgent
 * 
 * Designs targeted interventions from system maps and connects
 * them to KPIs and value models. Part of the ValueCanvas Framework.
 * 
 * SEC-004: Uses secure logger to prevent sensitive data leakage
 */

import { logger } from '../lib/logger';
import type {
  SystemMap,
  InterventionPoint,
  LeveragePoint,
  OutcomePathway,
  InterventionDependency,
  InterventionRisk,
  InterventionType,
} from '../types/sof';

/**
 * Agent input for target intervention design
 */
export interface TargetInput {
  organizationId: string;
  systemMap: SystemMap;
  kpis: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    unit: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  constraints?: {
    budget?: number;
    timeframe?: string;
    resources?: string[];
  };
  preferences?: {
    riskTolerance?: 'low' | 'medium' | 'high';
    preferredTypes?: InterventionType[];
  };
}

/**
 * Agent output with target interventions
 */
export interface TargetOutput {
  interventionPoints: Array<Omit<InterventionPoint, 'id' | 'created_at' | 'updated_at'>>;
  sduiLayout: {
    type: 'InterventionDesignPage';
    components: Array<{
      type: string;
      props: Record<string, any>;
    }>;
  };
  analysis: {
    totalInterventions: number;
    highLeverageCount: number;
    estimatedImpact: string;
    recommendedSequence: string[];
    riskSummary: string;
  };
  confidence: number;
}

/**
 * TargetAgent class
 */
export class TargetAgent {
  private agentId = 'target-v1';
  private agentName = 'Target Agent';

  /**
   * Design interventions from system map
   */
  async design(input: TargetInput): Promise<TargetOutput> {
    logger.debug('Designing interventions', {
      agent: this.agentName,
      organizationId: input.organizationId,
    });

    // Analyze leverage points from system map
    const leverageAnalysis = this.analyzeLeveragePoints(input.systemMap.leverage_points, input.kpis);

    // Design interventions for each leverage point
    const interventionPoints: Array<Omit<InterventionPoint, 'id' | 'created_at' | 'updated_at'>> = [];

    for (const leverage of input.systemMap.leverage_points) {
      const intervention = this.designIntervention(
        leverage,
        input.systemMap,
        input.kpis,
        input.constraints,
        input.preferences
      );
      if (intervention) {
        interventionPoints.push(intervention);
      }
    }

    // Identify dependencies between interventions
    this.identifyDependencies(interventionPoints);

    // Sort by leverage level and feasibility
    interventionPoints.sort((a, b) => {
      const scoreA = a.leverage_level * this.getFeasibilityScore(a.effort_estimate);
      const scoreB = b.leverage_level * this.getFeasibilityScore(b.effort_estimate);
      return scoreB - scoreA;
    });

    // Generate analysis
    const analysis = this.generateAnalysis(interventionPoints, input.kpis);

    // Generate SDUI layout
    const sduiLayout = this.generateSDUILayout(interventionPoints, analysis);

    // Calculate confidence
    const confidence = this.calculateConfidence(input.systemMap, interventionPoints);

    logger.info('Interventions designed', {
      agent: this.agentName,
      interventionCount: interventionPoints.length,
      confidence,
    });

    return {
      interventionPoints,
      sduiLayout,
      analysis,
      confidence,
    };
  }

  /**
   * Analyze leverage points
   */
  private analyzeLeveragePoints(
    leveragePoints: LeveragePoint[],
    kpis: TargetInput['kpis']
  ) {
    return {
      total: leveragePoints.length,
      highImpact: leveragePoints.filter((lp) => lp.potential_impact >= 8).length,
      lowEffort: leveragePoints.filter((lp) => lp.effort === 'low' || lp.effort === 'medium').length,
      kpiAlignment: this.assessKPIAlignment(leveragePoints, kpis),
    };
  }

  /**
   * Assess KPI alignment
   */
  private assessKPIAlignment(
    leveragePoints: LeveragePoint[],
    kpis: TargetInput['kpis']
  ): number {
    // Simple heuristic: high-priority KPIs with large gaps align well with high-impact leverage points
    const criticalKPIs = kpis.filter((kpi) => kpi.priority === 'critical' || kpi.priority === 'high');
    const highImpactLeverage = leveragePoints.filter((lp) => lp.potential_impact >= 7);

    return Math.min(1.0, (criticalKPIs.length * highImpactLeverage.length) / 10);
  }

  /**
   * Design intervention from leverage point
   */
  private designIntervention(
    leveragePoint: LeveragePoint,
    systemMap: SystemMap,
    kpis: TargetInput['kpis'],
    constraints?: TargetInput['constraints'],
    preferences?: TargetInput['preferences']
  ): Omit<InterventionPoint, 'id' | 'created_at' | 'updated_at'> | null {
    // Determine intervention type
    const interventionType = this.determineInterventionType(leveragePoint);

    // Skip if not in preferred types
    if (preferences?.preferredTypes && !preferences.preferredTypes.includes(interventionType)) {
      return null;
    }

    // Find target entity/relationship
    const target = this.findTarget(leveragePoint, systemMap);

    // Map to KPIs
    const outcomePathways = this.mapToKPIs(leveragePoint, kpis, systemMap);

    // Assess risks
    const risks = this.assessRisks(leveragePoint, interventionType, systemMap, preferences?.riskTolerance);

    // Check constraints
    if (constraints && !this.meetsConstraints(leveragePoint, constraints)) {
      return null;
    }

    return {
      organization_id: systemMap.organization_id,
      system_map_id: systemMap.id,
      name: this.generateInterventionName(leveragePoint, interventionType),
      description: this.generateInterventionDescription(leveragePoint, interventionType, target),
      intervention_type: interventionType,
      target_entity_id: target.entityId,
      target_relationship_id: target.relationshipId,
      leverage_level: leveragePoint.potential_impact,
      effort_estimate: leveragePoint.effort,
      time_to_impact: this.estimateTimeToImpact(leveragePoint, interventionType),
      outcome_pathways: outcomePathways,
      dependencies: [],
      risks,
      status: 'proposed',
      validation_notes: null,
      created_by: systemMap.created_by,
      approved_by: null,
      approved_at: null,
    };
  }

  /**
   * Determine intervention type from leverage point
   */
  private determineInterventionType(leveragePoint: LeveragePoint): InterventionType {
    const typeMap: Record<string, InterventionType> = {
      high_connectivity_node: 'leverage_point',
      constraint_removal: 'constraint_removal',
      goal_alignment: 'goal_alignment',
      feedback_loop: 'feedback_amplification',
      information_gap: 'information_flow',
      process_bottleneck: 'structure_change',
      rule_conflict: 'rule_change',
    };

    return typeMap[leveragePoint.type] || 'leverage_point';
  }

  /**
   * Find target entity/relationship
   */
  private findTarget(leveragePoint: LeveragePoint, systemMap: SystemMap) {
    // Location might be entity ID or constraint ID
    const entity = systemMap.entities.find((e) => e.id === leveragePoint.location);
    const constraint = systemMap.constraints.find((c) => c.id === leveragePoint.location);

    return {
      entityId: entity?.id || null,
      relationshipId: null, // Could be enhanced to target specific relationships
      name: entity?.name || constraint?.description || leveragePoint.location,
    };
  }

  /**
   * Map leverage point to KPI outcomes
   */
  private mapToKPIs(
    leveragePoint: LeveragePoint,
    kpis: TargetInput['kpis'],
    systemMap: SystemMap
  ): OutcomePathway[] {
    const pathways: OutcomePathway[] = [];

    // Find KPIs connected to this leverage point
    const connectedKPIs = this.findConnectedKPIs(leveragePoint, systemMap, kpis);

    for (const kpi of connectedKPIs) {
      const gap = kpi.target - kpi.current;
      const expectedDelta = this.estimateKPIDelta(leveragePoint, kpi, gap);

      pathways.push({
        kpi_id: kpi.id,
        expected_delta: expectedDelta,
        confidence: this.calculatePathwayConfidence(leveragePoint, kpi),
        timeframe: this.estimateTimeframe(leveragePoint),
        assumptions: [
          'Intervention is implemented as designed',
          'No significant external disruptions',
          'Stakeholder buy-in is achieved',
        ],
      });
    }

    return pathways;
  }

  /**
   * Find KPIs connected to leverage point
   */
  private findConnectedKPIs(
    leveragePoint: LeveragePoint,
    systemMap: SystemMap,
    kpis: TargetInput['kpis']
  ) {
    // Find KPI entities in system map
    const kpiEntities = systemMap.entities.filter((e) => e.type === 'kpi');

    // Match with input KPIs
    const connectedKPIs = kpis.filter((kpi) => {
      const kpiEntity = kpiEntities.find((e) => e.name === kpi.name);
      if (!kpiEntity) return false;

      // Check if there's a path from leverage point to this KPI
      return this.hasPath(leveragePoint.location, kpiEntity.id, systemMap.relationships);
    });

    // If no direct connections, use high-priority KPIs
    if (connectedKPIs.length === 0) {
      return kpis.filter((kpi) => kpi.priority === 'critical' || kpi.priority === 'high').slice(0, 2);
    }

    return connectedKPIs;
  }

  /**
   * Check if path exists between two nodes
   */
  private hasPath(from: string, to: string, relationships: SystemMap['relationships']): boolean {
    const visited = new Set<string>();
    const queue = [from];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) return true;
      if (visited.has(current)) continue;

      visited.add(current);

      const neighbors = relationships
        .filter((r) => r.from === current)
        .map((r) => r.to);

      queue.push(...neighbors);

      // Limit search depth
      if (visited.size > 20) break;
    }

    return false;
  }

  /**
   * Estimate KPI delta from intervention
   */
  private estimateKPIDelta(
    leveragePoint: LeveragePoint,
    _kpi: TargetInput['kpis'][0],
    gap: number
  ): number {
    // Impact factor based on leverage level
    const impactFactor = leveragePoint.potential_impact / 10;

    // Estimate percentage of gap that can be closed
    const gapClosurePercentage = impactFactor * 0.3; // 30% max closure for high leverage

    return gap * gapClosurePercentage;
  }

  /**
   * Calculate pathway confidence
   */
  private calculatePathwayConfidence(
    leveragePoint: LeveragePoint,
    kpi: TargetInput['kpis'][0]
  ): number {
    let confidence = 0.5;

    // Higher leverage = higher confidence
    confidence += (leveragePoint.potential_impact / 10) * 0.2;

    // Critical KPIs have more scrutiny, slightly lower confidence
    if (kpi.priority === 'critical') confidence -= 0.05;

    // Lower effort = higher confidence in execution
    if (leveragePoint.effort === 'low') confidence += 0.1;
    else if (leveragePoint.effort === 'medium') confidence += 0.05;

    return Math.min(0.95, Math.max(0.3, confidence));
  }

  /**
   * Estimate timeframe
   */
  private estimateTimeframe(leveragePoint: LeveragePoint): string {
    const effortMap = {
      low: '1-3 months',
      medium: '3-6 months',
      high: '6-12 months',
      very_high: '12+ months',
    };

    return effortMap[leveragePoint.effort];
  }

  /**
   * Assess intervention risks
   */
  private assessRisks(
    leveragePoint: LeveragePoint,
    interventionType: InterventionType,
    systemMap: SystemMap,
    riskTolerance?: 'low' | 'medium' | 'high'
  ): InterventionRisk[] {
    const risks: InterventionRisk[] = [];

    // High leverage = higher risk of unintended consequences
    if (leveragePoint.potential_impact >= 8) {
      risks.push({
        risk_type: 'unintended_consequence',
        description: 'High-leverage interventions may have unexpected system-wide effects',
        mitigation: 'Implement in phases with close monitoring',
      });
    }

    // Constraint removal risks
    if (interventionType === 'constraint_removal') {
      risks.push({
        risk_type: 'system_instability',
        description: 'Removing constraints may destabilize dependent processes',
        mitigation: 'Ensure alternative controls are in place',
      });
    }

    // Feedback amplification risks
    if (interventionType === 'feedback_amplification') {
      risks.push({
        risk_type: 'feedback_reversal',
        description: 'Amplified feedback may reverse under different conditions',
        mitigation: 'Monitor feedback loop dynamics continuously',
      });
    }

    // High effort risks
    if (leveragePoint.effort === 'high' || leveragePoint.effort === 'very_high') {
      risks.push({
        risk_type: 'implementation_failure',
        description: 'Complex interventions have higher failure rates',
        mitigation: 'Break into smaller phases, ensure adequate resources',
      });
    }

    return risks;
  }

  /**
   * Check if intervention meets constraints
   */
  private meetsConstraints(
    leveragePoint: LeveragePoint,
    constraints: TargetInput['constraints']
  ): boolean {
    // Timeframe constraint
    if (constraints.timeframe === 'short' && leveragePoint.effort === 'very_high') {
      return false;
    }

    // Budget constraint (simplified)
    if (constraints.budget && leveragePoint.effort === 'very_high') {
      return false;
    }

    return true;
  }

  /**
   * Estimate time to impact
   */
  private estimateTimeToImpact(
    leveragePoint: LeveragePoint,
    interventionType: InterventionType
  ): InterventionPoint['time_to_impact'] {
    // Quick wins
    if (leveragePoint.effort === 'low' && interventionType === 'information_flow') {
      return 'immediate';
    }

    // Short term
    if (leveragePoint.effort === 'low' || leveragePoint.effort === 'medium') {
      return 'short_term';
    }

    // Medium term
    if (leveragePoint.effort === 'high') {
      return 'medium_term';
    }

    // Long term
    return 'long_term';
  }

  /**
   * Generate intervention name
   */
  private generateInterventionName(leveragePoint: LeveragePoint, interventionType: InterventionType): string {
    const typeNames: Record<InterventionType, string> = {
      leverage_point: 'Leverage',
      constraint_removal: 'Remove Constraint',
      feedback_amplification: 'Amplify Feedback',
      feedback_dampening: 'Dampen Feedback',
      structure_change: 'Restructure',
      goal_alignment: 'Align Goals',
      information_flow: 'Improve Information Flow',
      rule_change: 'Update Rules',
      paradigm_shift: 'Shift Paradigm',
    };

    return `${typeNames[interventionType]}: ${leveragePoint.description?.substring(0, 50) || leveragePoint.location}`;
  }

  /**
   * Generate intervention description
   */
  private generateInterventionDescription(
    leveragePoint: LeveragePoint,
    interventionType: InterventionType,
    target: { name: string | null }
  ): string {
    return `${leveragePoint.description || 'Intervention'} targeting ${target.name || 'system element'}. ` +
      `Type: ${interventionType}. ` +
      `Rationale: ${leveragePoint.rationale || 'High-leverage opportunity for system improvement.'}`;
  }

  /**
   * Identify dependencies between interventions
   */
  private identifyDependencies(
    interventionPoints: Array<Omit<InterventionPoint, 'id' | 'created_at' | 'updated_at'>>
  ): void {
    // Simple dependency logic: constraint removal should come before structure changes
    for (let i = 0; i < interventionPoints.length; i++) {
      for (let j = 0; j < interventionPoints.length; j++) {
        if (i === j) continue;

        const intervention = interventionPoints[i];
        const other = interventionPoints[j];

        // Constraint removal enables other interventions
        if (
          intervention.intervention_type === 'constraint_removal' &&
          other.intervention_type !== 'constraint_removal'
        ) {
          // Add as prerequisite (would need IDs in real implementation)
          // other.dependencies.push({ intervention_id: 'TBD', dependency_type: 'prerequisite' });
        }

        // Information flow improvements enable other changes
        if (
          intervention.intervention_type === 'information_flow' &&
          other.leverage_level > intervention.leverage_level
        ) {
          // Add as prerequisite
        }
      }
    }
  }

  /**
   * Get feasibility score
   */
  private getFeasibilityScore(effort: InterventionPoint['effort_estimate']): number {
    const scores = {
      low: 1.0,
      medium: 0.8,
      high: 0.5,
      very_high: 0.3,
    };
    return scores[effort];
  }

  /**
   * Generate analysis
   */
  private generateAnalysis(
    interventionPoints: Array<Omit<InterventionPoint, 'id' | 'created_at' | 'updated_at'>>,
    kpis: TargetInput['kpis']
  ) {
    const highLeverage = interventionPoints.filter((ip) => ip.leverage_level >= 8);
    const totalRisks = interventionPoints.reduce((sum, ip) => sum + ip.risks.length, 0);

    // Calculate estimated impact
    const totalExpectedDelta = interventionPoints.reduce((sum, ip) => {
      return sum + ip.outcome_pathways.reduce((s, op) => s + Math.abs(op.expected_delta), 0);
    }, 0);

    // Recommended sequence
    const sequence = interventionPoints
      .slice(0, 5)
      .map((ip) => ip.name);

    return {
      totalInterventions: interventionPoints.length,
      highLeverageCount: highLeverage.length,
      estimatedImpact: `${totalExpectedDelta.toFixed(1)} aggregate KPI improvement`,
      recommendedSequence: sequence,
      riskSummary: `${totalRisks} risks identified across all interventions`,
    };
  }

  /**
   * Generate SDUI layout
   */
  private generateSDUILayout(
    interventionPoints: Array<Omit<InterventionPoint, 'id' | 'created_at' | 'updated_at'>>,
    analysis: TargetOutput['analysis']
  ) {
    return {
      type: 'InterventionDesignPage' as const,
      components: [
        {
          type: 'InterventionSummaryCard',
          props: {
            totalInterventions: analysis.totalInterventions,
            highLeverageCount: analysis.highLeverageCount,
            estimatedImpact: analysis.estimatedImpact,
            riskSummary: analysis.riskSummary,
          },
        },
        {
          type: 'InterventionSequenceTimeline',
          props: {
            sequence: analysis.recommendedSequence,
            title: 'Recommended Implementation Sequence',
          },
        },
        {
          type: 'InterventionPointsList',
          props: {
            interventions: interventionPoints.slice(0, 10),
            sortBy: 'leverage_level',
            showRisks: true,
          },
        },
        {
          type: 'OutcomePathwayMatrix',
          props: {
            interventions: interventionPoints,
            title: 'Intervention → KPI Impact Matrix',
          },
        },
      ],
    };
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    systemMap: SystemMap,
    interventionPoints: Array<Omit<InterventionPoint, 'id' | 'created_at' | 'updated_at'>>
  ): number {
    let confidence = 0.6; // Base confidence

    // More leverage points analyzed = higher confidence
    if (systemMap.leverage_points.length >= 5) confidence += 0.1;

    // Good coverage of leverage points
    const coverage = interventionPoints.length / Math.max(1, systemMap.leverage_points.length);
    confidence += Math.min(0.15, coverage * 0.15);

    // Validated system map = higher confidence
    if (systemMap.status === 'validated') confidence += 0.1;

    return Math.min(0.95, confidence);
  }
}

/**
 * Export singleton instance
 */
export const targetAgent = new TargetAgent();
