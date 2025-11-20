/**
 * RealizationLoopAgent (SOF Upgrade)
 * 
 * Tracks feedback loops and behavior changes during realization phase.
 * Monitors Realization → Behavior Change → System Update cycles.
 * Part of the Systemic Outcome Framework (SOF).
 */

import type {
  SystemMap,
  InterventionPoint,
  OutcomeHypothesis,
  FeedbackLoop,
  LoopElement,
  LoopPathSegment,
  BehaviorChange,
  SystemUpdate,
  LoopMetric,
  LoopType,
} from '../types/sof';

/**
 * Agent input for realization loop tracking
 */
export interface RealizationLoopInput {
  organizationId: string;
  systemMap: SystemMap;
  interventionPoint: InterventionPoint;
  outcomeHypothesis?: OutcomeHypothesis;
  realizationData: {
    implementationStatus: 'planning' | 'implementing' | 'completed';
    observedChanges: Array<{
      entity: string;
      change: string;
      timestamp: string;
      evidence: string;
    }>;
    kpiMeasurements?: Array<{
      kpi_id: string;
      value: number;
      timestamp: string;
    }>;
  };
}

/**
 * Agent output with feedback loops
 */
export interface RealizationLoopOutput {
  feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>;
  behaviorChanges: BehaviorChange[];
  systemUpdates: SystemUpdate[];
  sduiLayout: {
    type: 'RealizationLoopPage';
    components: Array<{
      type: string;
      props: Record<string, any>;
    }>;
  };
  insights: {
    activeLoops: number;
    loopStrength: string;
    behaviorChangeRate: string;
    systemStability: string;
    recommendations: string[];
  };
  confidence: number;
}

/**
 * RealizationLoopAgent class
 */
export class RealizationLoopAgent {
  private agentId = 'realization-loop-v2';
  private agentName = 'Realization Loop Agent';

  /**
   * Track realization loops
   */
  async track(input: RealizationLoopInput): Promise<RealizationLoopOutput> {
    console.log(`[${this.agentName}] Tracking realization loops...`);

    // Identify feedback loops in the system
    const feedbackLoops = this.identifyFeedbackLoops(input);

    // Extract behavior changes
    const behaviorChanges = this.extractBehaviorChanges(input.realizationData.observedChanges);

    // Generate system updates
    const systemUpdates = this.generateSystemUpdates(input, behaviorChanges);

    // Update loop metrics
    this.updateLoopMetrics(feedbackLoops, input.realizationData.kpiMeasurements);

    // Assess loop closure
    this.assessLoopClosure(feedbackLoops, behaviorChanges, systemUpdates);

    // Generate insights
    const insights = this.generateInsights(feedbackLoops, behaviorChanges, systemUpdates);

    // Generate SDUI layout
    const sduiLayout = this.generateSDUILayout(feedbackLoops, behaviorChanges, systemUpdates, insights);

    // Calculate confidence
    const confidence = this.calculateConfidence(input, feedbackLoops);

    console.log(`[${this.agentName}] Identified ${feedbackLoops.length} feedback loops. Confidence: ${confidence}`);

    return {
      feedbackLoops,
      behaviorChanges,
      systemUpdates,
      sduiLayout,
      insights,
      confidence,
    };
  }

  /**
   * Identify feedback loops
   */
  private identifyFeedbackLoops(
    input: RealizationLoopInput
  ): Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>> {
    const loops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>> = [];

    // Primary loop: Intervention → KPI → Behavior → System
    const primaryLoop = this.createPrimaryLoop(input);
    loops.push(primaryLoop);

    // Secondary loops: Identify from system structure
    const secondaryLoops = this.identifySecondaryLoops(input.systemMap, input.interventionPoint);
    loops.push(...secondaryLoops);

    return loops;
  }

  /**
   * Create primary realization loop
   */
  private createPrimaryLoop(
    input: RealizationLoopInput
  ): Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'> {
    // Build loop elements
    const loopElements: LoopElement[] = [
      {
        entity_id: input.interventionPoint.target_entity_id || 'intervention',
        role: 'intervention_point',
        position: 0,
      },
      {
        entity_id: 'kpi_measurement',
        role: 'measurement',
        position: 1,
      },
      {
        entity_id: 'stakeholder_behavior',
        role: 'behavior',
        position: 2,
      },
      {
        entity_id: 'system_state',
        role: 'system_update',
        position: 3,
      },
    ];

