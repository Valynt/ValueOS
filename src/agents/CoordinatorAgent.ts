/**
 * CoordinatorAgent - Master Task Coordinator
 * 
 * Responsible for:
 * - Breaking high-level intents into subgoals
 * - Routing subgoals to appropriate agents
 * - Generating SDUI layouts
 * - Logging all decisions to audit system
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  TaskIntent,
  CreateTaskIntent,
  Subgoal,
  CreateSubgoal,
  SubgoalRouting,
  TaskPlan,
} from '../types/Subgoal';
import type { SDUIPageDefinition } from '../sdui/types';
import planningOntology from '../ontology/planning.graph.json';
import { createAuditEvent } from '../lib/sof-governance';

export class CoordinatorAgent {
  private ontology: typeof planningOntology;
  private config: {
    maxSubgoalsPerTask: number;
    maxRoutingAttempts: number;
    defaultPriority: number;
    enableSimulation: boolean;
    enableAuditLogging: boolean;
  };

  constructor() {
    this.ontology = planningOntology;
    this.config = {
      maxSubgoalsPerTask: 10,
      maxRoutingAttempts: 3,
      defaultPriority: 5,
      enableSimulation: true,
      enableAuditLogging: true,
    };
  }

  /**
   * Main entry point: Plan a task from user intent
   */
  async planTask(intent: CreateTaskIntent): Promise<TaskPlan> {
    const taskId = uuidv4();
    const taskIntent: TaskIntent = {
      id: taskId,
      ...intent,
      created_at: new Date().toISOString(),
    };

    // Log task initiation
    if (this.config.enableAuditLogging) {
      await this.logDecision('task_initiated', taskIntent, {
        intent_type: intent.intent_type,
        description: intent.intent_description,
      });
    }

    // Generate subgoals
    const subgoals = await this.generateSubgoals(taskIntent);

    // Determine execution order
    const executionOrder = this.determineExecutionOrder(subgoals);

    // Calculate complexity
    const complexityScore = this.calculateComplexity(subgoals);

    // Check if simulation is required
    const requiresSimulation = this.shouldSimulate(taskIntent, complexityScore);

    const plan: TaskPlan = {
      task_id: taskId,
      subgoals,
      execution_order: executionOrder,
      complexity_score: complexityScore,
      requires_simulation: requiresSimulation,
    };

    // Log plan creation
    if (this.config.enableAuditLogging) {
      await this.logDecision('plan_created', plan, {
        subgoal_count: subgoals.length,
        complexity: complexityScore,
        requires_simulation: requiresSimulation,
      });
    }

    return plan;
  }

  /**
   * Generate subgoals from task intent
   */
  async generateSubgoals(intent: TaskIntent): Promise<Subgoal[]> {
    // Look up task pattern in ontology
    const pattern = this.ontology.task_patterns[intent.intent_type];

    if (!pattern) {
      throw new Error(`No task pattern found for intent type: ${intent.intent_type}`);
    }

    const subgoals: Subgoal[] = [];
    const subgoalIdMap = new Map<string, string>();

    // Create subgoals from pattern
    for (const step of pattern.subgoal_sequence) {
      const subgoalId = uuidv4();
      subgoalIdMap.set(step.type, subgoalId);

      // Resolve dependencies
      const dependencies: string[] = [];
      if (step.depends_on) {
        for (const depType of step.depends_on) {
          const depId = subgoalIdMap.get(depType);
          if (depId) {
            dependencies.push(depId);
          }
        }
      }

      const subgoal: Subgoal = {
        id: subgoalId,
        parent_task_id: intent.id,
        subgoal_type: step.type as any,
        description: step.description,
        assigned_agent: step.agent,
        dependencies,
        status: 'pending',
        priority: this.config.defaultPriority,
        estimated_complexity: this.estimateSubgoalComplexity(step.type as any, intent),
        context: {
          ...intent.context,
          intent_type: intent.intent_type,
        },
        created_at: new Date().toISOString(),
      };

      subgoals.push(subgoal);
    }

    return subgoals;
  }

  /**
   * Route a subgoal to the appropriate agent
   */
  async routeSubgoal(subgoal: Subgoal): Promise<SubgoalRouting> {
    // Get agent capabilities from ontology
    const agentInfo = this.ontology.agents[subgoal.assigned_agent];

    if (!agentInfo) {
      throw new Error(`Agent not found in ontology: ${subgoal.assigned_agent}`);
    }

    // Calculate routing confidence based on capability match
    const confidence = this.calculateRoutingConfidence(subgoal, agentInfo);

    // Find alternative agents
    const alternativeAgents = this.findAlternativeAgents(subgoal);

    const routing: SubgoalRouting = {
      subgoal_id: subgoal.id,
      agent_name: subgoal.assigned_agent,
      routing_reason: `Agent has required capabilities: ${agentInfo.capabilities.join(', ')}`,
      confidence,
      alternative_agents: alternativeAgents,
    };

    // Log routing decision
    if (this.config.enableAuditLogging) {
      await this.logDecision('subgoal_routed', routing, {
        subgoal_type: subgoal.subgoal_type,
        agent: subgoal.assigned_agent,
        confidence,
      });
    }

    return routing;
  }

  /**
   * Produce SDUI layout for a subgoal's output
   */
  async produceSDUILayout(subgoal: Subgoal): Promise<SDUIPageDefinition> {
    if (!subgoal.output) {
      throw new Error('Subgoal has no output to render');
    }

    // Determine output type
    const outputType = this.determineOutputType(subgoal);

    // Get SDUI mapping from ontology
    const sduiMapping = this.ontology.sdui_mappings[outputType];

    if (!sduiMapping) {
      throw new Error(`No SDUI mapping found for output type: ${outputType}`);
    }

    // Generate layout using new schema with layout directives
    const layout: SDUIPageDefinition = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'PageHeader',
          version: 1,
          props: {
            title: subgoal.description,
            subtitle: `Generated by ${subgoal.assigned_agent}`,
          },
        },
        {
          type: 'layout.directive',
          intent: subgoal.description,
          component: sduiMapping.component,
          props: {
            data: subgoal.output,
            context: subgoal.context,
          },
          layout: sduiMapping.layout as any,
          metadata: {
            subgoal_id: subgoal.id,
            agent: subgoal.assigned_agent,
            output_type: outputType,
          },
        },
      ],
      metadata: {
        debug: false,
        experienceId: subgoal.id,
      },
    };

    // Log SDUI generation
    if (this.config.enableAuditLogging) {
      await this.logDecision('sdui_generated', layout, {
        subgoal_id: subgoal.id,
        component: sduiMapping.component,
        layout: sduiMapping.layout,
      });
    }

    return layout;
  }

  /**
   * Determine execution order based on dependencies
   */
  private determineExecutionOrder(subgoals: Subgoal[]): string[] {
    const order: string[] = [];
    const completed = new Set<string>();
    const remaining = [...subgoals];

    while (remaining.length > 0) {
      // Find subgoals with no unmet dependencies
      const ready = remaining.filter((sg) =>
        sg.dependencies.every((dep) => completed.has(dep))
      );

      if (ready.length === 0) {
        throw new Error('Circular dependency detected in subgoals');
      }

      // Add ready subgoals to order
      for (const subgoal of ready) {
        order.push(subgoal.id);
        completed.add(subgoal.id);
        const index = remaining.indexOf(subgoal);
        remaining.splice(index, 1);
      }
    }

    return order;
  }

  /**
   * Calculate overall task complexity
   */
  private calculateComplexity(subgoals: Subgoal[]): number {
    if (subgoals.length === 0) return 0;

    const avgComplexity =
      subgoals.reduce((sum, sg) => sum + sg.estimated_complexity, 0) / subgoals.length;

    // Factor in number of subgoals
    const countFactor = Math.min(subgoals.length / 10, 1);

    // Factor in dependencies
    const totalDeps = subgoals.reduce((sum, sg) => sum + sg.dependencies.length, 0);
    const depFactor = Math.min(totalDeps / (subgoals.length * 2), 1);

    return Math.min((avgComplexity + countFactor + depFactor) / 3, 1);
  }

  /**
   * Determine if task should be simulated
   */
  private shouldSimulate(intent: TaskIntent, complexity: number): boolean {
    if (!this.config.enableSimulation) return false;

    // Look up pattern
    const pattern = this.ontology.task_patterns[intent.intent_type];
    if (pattern?.requires_simulation) return true;

    // High complexity tasks should be simulated
    if (complexity > this.ontology.complexity_thresholds.high) return true;

    return false;
  }

  /**
   * Estimate complexity of a single subgoal
   */
  private estimateSubgoalComplexity(
    type: string,
    intent: TaskIntent
  ): number {
    // Base complexity by type
    const baseComplexity: Record<string, number> = {
      discovery: 0.3,
      analysis: 0.6,
      design: 0.7,
      validation: 0.5,
      execution: 0.8,
      monitoring: 0.4,
      reporting: 0.3,
    };

    let complexity = baseComplexity[type] || 0.5;

    // Adjust based on context size
    const contextSize = Object.keys(intent.context).length;
    complexity += Math.min(contextSize / 20, 0.2);

    return Math.min(complexity, 1);
  }

  /**
   * Calculate routing confidence
   */
  private calculateRoutingConfidence(
    subgoal: Subgoal,
    agentInfo: any
  ): number {
    // Check if subgoal type matches agent capabilities
    const capabilityMatch = agentInfo.capabilities.some((cap: string) =>
      subgoal.subgoal_type.includes(cap.split('_')[0])
    );

    if (!capabilityMatch) return 0.5;

    // Check complexity range
    const complexityInRange =
      subgoal.estimated_complexity >= agentInfo.complexity_range[0] &&
      subgoal.estimated_complexity <= agentInfo.complexity_range[1];

    if (!complexityInRange) return 0.7;

    return 0.95;
  }

  /**
   * Find alternative agents for a subgoal
   */
  private findAlternativeAgents(subgoal: Subgoal): string[] {
    const alternatives: string[] = [];

    for (const [agentName, agentInfo] of Object.entries(this.ontology.agents)) {
      if (agentName === subgoal.assigned_agent) continue;

      // Check if agent has relevant capabilities
      const hasCapability = (agentInfo as any).capabilities.some((cap: string) =>
        subgoal.subgoal_type.includes(cap.split('_')[0])
      );

      if (hasCapability) {
        alternatives.push(agentName);
      }
    }

    return alternatives;
  }

  /**
   * Determine output type from subgoal
   */
  private determineOutputType(subgoal: Subgoal): string {
    // Map subgoal types to output types
    const typeMapping: Record<string, string> = {
      discovery: 'discovery_data',
      analysis: 'system_map',
      design: 'intervention_points',
      monitoring: 'feedback_loops',
      reporting: 'report',
    };

    return typeMapping[subgoal.subgoal_type] || 'generic_output';
  }

  /**
   * Log decision to audit system
   */
  private async logDecision(
    decisionType: string,
    data: any,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await createAuditEvent({
        business_case_id: data.business_case_id || data.task_id || 'system',
        event_type: 'system_update_logged' as any,
        event_description: `CoordinatorAgent: ${decisionType}`,
        actor_type: 'agent',
        agent_name: 'CoordinatorAgent',
        new_state: data,
        metadata: {
          decision_type: decisionType,
          ...metadata,
        },
      });
    } catch (error) {
      console.error('Failed to log coordinator decision:', error);
    }
  }

  /**
   * Get agent capabilities from ontology
   */
  getAgentCapabilities(agentName: string): string[] {
    const agentInfo = this.ontology.agents[agentName];
    return agentInfo?.capabilities || [];
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): string[] {
    return Object.keys(this.ontology.agents);
  }

  /**
   * Get task patterns
   */
  getTaskPatterns(): string[] {
    return Object.keys(this.ontology.task_patterns);
  }
}

export default CoordinatorAgent;
