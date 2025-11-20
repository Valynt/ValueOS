/**
 * SystemMapperAgent
 * 
 * Performs systems analysis using discovery data to create system maps
 * with leverage points. Outputs SDUI layouts for canvas and model views.
 * 
 * Part of the Systemic Outcome Framework (SOF).
 */

import type {
  SystemMap,
  SystemEntity,
  SystemRelationship,
  SystemConstraint,
  LeveragePoint,
  SystemBoundary,
  ExternalFactor,
} from '../types/sof';

/**
 * Agent input for system mapping
 */
export interface SystemMapperInput {
  organizationId: string;
  businessCaseId?: string;
  discoveryData: {
    stakeholders?: Array<{ name: string; role: string; influence: string }>;
    processes?: Array<{ name: string; inputs: string[]; outputs: string[]; dependencies: string[] }>;
    kpis?: Array<{ name: string; current: number; target: number; owner: string }>;
    constraints?: Array<{ type: string; description: string }>;
    goals?: Array<{ description: string; priority: string }>;
  };
  context?: {
    industry?: string;
    companySize?: string;
    timeframe?: string;
  };
}

/**
 * Agent output with SDUI layout
 */
export interface SystemMapperOutput {
  systemMap: Omit<SystemMap, 'id' | 'created_at' | 'updated_at'>;
  sduiLayout: {
    type: 'SystemOutcomePage';
    components: Array<{
      type: string;
      props: Record<string, any>;
    }>;
  };
  insights: {
    keyLeveragePoints: string[];
    criticalConstraints: string[];
    feedbackLoopOpportunities: string[];
    recommendations: string[];
  };
  confidence: number;
}

/**
 * SystemMapperAgent class
 */
export class SystemMapperAgent {
  private agentId = 'system-mapper-v1';
  private agentName = 'System Mapper';

  /**
   * Analyze discovery data and create system map
   */
  async analyze(input: SystemMapperInput): Promise<SystemMapperOutput> {
    console.log(`[${this.agentName}] Starting system analysis...`);

    // Extract entities from discovery data
    const entities = this.extractEntities(input.discoveryData);

    // Identify relationships
    const relationships = this.identifyRelationships(entities, input.discoveryData);

    // Identify constraints
    const constraints = this.identifyConstraints(input.discoveryData);

    // Identify leverage points
    const leveragePoints = this.identifyLeveragePoints(entities, relationships, constraints);

    // Define system boundaries
    const boundary = this.defineSystemBoundary(entities, input.context);

    // Identify external factors
    const externalFactors = this.identifyExternalFactors(input.context);

    // Determine system type
    const systemType = this.determineSystemType(input.discoveryData, input.context);

    // Build system map
    const systemMap: Omit<SystemMap, 'id' | 'created_at' | 'updated_at'> = {
      organization_id: input.organizationId,
      business_case_id: input.businessCaseId || null,
      name: this.generateSystemName(input.discoveryData, input.context),
      description: this.generateSystemDescription(entities, relationships),
      system_type: systemType,
      entities,
      relationships,
      constraints,
      leverage_points: leveragePoints,
      boundary_definition: boundary,
      external_factors: externalFactors,
      status: 'draft',
      version: 1,
      created_by: input.organizationId, // Will be replaced with actual user ID
      validated_by: null,
      validated_at: null,
    };

    // Generate insights
    const insights = this.generateInsights(systemMap);

    // Generate SDUI layout
    const sduiLayout = this.generateSDUILayout(systemMap, insights);

    // Calculate confidence
    const confidence = this.calculateConfidence(input.discoveryData, entities, relationships);

    console.log(`[${this.agentName}] System analysis complete. Confidence: ${confidence}`);

    return {
      systemMap,
      sduiLayout,
      insights,
      confidence,
    };
  }