    // Build loop path
    const loopPath: LoopPathSegment[] = [
      {
        from: loopElements[0].entity_id,
        to: loopElements[1].entity_id,
        relationship_type: 'affects',
        polarity: 'positive',
      },
      {
        from: loopElements[1].entity_id,
        to: loopElements[2].entity_id,
        relationship_type: 'informs',
        polarity: 'positive',
      },
      {
        from: loopElements[2].entity_id,
        to: loopElements[3].entity_id,
        relationship_type: 'modifies',
        polarity: 'positive',
      },
      {
        from: loopElements[3].entity_id,
        to: loopElements[0].entity_id,
        relationship_type: 'reinforces',
        polarity: 'positive',
      },
    ];

    // Determine loop type
    const loopType = this.determineLoopType(loopPath);

    // Identify delay points
    const delayPoints = [
      {
        location: 'measurement',
        delay_type: 'information_delay',
        duration: 'days to weeks',
      },
      {
        location: 'behavior_change',
        delay_type: 'adoption_delay',
        duration: 'weeks to months',
      },
    ];

    return {
      organization_id: input.organizationId,
      system_map_id: input.systemMap.id,
      loop_name: `${input.interventionPoint.name} Realization Loop`,
      loop_description: 'Primary feedback loop tracking intervention realization through behavior change',
      loop_type: loopType,
      loop_elements: loopElements,
      loop_path: loopPath,
      delay_points: delayPoints,
      dominant_polarity: 'positive',
      loop_strength: this.assessLoopStrength(input),
      time_constant: this.estimateTimeConstant(delayPoints),
      realization_stage: this.mapImplementationStatus(input.realizationData.implementationStatus),
      behavior_changes: [],
      system_updates: [],
      loop_metrics: [],
      closure_status: 'open',
      closure_evidence: null,
      created_by: input.interventionPoint.created_by,
      activated_at: input.realizationData.implementationStatus === 'completed' ? new Date().toISOString() : null,
      closed_at: null,
    };
  }

  /**
   * Identify secondary loops
   */
  private identifySecondaryLoops(
    systemMap: SystemMap,
    intervention: InterventionPoint
  ): Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>> {
    const loops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>> = [];

    // Find cycles in system map starting from intervention target
    const targetId = intervention.target_entity_id;
    if (!targetId) return loops;

    const cycles = this.findCycles(targetId, systemMap.relationships, 6); // Max depth 6

    for (const cycle of cycles.slice(0, 2)) {
      // Limit to 2 secondary loops
      const loop = this.createLoopFromCycle(cycle, systemMap, intervention);
      if (loop) loops.push(loop);
    }

    return loops;
  }

  /**
   * Find cycles in graph
   */
  private findCycles(
    startId: string,
    relationships: SystemMap['relationships'],
    maxDepth: number
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string, path: string[], depth: number) => {
      if (depth > maxDepth) return;
      if (path.includes(nodeId)) {
        // Found cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push([...path.slice(cycleStart), nodeId]);
        return;
      }

      if (visited.has(nodeId)) return;

      const newPath = [...path, nodeId];
      const neighbors = relationships.filter((r) => r.from === nodeId).map((r) => r.to);

      for (const neighbor of neighbors) {
        dfs(neighbor, newPath, depth + 1);
      }
    };

    dfs(startId, [], 0);
    return cycles;
  }

  /**
   * Create loop from cycle
   */
  private createLoopFromCycle(
    cycle: string[],
    systemMap: SystemMap,
    intervention: InterventionPoint
  ): Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'> | null {
    if (cycle.length < 3) return null;

    const loopElements: LoopElement[] = cycle.map((entityId, index) => ({
      entity_id: entityId,
      role: 'system_element',
      position: index,
    }));

    const loopPath: LoopPathSegment[] = [];
    for (let i = 0; i < cycle.length - 1; i++) {
      const rel = systemMap.relationships.find((r) => r.from === cycle[i] && r.to === cycle[i + 1]);
      loopPath.push({
        from: cycle[i],
        to: cycle[i + 1],
        relationship_type: rel?.type || 'affects',
        polarity: rel?.polarity === 'negative' ? 'negative' : 'positive',
      });
    }

    const loopType = this.determineLoopType(loopPath);

    return {
      organization_id: systemMap.organization_id,
      system_map_id: systemMap.id,
      loop_name: `Secondary Loop (${cycle.length} elements)`,
      loop_description: `Feedback loop involving ${cycle.length} system elements`,
      loop_type: loopType,
      loop_elements: loopElements,
      loop_path: loopPath,
      delay_points: [],
      dominant_polarity: loopType === 'reinforcing' ? 'positive' : 'negative',
      loop_strength: 'moderate',
      time_constant: null,
      realization_stage: 'designed',
      behavior_changes: [],
      system_updates: [],
      loop_metrics: [],
      closure_status: 'open',
      closure_evidence: null,
      created_by: intervention.created_by,
      activated_at: null,
      closed_at: null,
    };
  }

  /**
   * Determine loop type from path
   */
  private determineLoopType(loopPath: LoopPathSegment[]): LoopType {
    const negativeCount = loopPath.filter((seg) => seg.polarity === 'negative').length;

    // Even number of negative polarities = reinforcing
    // Odd number of negative polarities = balancing
    if (negativeCount % 2 === 0) {
      return 'reinforcing';
    } else {
      return 'balancing';
    }
  }

  /**
   * Assess loop strength
   */
  private assessLoopStrength(input: RealizationLoopInput): FeedbackLoop['loop_strength'] {
    const leverage = input.interventionPoint.leverage_level;

    if (leverage >= 8) return 'strong';
    if (leverage >= 6) return 'moderate';
    return 'weak';
  }

  /**
   * Estimate time constant
   */
  private estimateTimeConstant(delayPoints: FeedbackLoop['delay_points']): string {
    if (delayPoints.length === 0) return 'days';

    const hasLongDelay = delayPoints.some((dp) => dp.duration.includes('months'));
    if (hasLongDelay) return 'months';

    const hasMediumDelay = delayPoints.some((dp) => dp.duration.includes('weeks'));
    if (hasMediumDelay) return 'weeks';

    return 'days';
  }

  /**
   * Map implementation status
   */
  private mapImplementationStatus(
    status: RealizationLoopInput['realizationData']['implementationStatus']
  ): FeedbackLoop['realization_stage'] {
    const map = {
      planning: 'designed' as const,
      implementing: 'implementing' as const,
      completed: 'active' as const,
    };
    return map[status];
  }

  /**
   * Extract behavior changes
   */
  private extractBehaviorChanges(
    observedChanges: RealizationLoopInput['realizationData']['observedChanges']
  ): BehaviorChange[] {
    return observedChanges.map((change) => ({
      entity: change.entity,
      behavior_before: 'Baseline behavior', // Would come from historical data
      behavior_after: change.change,
      evidence: change.evidence,
      timestamp: change.timestamp,
    }));
  }

  /**
   * Generate system updates
   */
  private generateSystemUpdates(
    input: RealizationLoopInput,
    behaviorChanges: BehaviorChange[]
  ): SystemUpdate[] {
    const updates: SystemUpdate[] = [];

    // Generate update for each behavior change
    for (const change of behaviorChanges) {
      updates.push({
        update_type: 'behavior_change',
        description: `${change.entity} behavior updated: ${change.behavior_after}`,
        timestamp: change.timestamp || new Date().toISOString(),
        impact: 'Contributes to feedback loop dynamics',
      });
    }

    // Add implementation milestone update
    if (input.realizationData.implementationStatus === 'completed') {
      updates.push({
        update_type: 'implementation_complete',
        description: `${input.interventionPoint.name} implementation completed`,
        timestamp: new Date().toISOString(),
        impact: 'Feedback loop activated',
      });
    }

    return updates;
  }

  /**
   * Update loop metrics
   */
  private updateLoopMetrics(
    feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>,
    kpiMeasurements?: RealizationLoopInput['realizationData']['kpiMeasurements']
  ): void {
    if (!kpiMeasurements || kpiMeasurements.length === 0) return;

    // Update metrics for primary loop
    const primaryLoop = feedbackLoops[0];
    if (!primaryLoop) return;

    primaryLoop.loop_metrics = kpiMeasurements.map((measurement) => ({
      metric: measurement.kpi_id,
      baseline: 0, // Would come from historical data
      current: measurement.value,
      target: 0, // Would come from intervention pathways
      unit: 'units',
    }));
  }

  /**
   * Assess loop closure
   */
  private assessLoopClosure(
    feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>,
    behaviorChanges: BehaviorChange[],
    systemUpdates: SystemUpdate[]
  ): void {
    for (const loop of feedbackLoops) {
      // Check if all loop elements have shown changes
      const elementsWithChanges = new Set(behaviorChanges.map((bc) => bc.entity));
      const totalElements = loop.loop_elements.length;
      const changedElements = loop.loop_elements.filter((elem) =>
        elementsWithChanges.has(elem.entity_id)
      ).length;

      const completionRatio = changedElements / totalElements;

      if (completionRatio >= 0.75) {
        loop.closure_status = 'closed';
        loop.closure_evidence = `${changedElements}/${totalElements} loop elements showing behavior changes`;
        loop.closed_at = new Date().toISOString();
      } else if (completionRatio >= 0.5) {
        loop.closure_status = 'partial';
        loop.closure_evidence = `${changedElements}/${totalElements} loop elements showing behavior changes`;
      } else {
        loop.closure_status = 'open';
      }
    }
  }

  /**
   * Generate insights
   */
  private generateInsights(
    feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>,
    behaviorChanges: BehaviorChange[],
    systemUpdates: SystemUpdate[]
  ) {
    const activeLoops = feedbackLoops.filter((loop) => loop.realization_stage === 'active').length;
    const closedLoops = feedbackLoops.filter((loop) => loop.closure_status === 'closed').length;

    const avgStrength = this.calculateAverageStrength(feedbackLoops);
    const changeRate = behaviorChanges.length / Math.max(1, feedbackLoops.length);

    const recommendations: string[] = [];

    if (activeLoops === 0) {
      recommendations.push('Activate feedback loops by completing intervention implementation');
    }

    if (closedLoops === 0 && activeLoops > 0) {
      recommendations.push('Monitor loop closure - no loops have fully closed yet');
    }

    if (changeRate < 1) {
      recommendations.push('Increase monitoring frequency to capture more behavior changes');
    }

    if (avgStrength === 'weak') {
      recommendations.push('Consider amplifying feedback mechanisms to strengthen loops');
    }

    return {
      activeLoops,
      loopStrength: avgStrength,
      behaviorChangeRate: `${changeRate.toFixed(1)} changes per loop`,
      systemStability: this.assessSystemStability(feedbackLoops, systemUpdates),
      recommendations,
    };
  }

  /**
   * Calculate average strength
   */
  private calculateAverageStrength(
    feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>
  ): string {
    const strengthScores = {
      weak: 1,
      moderate: 2,
      strong: 3,
      dominant: 4,
    };

    const avgScore =
      feedbackLoops.reduce((sum, loop) => sum + (strengthScores[loop.loop_strength || 'weak'] || 1), 0) /
      feedbackLoops.length;

    if (avgScore >= 3.5) return 'dominant';
    if (avgScore >= 2.5) return 'strong';
    if (avgScore >= 1.5) return 'moderate';
    return 'weak';
  }

  /**
   * Assess system stability
   */
  private assessSystemStability(
    feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>,
    systemUpdates: SystemUpdate[]
  ): string {
    const reinforcingLoops = feedbackLoops.filter((loop) => loop.loop_type === 'reinforcing').length;
    const balancingLoops = feedbackLoops.filter((loop) => loop.loop_type === 'balancing').length;

    if (balancingLoops > reinforcingLoops) {
      return 'Stable - balancing loops dominate';
    } else if (reinforcingLoops > balancingLoops * 2) {
      return 'Potentially unstable - monitor for runaway effects';
    } else {
      return 'Balanced - mix of reinforcing and balancing loops';
    }
  }

  /**
   * Generate SDUI layout
   */
  private generateSDUILayout(
    feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>,
    behaviorChanges: BehaviorChange[],
    systemUpdates: SystemUpdate[],
    insights: RealizationLoopOutput['insights']
  ) {
    return {
      type: 'RealizationLoopPage' as const,
      components: [
        {
          type: 'FeedbackLoopSummary',
          props: {
            activeLoops: insights.activeLoops,
            loopStrength: insights.loopStrength,
            systemStability: insights.systemStability,
          },
        },
        {
          type: 'FeedbackLoopDiagram',
          props: {
            loops: feedbackLoops,
            highlightActive: true,
          },
        },
        {
          type: 'BehaviorChangeTimeline',
          props: {
            changes: behaviorChanges,
            title: 'Observed Behavior Changes',
          },
        },
        {
          type: 'SystemUpdateLog',
          props: {
            updates: systemUpdates,
            showImpact: true,
          },
        },
        {
          type: 'LoopMetricsPanel',
          props: {
            loops: feedbackLoops.filter((loop) => loop.loop_metrics.length > 0),
            title: 'Loop Performance Metrics',
          },
        },
        {
          type: 'RealizationRecommendations',
          props: {
            recommendations: insights.recommendations,
          },
        },
      ],
    };
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    input: RealizationLoopInput,
    feedbackLoops: Array<Omit<FeedbackLoop, 'id' | 'created_at' | 'updated_at'>>
  ): number {
    let confidence = 0.6; // Base confidence

    // More observed changes = higher confidence
    if (input.realizationData.observedChanges.length >= 5) confidence += 0.1;

    // KPI measurements available = higher confidence
    if (input.realizationData.kpiMeasurements && input.realizationData.kpiMeasurements.length > 0) {
      confidence += 0.1;
    }

    // Implementation completed = higher confidence
    if (input.realizationData.implementationStatus === 'completed') confidence += 0.1;

    // Closed loops = higher confidence
    const closedLoops = feedbackLoops.filter((loop) => loop.closure_status === 'closed').length;
    confidence += closedLoops * 0.05;

    return Math.min(0.95, confidence);
  }
}

/**
 * Export singleton instance
 */
export const realizationLoopAgent = new RealizationLoopAgent();
