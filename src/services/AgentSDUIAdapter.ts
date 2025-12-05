/**
 * Agent SDUI Adapter
 * 
 * Converts agent outputs to SDUI schema updates.
 * This is the bridge between the Agent Fabric and the SDUI system.
 * 
 * CONSOLIDATION STATUS:
 * - PRIMARY: processAgentOutputWithIntents() - Use this for all new code
 * - DEPRECATED: processAgentOutput() - Legacy method, to be removed
 * - DEPRECATED: analyzeImpact() - Legacy method, to be removed
 * 
 * Intent-Based UI Registry Architecture:
 * - Agents emit "intents" describing what they want to display
 * - IntentRegistry resolves intents to specific React components
 * - This enables adding new agents without modifying this service
 * 
 * Migration:
 * - All callers should switch to processAgentOutputWithIntents()
 * - Legacy methods will be removed after migration period
 * 
 * @see src/types/intent.ts - Intent type definitions
 * @see src/services/IntentRegistry.ts - Intent resolution
 * @see src/services/AgentIntentConverter.ts - Agent output to intent conversion
 */

import { logger } from '../lib/logger';
import { SDUIPageDefinition } from '../sdui/schema';
import { SDUIUpdate } from '../types/sdui-integration';
import {
  AgentOutput,
  ComponentImpact,
  AgentSDUIUpdate,
  SystemMapperOutput,
  TargetOutput,
  OpportunityOutput,
  RealizationOutput,
  IntegrityOutput,
  CoordinatorOutput,
} from '../types/agent-output';
import {
  AtomicUIAction,
  createAddAction,
  createMutateAction,
  createRemoveAction,
} from '../sdui/AtomicUIActions';
import { canvasSchemaService } from './CanvasSchemaService';
import { UIIntent, IntentResolution } from '../types/intent';
import { intentRegistry } from './IntentRegistry';
import { agentIntentConverter } from './AgentIntentConverter';

/**
 * Agent SDUI Adapter
 */