  /**
   * Extract entities from discovery data
   */
  private extractEntities(discoveryData: SystemMapperInput['discoveryData']): SystemEntity[] {
    const entities: SystemEntity[] = [];
    let entityId = 1;

    // Extract stakeholders as entities
    if (discoveryData.stakeholders) {
      discoveryData.stakeholders.forEach((stakeholder) => {
        entities.push({
          id: `entity_${entityId++}`,
          name: stakeholder.name,
          type: 'stakeholder',
          attributes: {
            role: stakeholder.role,
            influence: stakeholder.influence,
          },
        });
      });
    }

    // Extract processes as entities
    if (discoveryData.processes) {
      discoveryData.processes.forEach((process) => {
        entities.push({
          id: `entity_${entityId++}`,
          name: process.name,
          type: 'process',
          attributes: {
            inputs: process.inputs,
            outputs: process.outputs,
            dependencies: process.dependencies,
          },
        });
      });
    }

    // Extract KPIs as entities
    if (discoveryData.kpis) {
      discoveryData.kpis.forEach((kpi) => {
        entities.push({
          id: `entity_${entityId++}`,
          name: kpi.name,
          type: 'kpi',
          attributes: {
            current: kpi.current,
            target: kpi.target,
            owner: kpi.owner,
            gap: kpi.target - kpi.current,
          },
        });
      });
    }

    return entities;
  }

  /**
   * Identify relationships between entities
   */
  private identifyRelationships(
    entities: SystemEntity[],
    discoveryData: SystemMapperInput['discoveryData']
  ): SystemRelationship[] {
    const relationships: SystemRelationship[] = [];
    let relationshipId = 1;

    // Process dependencies
    if (discoveryData.processes) {
      discoveryData.processes.forEach((process) => {
        const processEntity = entities.find((e) => e.name === process.name && e.type === 'process');
        if (!processEntity) return;

        // Link to dependencies
        process.dependencies.forEach((depName) => {
          const depEntity = entities.find((e) => e.name === depName);
          if (depEntity) {
            relationships.push({
              id: `rel_${relationshipId++}`,
              from: depEntity.id,
              to: processEntity.id,
              type: 'dependency',
              strength: 0.8,
              polarity: 'positive',
              description: `${depName} is required for ${process.name}`,
            });
          }
        });

        // Link to outputs (KPIs)
        process.outputs.forEach((output) => {
          const outputEntity = entities.find((e) => e.name === output && e.type === 'kpi');
          if (outputEntity) {
            relationships.push({
              id: `rel_${relationshipId++}`,
              from: processEntity.id,
              to: outputEntity.id,
              type: 'produces',
              strength: 0.9,
              polarity: 'positive',
              description: `${process.name} produces ${output}`,
            });
          }
        });
      });
    }

    // Stakeholder to KPI ownership
    if (discoveryData.stakeholders && discoveryData.kpis) {
      discoveryData.kpis.forEach((kpi) => {
        const stakeholder = entities.find((e) => e.name === kpi.owner && e.type === 'stakeholder');
        const kpiEntity = entities.find((e) => e.name === kpi.name && e.type === 'kpi');
        if (stakeholder && kpiEntity) {
          relationships.push({
            id: `rel_${relationshipId++}`,
            from: stakeholder.id,
            to: kpiEntity.id,
            type: 'owns',
            strength: 1.0,
            polarity: 'neutral',
            description: `${kpi.owner} owns ${kpi.name}`,
          });
        }
      });
    }

    return relationships;
  }

  /**
   * Identify system constraints
   */
  private identifyConstraints(discoveryData: SystemMapperInput['discoveryData']): SystemConstraint[] {
    const constraints: SystemConstraint[] = [];
    let constraintId = 1;

    if (discoveryData.constraints) {
      discoveryData.constraints.forEach((constraint) => {
        constraints.push({
          id: `constraint_${constraintId++}`,
          type: constraint.type,
          description: constraint.description,
          impact: 'Limits system performance and flexibility',
          severity: 'medium',
        });
      });
    }

    return constraints;
  }

  /**
   * Identify leverage points in the system
   */
  private identifyLeveragePoints(
    entities: SystemEntity[],
    relationships: SystemRelationship[],
    constraints: SystemConstraint[]
  ): LeveragePoint[] {
    const leveragePoints: LeveragePoint[] = [];
    let leverageId = 1;

    // High-connectivity nodes are leverage points
    const connectivityMap = new Map<string, number>();
    relationships.forEach((rel) => {
      connectivityMap.set(rel.from, (connectivityMap.get(rel.from) || 0) + 1);
      connectivityMap.set(rel.to, (connectivityMap.get(rel.to) || 0) + 1);
    });

    // Identify high-leverage entities
    entities.forEach((entity) => {
      const connectivity = connectivityMap.get(entity.id) || 0;
      if (connectivity >= 3) {
        leveragePoints.push({
          id: `leverage_${leverageId++}`,
          location: entity.id,
          type: 'high_connectivity_node',
          potential_impact: Math.min(10, connectivity + 5),
          effort: connectivity > 5 ? 'high' : 'medium',
          description: `${entity.name} is a high-leverage point with ${connectivity} connections`,
          rationale: 'Changes here will cascade through multiple system elements',
        });
      }
    });

    // Constraints are leverage points (removal)
    constraints.forEach((constraint) => {
      leveragePoints.push({
        id: `leverage_${leverageId++}`,
        location: constraint.id,
        type: 'constraint_removal',
        potential_impact: 8,
        effort: 'high',
        description: `Removing constraint: ${constraint.description}`,
        rationale: 'Constraint removal can unlock significant system capacity',
      });
    });

    // KPIs with large gaps are leverage points
    entities
      .filter((e) => e.type === 'kpi' && e.attributes?.gap && Math.abs(e.attributes.gap) > 10)
      .forEach((kpi) => {
        leveragePoints.push({
          id: `leverage_${leverageId++}`,
          location: kpi.id,
          type: 'goal_alignment',
          potential_impact: 7,
          effort: 'medium',
          description: `Close gap on ${kpi.name}`,
          rationale: 'Large performance gap indicates high improvement potential',
        });
      });

    return leveragePoints.sort((a, b) => b.potential_impact - a.potential_impact);
  }

  /**
   * Define system boundaries
   */
  private defineSystemBoundary(
    entities: SystemEntity[],
    context?: SystemMapperInput['context']
  ): SystemBoundary {
    return {
      included: entities.map((e) => e.name),
      excluded: ['External market forces', 'Regulatory environment', 'Competitor actions'],
      assumptions: [
        'Current organizational structure remains stable',
        'Budget constraints are fixed',
        'Technology stack is given',
        context?.timeframe ? `Analysis timeframe: ${context.timeframe}` : 'Short to medium term focus',
      ],
    };
  }

  /**
   * Identify external factors
   */
  private identifyExternalFactors(context?: SystemMapperInput['context']): ExternalFactor[] {
    const factors: ExternalFactor[] = [
      {
        id: 'ext_1',
        name: 'Market conditions',
        impact: 'Affects demand and pricing',
        controllability: 'none',
      },
      {
        id: 'ext_2',
        name: 'Regulatory changes',
        impact: 'May require process changes',
        controllability: 'low',
      },
      {
        id: 'ext_3',
        name: 'Technology trends',
        impact: 'Influences solution options',
        controllability: 'medium',
      },
    ];

    if (context?.industry) {
      factors.push({
        id: 'ext_4',
        name: `${context.industry} industry dynamics`,
        impact: 'Sector-specific pressures and opportunities',
        controllability: 'low',
      });
    }

    return factors;
  }

  /**
   * Determine system type
   */
  private determineSystemType(
    discoveryData: SystemMapperInput['discoveryData'],
    context?: SystemMapperInput['context']
  ): SystemMap['system_type'] {
    // Simple heuristic based on data
    if (discoveryData.processes && discoveryData.processes.length > 5) {
      return 'business_process';
    }
    if (discoveryData.stakeholders && discoveryData.stakeholders.length > 10) {
      return 'organizational';
    }
    return 'value_chain';
  }

  /**
   * Generate system name
   */
  private generateSystemName(
    discoveryData: SystemMapperInput['discoveryData'],
    context?: SystemMapperInput['context']
  ): string {
    const industry = context?.industry || 'Business';
    const focus = discoveryData.goals?.[0]?.description || 'Value Creation';
    return `${industry} ${focus} System`;
  }

  /**
   * Generate system description
   */
  private generateSystemDescription(entities: SystemEntity[], relationships: SystemRelationship[]): string {
    return `System map with ${entities.length} entities and ${relationships.length} relationships. ` +
      `Includes ${entities.filter((e) => e.type === 'stakeholder').length} stakeholders, ` +
      `${entities.filter((e) => e.type === 'process').length} processes, and ` +
      `${entities.filter((e) => e.type === 'kpi').length} KPIs.`;
  }