export class AgentSDUIAdapter {
  /**
   * @deprecated Use processAgentOutputWithIntents instead
   * 
   * Process agent output and generate SDUI update (legacy method)
   * This method uses hardcoded switch statements and will be removed.
   */
  async processAgentOutput(
    agentId: string,
    output: AgentOutput,
    workspaceId: string
  ): Promise<SDUIUpdate> {
    logger.info('Processing agent output for SDUI update', {
      agentId,
      agentType: output.agentType,
      workspaceId,
    });

    try {
      // Get current schema
      const currentSchema = canvasSchemaService.getCachedSchema(workspaceId);

      // Analyze impact of agent output
      const impacts = this.analyzeImpact(output, currentSchema);

      // Generate atomic UI actions
      const atomicActions = this.generateAtomicActions(output, impacts);

      // Determine update type
      const updateType = this.determineUpdateType(impacts, atomicActions);

      // Create SDUI update
      const update: SDUIUpdate = {
        type: updateType,
        workspaceId,
        actions: atomicActions,
        timestamp: Date.now(),
        source: `agent:${agentId}`,
      };

      // If full schema regeneration needed, trigger it
      if (updateType === 'full_schema') {
        canvasSchemaService.invalidateCache(workspaceId);
      }

      logger.info('Generated SDUI update from agent output', {
        agentId,
        updateType,
        actionCount: atomicActions.length,
        impactCount: impacts.length,
      });

      return update;
    } catch (error) {
      logger.error('Failed to process agent output', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty update on error
      return {
        type: 'partial_update',
        workspaceId,
        actions: [],
        timestamp: Date.now(),
        source: `agent:${agentId}`,
      };
    }
  }

  /**
   * NEW: Process agent output using Intent-Based UI Registry
   * 
   * This is the recommended method for new integrations.
   * Uses decoupled intent→component mapping instead of hardcoded switch statements.
   */
  async processAgentOutputWithIntents(
    agentId: string,
    output: AgentOutput,
    workspaceId: string,
    tenantId?: string
  ): Promise<SDUIUpdate> {
    logger.info('Processing agent output with intents', {
      agentId,
      agentType: output.agentType,
      workspaceId,
    });

    try {
      // Step 1: Convert agent output to intents
      const intents = agentIntentConverter.convert(output as AgentOutput & Record<string, unknown>);
      
      if (intents.length === 0) {
        logger.warn('No intents generated from agent output', { agentType: output.agentType });
        return {
          type: 'partial_update',
          workspaceId,
          actions: [],
          timestamp: Date.now(),
          source: `agent:${agentId}`,
        };
      }

      // Step 2: Resolve intents to components
      const atomicActions: AtomicUIAction[] = [];
      
      for (const intent of intents) {
        const resolution = intentRegistry.resolve(intent, tenantId);
        
        if (resolution.resolved) {
          // Create add action for resolved component
          atomicActions.push(
            createAddAction(
              {
                component: resolution.component,
                props: resolution.props as Record<string, unknown>,
              },
              { append: true },
              `Add ${resolution.component} from ${intent.type} intent`
            )
          );
        } else if (resolution.fallback) {
          // Use fallback component
          atomicActions.push(
            createAddAction(
              {
                component: resolution.fallback,
                props: resolution.props as Record<string, unknown>,
              },
              { append: true },
              `Add fallback ${resolution.fallback} for ${intent.type}`
            )
          );
        }
      }

      logger.info('Generated SDUI update from intents', {
        agentId,
        intentCount: intents.length,
        actionCount: atomicActions.length,
      });

      return {
        type: atomicActions.length > 0 ? 'atomic_actions' : 'partial_update',
        workspaceId,
        actions: atomicActions,
        timestamp: Date.now(),
        source: `agent:${agentId}`,
      };
    } catch (error) {
      logger.error('Failed to process agent output with intents', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to legacy processing
      return this.processAgentOutput(agentId, output, workspaceId);
    }
  }

  /**
   * @deprecated Use analyzeImpactWithIntents for new code
   * Determine which components need updates (legacy method)
   */
  analyzeImpact(
    output: AgentOutput,
    currentSchema: SDUIPageDefinition | null
  ): ComponentImpact[] {
    const impacts: ComponentImpact[] = [];

    // Analyze based on agent type
    switch (output.agentType) {
      case 'SystemMapperAgent':
        impacts.push(...this.analyzeSystemMapperImpact(output as SystemMapperOutput));
        break;

      case 'TargetAgent':
        impacts.push(...this.analyzeInterventionDesignerImpact(output as TargetOutput));
        break;

      case 'OpportunityAgent':
        impacts.push(...this.analyzeOutcomeEngineerImpact(output as OpportunityOutput));
        break;

      case 'RealizationAgent':
        impacts.push(...this.analyzeRealizationLoopImpact(output as RealizationOutput));
        break;

      case 'IntegrityAgent':
        impacts.push(...this.analyzeValueEvalImpact(output as IntegrityOutput));
        break;

      case 'CoordinatorAgent':
        impacts.push(...this.analyzeCoordinatorImpact(output as CoordinatorOutput));
        break;

      default:
        logger.warn('Unknown agent type', { agentType: output.agentType });
    }

    return impacts;
  }

  /**
   * Generate atomic UI actions from agent output
   */
  generateAtomicActions(
    output: AgentOutput,
    impacts: ComponentImpact[]
  ): AtomicUIAction[] {
    const actions: AtomicUIAction[] = [];

    for (const impact of impacts) {
      switch (impact.impactType) {
        case 'add':
          actions.push(...this.generateAddActions(output, impact));
          break;

        case 'update':
          actions.push(...this.generateUpdateActions(output, impact));
          break;

        case 'remove':
          actions.push(...this.generateRemoveActions(output, impact));
          break;

        case 'reorder':
          actions.push(...this.generateReorderActions(output, impact));
          break;
      }
    }

    return actions;
  }

  /**
   * Analyze SystemMapperAgent output impact
   */
  private analyzeSystemMapperImpact(output: SystemMapperOutput): ComponentImpact[] {
    const impacts: ComponentImpact[] = [];

    // If system map is generated, add SystemMapCanvas component
    if (output.systemMap) {
      impacts.push({
        componentId: 'system-map-canvas',
        componentType: 'SystemMapCanvas',
        impactType: 'add',
        reason: 'System map generated by SystemMapperAgent',
        priority: 'high',
        affectedProps: ['entities', 'relationships', 'leveragePoints'],
      });
    }

    // If leverage points found, add LeveragePointsList component
    if (output.leveragePoints && output.leveragePoints.length > 0) {
      impacts.push({
        componentId: 'leverage-points-list',
        componentType: 'LeveragePointsList',
        impactType: 'add',
        reason: 'Leverage points identified',
        priority: 'high',
        affectedProps: ['leveragePoints'],
      });
    }

    return impacts;
  }

  /**
   * Analyze TargetAgent output impact
   */
  private analyzeInterventionDesignerImpact(output: TargetOutput): ComponentImpact[] {
    const impacts: ComponentImpact[] = [];

    // If interventions designed, add InterventionDesigner component
    if (output.interventions && output.interventions.length > 0) {
      impacts.push({
        componentId: 'intervention-designer',
        componentType: 'InterventionDesigner',
        impactType: 'add',
        reason: 'Interventions designed by TargetAgent',
        priority: 'high',
        affectedProps: ['interventions', 'recommendations'],
      });
    }

    return impacts;
  }

  /**
   * Analyze OpportunityAgent output impact
   */
  private analyzeOutcomeEngineerImpact(output: OpportunityOutput): ComponentImpact[] {
    const impacts: ComponentImpact[] = [];

    // If hypotheses generated, add OutcomeHypothesesPanel component
    if (output.hypotheses && output.hypotheses.length > 0) {
      impacts.push({
        componentId: 'outcome-hypotheses-panel',
        componentType: 'OutcomeHypothesesPanel',
        impactType: 'add',
        reason: 'Outcome hypotheses generated',
        priority: 'high',
        affectedProps: ['hypotheses', 'kpis'],
      });
    }

    return impacts;
  }

  /**
   * Analyze RealizationAgent output impact
   */
  private analyzeRealizationLoopImpact(output: RealizationOutput): ComponentImpact[] {
    const impacts: ComponentImpact[] = [];

    // If feedback loops detected, add FeedbackLoopViewer component
    if (output.feedbackLoops && output.feedbackLoops.length > 0) {
      impacts.push({
        componentId: 'feedback-loop-viewer',
        componentType: 'FeedbackLoopViewer',
        impactType: 'add',
        reason: 'Feedback loops detected',
        priority: 'high',
        affectedProps: ['feedbackLoops', 'metrics'],
      });
    }

    // Update RealizationDashboard with new metrics
    if (output.metrics && output.metrics.length > 0) {
      impacts.push({
        componentId: 'realization-dashboard',
        componentType: 'RealizationDashboard',
        impactType: 'update',
        reason: 'New realization metrics available',
        priority: 'high',
        affectedProps: ['metrics'],
      });
    }

    return impacts;
  }

  /**
   * Analyze IntegrityAgent output impact
   */
  private analyzeValueEvalImpact(output: IntegrityOutput): ComponentImpact[] {
    const impacts: ComponentImpact[] = [];

    // If scores calculated, update metric badges
    if (output.scores) {
      for (const [metric, score] of Object.entries(output.scores)) {
        impacts.push({
          componentId: `metric-badge-${metric}`,
          componentType: 'MetricBadge',
          impactType: 'update',
          reason: `Value score updated for ${metric}`,
          priority: 'medium',
          affectedProps: ['value'],
        });
      }
    }

    return impacts;
  }

  /**
   * Analyze CoordinatorAgent output impact
   */
  private analyzeCoordinatorImpact(output: CoordinatorOutput): ComponentImpact[] {
    const impacts: ComponentImpact[] = [];

    // If layout directive provided, trigger full schema regeneration
    if (output.layoutDirective) {
      impacts.push({
        componentId: 'page',
        componentType: 'Page',
        impactType: 'update',
        reason: 'Layout directive from CoordinatorAgent',
        priority: 'high',
        affectedProps: ['layout'],
      });
    }

    return impacts;
  }

  /**
   * Generate add actions
   */
  private generateAddActions(output: AgentOutput, impact: ComponentImpact): AtomicUIAction[] {
    const actions: AtomicUIAction[] = [];

    // Generate add action based on component type
    switch (impact.componentType) {
      case 'SystemMapCanvas':
        if ((output as SystemMapperOutput).systemMap) {
          const mapOutput = output as SystemMapperOutput;
          actions.push(
            createAddAction(
              {
                component: 'SystemMapCanvas',
                props: {
                  entities: mapOutput.entities,
                  relationships: mapOutput.relationships,
                  leveragePoints: mapOutput.leveragePoints,
                  constraints: mapOutput.constraints,
                },
              },
              { append: true },
              'Add system map visualization'
            )
          );
        }
        break;

      case 'LeveragePointsList':
        if ((output as SystemMapperOutput).leveragePoints) {
          actions.push(
            createAddAction(
              {
                component: 'LeveragePointsList',
                props: {
                  leveragePoints: (output as SystemMapperOutput).leveragePoints,
                },
              },
              { append: true },
              'Add leverage points list'
            )
          );
        }
        break;

      case 'InterventionDesigner':
        if ((output as TargetOutput).interventions) {
          actions.push(
            createAddAction(
              {
                component: 'InterventionDesigner',
                props: {
                  interventions: (output as TargetOutput).interventions,
                  recommendations: (output as TargetOutput).recommendations,
                },
              },
              { append: true },
              'Add intervention designer'
            )
          );
        }
        break;

      case 'FeedbackLoopViewer':
        if ((output as RealizationOutput).feedbackLoops) {
          actions.push(
            createAddAction(
              {
                component: 'FeedbackLoopViewer',
                props: {
                  feedbackLoops: (output as RealizationOutput).feedbackLoops,
                },
              },
              { append: true },
              'Add feedback loop viewer'
            )
          );
        }
        break;
    }

    return actions;
  }

  /**
   * Generate update actions
   */
  private generateUpdateActions(output: AgentOutput, impact: ComponentImpact): AtomicUIAction[] {
    const actions: AtomicUIAction[] = [];

    // Generate update action based on component type
    switch (impact.componentType) {
      case 'MetricBadge':
        if ((output as IntegrityOutput).scores) {
          const metric = impact.componentId.replace('metric-badge-', '');
          const score = (output as IntegrityOutput).scores[metric];
          if (score !== undefined) {
            actions.push(
              createMutateAction(
                { id: impact.componentId },
                [{ path: 'props.value', operation: 'set', value: score }],
                `Update ${metric} score`
              )
            );
          }
        }
        break;

      case 'RealizationDashboard':
        if ((output as RealizationOutput).metrics) {
          actions.push(
            createMutateAction(
              { type: 'RealizationDashboard' },
              [
                {
                  path: 'props.metrics',
                  operation: 'set',
                  value: (output as RealizationOutput).metrics,
                },
              ],
              'Update realization metrics'
            )
          );
        }
        break;
    }

    return actions;
  }

  /**
   * Generate remove actions
   */
  private generateRemoveActions(output: AgentOutput, impact: ComponentImpact): AtomicUIAction[] {
    const actions: AtomicUIAction[] = [];

    // Generate remove action
    actions.push(
      createRemoveAction(
        { id: impact.componentId },
        `Remove ${impact.componentType}`
      )
    );

    return actions;
  }

  /**
   * Generate reorder actions
   */
  private generateReorderActions(output: AgentOutput, impact: ComponentImpact): AtomicUIAction[] {
    // TODO: Implement reorder action generation
    return [];
  }

  /**
   * Determine update type based on impacts and actions
   */
  private determineUpdateType(
    impacts: ComponentImpact[],
    actions: AtomicUIAction[]
  ): 'full_schema' | 'atomic_actions' | 'partial_update' {
    // If any high-priority page-level impacts, do full schema regeneration
    const hasPageLevelImpact = impacts.some(
      (impact) => impact.componentType === 'Page' && impact.priority === 'high'
    );

    if (hasPageLevelImpact) {
      return 'full_schema';
    }

    // If we have atomic actions, use them
    if (actions.length > 0) {
      return 'atomic_actions';
    }

    // Otherwise, partial update
    return 'partial_update';
  }
}

// Singleton instance
export const agentSDUIAdapter = new AgentSDUIAdapter();