  /**
   * Generate insights from system map
   */
  private generateInsights(systemMap: Omit<SystemMap, 'id' | 'created_at' | 'updated_at'>) {
    return {
      keyLeveragePoints: systemMap.leverage_points
        .slice(0, 3)
        .map((lp) => lp.description || `Leverage point at ${lp.location}`),
      criticalConstraints: systemMap.constraints
        .filter((c) => c.severity === 'high')
        .map((c) => c.description),
      feedbackLoopOpportunities: this.identifyFeedbackLoopOpportunities(systemMap.relationships),
      recommendations: this.generateRecommendations(systemMap),
    };
  }

  /**
   * Identify potential feedback loops
   */
  private identifyFeedbackLoopOpportunities(relationships: SystemRelationship[]): string[] {
    const opportunities: string[] = [];

    // Look for circular paths (simplified)
    const graph = new Map<string, string[]>();
    relationships.forEach((rel) => {
      if (!graph.has(rel.from)) graph.set(rel.from, []);
      graph.get(rel.from)!.push(rel.to);
    });

    // Check for 2-node cycles
    relationships.forEach((rel) => {
      const reverseExists = relationships.some((r) => r.from === rel.to && r.to === rel.from);
      if (reverseExists) {
        opportunities.push(`Potential feedback loop between ${rel.from} and ${rel.to}`);
      }
    });

    if (opportunities.length === 0) {
      opportunities.push('Consider creating feedback loops to enable continuous improvement');
    }

    return opportunities.slice(0, 3);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(systemMap: Omit<SystemMap, 'id' | 'created_at' | 'updated_at'>): string[] {
    const recommendations: string[] = [];

    // Leverage point recommendations
    if (systemMap.leverage_points.length > 0) {
      const topLeverage = systemMap.leverage_points[0];
      recommendations.push(`Focus on ${topLeverage.description} for maximum impact`);
    }

    // Constraint recommendations
    if (systemMap.constraints.length > 0) {
      recommendations.push(`Address ${systemMap.constraints.length} identified constraints to unlock capacity`);
    }

    // Relationship density
    const density = systemMap.relationships.length / Math.max(1, systemMap.entities.length);
    if (density < 1.5) {
      recommendations.push('System appears loosely coupled - consider strengthening key relationships');
    } else if (density > 3) {
      recommendations.push('System is highly interconnected - changes will have wide-ranging effects');
    }

    return recommendations;
  }

  /**
   * Generate SDUI layout
   */
  private generateSDUILayout(
    systemMap: Omit<SystemMap, 'id' | 'created_at' | 'updated_at'>,
    insights: SystemMapperOutput['insights']
  ) {
    return {
      type: 'SystemOutcomePage' as const,
      components: [
        {
          type: 'SystemMapCanvas',
          props: {
            entities: systemMap.entities,
            relationships: systemMap.relationships,
            leveragePoints: systemMap.leverage_points,
            constraints: systemMap.constraints,
            title: systemMap.name,
            description: systemMap.description,
          },
        },
        {
          type: 'SystemInsightsPanel',
          props: {
            insights,
            systemType: systemMap.system_type,
          },
        },
        {
          type: 'LeveragePointsList',
          props: {
            leveragePoints: systemMap.leverage_points,
            title: 'High-Leverage Intervention Points',
          },
        },
        {
          type: 'SystemBoundaryCard',
          props: {
            boundary: systemMap.boundary_definition,
            externalFactors: systemMap.external_factors,
          },
        },
      ],
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    discoveryData: SystemMapperInput['discoveryData'],
    entities: SystemEntity[],
    relationships: SystemRelationship[]
  ): number {
    let confidence = 0.5; // Base confidence

    // More data = higher confidence
    if (discoveryData.stakeholders && discoveryData.stakeholders.length > 5) confidence += 0.1;
    if (discoveryData.processes && discoveryData.processes.length > 3) confidence += 0.1;
    if (discoveryData.kpis && discoveryData.kpis.length > 5) confidence += 0.1;
    if (discoveryData.constraints && discoveryData.constraints.length > 0) confidence += 0.05;
    if (discoveryData.goals && discoveryData.goals.length > 0) confidence += 0.05;

    // Good relationship density
    const density = relationships.length / Math.max(1, entities.length);
    if (density >= 1.5 && density <= 3) confidence += 0.1;

    return Math.min(1.0, confidence);
  }
}

/**
 * Export singleton instance
 */
export const systemMapperAgent = new SystemMapperAgent();
