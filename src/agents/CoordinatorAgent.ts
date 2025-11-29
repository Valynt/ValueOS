/**
 * CoordinatorAgent - Master Task Coordinator
 * 
 * Responsible for:
 * - Breaking high-level intents into subgoals
 * - Routing subgoals to appropriate agents
 * - Generating SDUI layouts
 * - Logging all decisions to audit system
 * 
 * SEC-004: Uses secure logger to prevent sensitive data leakage
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';
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
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { llmConfig } from '../config/llm';
import {
  getComponentToolDocumentation,
  validateComponentSelection,
  searchComponentTools,
} from '../sdui/ComponentToolRegistry';
import { getUIGenerationTracker } from '../services/UIGenerationTracker';
import { getUIRefinementLoop } from '../services/UIRefinementLoop';

export class CoordinatorAgent {
  private ontology: typeof planningOntology;
  private llmGateway: LLMGateway;
  private config: {
    maxSubgoalsPerTask: number;
    maxRoutingAttempts: number;
    defaultPriority: number;
    enableSimulation: boolean;
    enableAuditLogging: boolean;
    enableDynamicUI: boolean;
    enableUIRefinement: boolean;
  };

  constructor() {
    this.ontology = planningOntology;
    this.llmGateway = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
    this.config = {
      maxSubgoalsPerTask: 10,
      maxRoutingAttempts: 3,
      defaultPriority: 5,
      enableSimulation: true,
      enableAuditLogging: true,
      enableDynamicUI: true,
      enableUIRefinement: true,
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
   * Uses dynamic UI generation if enabled, falls back to static mapping
   */
  async produceSDUILayout(subgoal: Subgoal): Promise<SDUIPageDefinition> {
    if (!subgoal.output) {
      throw new Error('Subgoal has no output to render');
    }

    // Use dynamic UI generation if enabled
    if (this.config.enableDynamicUI) {
      try {
        return await this.generateDynamicUILayout(subgoal);
      } catch (error) {
        logger.warn('Dynamic UI generation failed, using fallback', {
          subgoalType: subgoal.type,
          // NEVER log: error details (may contain sensitive data)
        });
        // Fall through to static generation
      }
    }

    // Static generation (original implementation)
    return await this.generateStaticUILayout(subgoal);
  }

  /**
   * Generate UI layout dynamically using LLM
   */
  private async generateDynamicUILayout(subgoal: Subgoal): Promise<SDUIPageDefinition> {
    const startTime = Date.now();
    const tracker = getUIGenerationTracker();

    // Get component tool documentation
    const componentDocs = getComponentToolDocumentation();

    // Search for relevant components based on subgoal type
    const relevantComponents = searchComponentTools(subgoal.subgoal_type);

    // Prepare LLM prompt
    const messages = [
      {
        role: 'system' as const,
        content: `You are a UI designer for a business intelligence platform. Your task is to generate SDUI (Server-Driven UI) layouts.

Available Components:
${componentDocs}

Output Format:
Generate a valid JSON object matching this structure:
{
  "type": "page",
  "version": 1,
  "sections": [
    {
      "type": "component" | "layout.directive",
      "component": "ComponentName",
      "props": {...},
      "layout": "default" | "full_width" | "two_column" | "dashboard" | "single_column"
    }
  ]
}

Rules:
1. Always start with a PageHeader component
2. Choose components that best display the data type
3. Use appropriate layouts for the content
4. Follow best practices from component documentation
5. Validate all required props are included
6. Output ONLY valid JSON, no explanations`,
      },
      {
        role: 'user' as const,
        content: `Generate a UI layout for this task:

Task Type: ${subgoal.subgoal_type}
Description: ${subgoal.description}
Agent: ${subgoal.assigned_agent}

Output Data Structure:
${JSON.stringify(subgoal.output, null, 2)}

Context:
${JSON.stringify(subgoal.context, null, 2)}

Relevant Components: ${relevantComponents.map((c) => c.name).join(', ')}

Generate the optimal SDUI layout for this data.`,
      },
    ];

    // Call LLM with gating
    const response = await this.llmGateway.complete(
      messages,
      {
        use_gating: true,
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        task_type: 'ui_generation',
        complexity: this.estimateUIComplexity(subgoal),
      }
    );

    // Parse response
    let layout: SDUIPageDefinition;
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonContent = response.content.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }
      layout = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error}`);
    }

    // Validate generated layout
    const validation = this.validateGeneratedLayout(layout);
    if (!validation.valid) {
      throw new Error(`Invalid layout generated: ${validation.errors.join(', ')}`);
    }

    // Add metadata
    layout.metadata = {
      ...layout.metadata,
      debug: false,
      experienceId: subgoal.id,
      generated_by: 'dynamic_ui',
      llm_model: response.model,
    };

    const generationTime = Date.now() - startTime;

    // Track trajectory
    const trajectoryId = await tracker.trackGeneration({
      subgoal_id: subgoal.id,
      generation_method: 'dynamic',
      llm_model: response.model,
      tokens_used: response.tokens_used,
      generation_time_ms: generationTime,
      components_selected: layout.sections.map((s) => s.component),
      layout_chosen: layout.sections.find((s) => s.type === 'layout.directive')?.layout || 'default',
      reasoning: `Dynamic UI generation for ${subgoal.subgoal_type}`,
      alternatives_considered: relevantComponents.map((c) => c.name),
      confidence_score: validation.warnings.length === 0 ? 0.9 : 0.7,
      validation_passed: validation.valid,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
    });

    // Store trajectory ID in metadata
    layout.metadata.trajectory_id = trajectoryId;

    // Apply refinement loop if enabled
    if (this.config.enableUIRefinement) {
      const refinementLoop = getUIRefinementLoop();
      const refinementResult = await refinementLoop.generateAndRefine(subgoal, layout);

      // Use refined layout if it improved
      if (refinementResult.final_score > validation.warnings.length === 0 ? 90 : 70) {
        layout = refinementResult.layout;

        // Log refinement
        if (this.config.enableAuditLogging) {
          await this.logDecision('ui_refined', refinementResult, {
            subgoal_id: subgoal.id,
            trajectory_id: trajectoryId,
            iterations: refinementResult.iterations,
            final_score: refinementResult.final_score,
            improvement: refinementResult.improvement_history,
          });
        }
      }
    }

    // Log generation
    if (this.config.enableAuditLogging) {
      await this.logDecision('dynamic_ui_generated', layout, {
        subgoal_id: subgoal.id,
        trajectory_id: trajectoryId,
        model: response.model,
        tokens_used: response.tokens_used,
        generation_time_ms: generationTime,
        components_used: layout.sections.map((s) => s.component),
      });
    }

    return layout;
  }

  /**
   * Generate UI layout using static mapping (fallback)
   */
  private async generateStaticUILayout(subgoal: Subgoal): Promise<SDUIPageDefinition> {
    // Determine output type
    const outputType = this.determineOutputType(subgoal);

    // Get SDUI mapping from ontology
    const sduiMapping = this.ontology.sdui_mappings[outputType];

    if (!sduiMapping) {
      throw new Error(`No SDUI mapping found for output type: ${outputType}`);
    }

    // Generate layout using static mapping
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
        generated_by: 'static_mapping',
      },
    };

    // Log SDUI generation
    if (this.config.enableAuditLogging) {
      await this.logDecision('static_ui_generated', layout, {
        subgoal_id: subgoal.id,
        component: sduiMapping.component,
        layout: sduiMapping.layout,
      });
    }

    return layout;
  }

  /**
   * Estimate UI complexity for gating
   */
  private estimateUIComplexity(subgoal: Subgoal): number {
    let complexity = 0.3; // Base

    // Factor in output size
    const outputSize = JSON.stringify(subgoal.output).length;
    complexity += Math.min(outputSize / 5000, 0.3);

    // Factor in data structure complexity
    const dataDepth = this.calculateObjectDepth(subgoal.output);
    complexity += Math.min(dataDepth / 10, 0.2);

    // Factor in subgoal type
    const complexTypes = ['analysis', 'design', 'monitoring'];
    if (complexTypes.includes(subgoal.subgoal_type)) {
      complexity += 0.2;
    }

    return Math.min(complexity, 1);
  }

  /**
   * Calculate object depth
   */
  private calculateObjectDepth(obj: unknown, depth: number = 0): number {
    if (typeof obj !== 'object' || obj === null) return depth;

    const depths = Object.values(obj as Record<string, unknown>).map((value) =>
      this.calculateObjectDepth(value, depth + 1)
    );

    return depths.length > 0 ? Math.max(...depths) : depth;
  }

  /**
   * Validate generated layout
   */
  private validateGeneratedLayout(layout: unknown): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    if (!layout || typeof layout !== 'object') {
      errors.push('Layout must be an object');
      return { valid: false, errors, warnings };
    }

    if (layout.type !== 'page') {
      errors.push('Layout type must be "page"');
    }

    if (!Array.isArray(layout.sections)) {
      errors.push('Layout must have sections array');
      return { valid: false, errors, warnings };
    }

    if (layout.sections.length === 0) {
      errors.push('Layout must have at least one section');
    }

    // Validate each section
    for (const section of layout.sections) {
      if (!section.component) {
        errors.push('Section missing component name');
        continue;
      }

      // Validate component selection
      const validation = validateComponentSelection(
        section.component,
        section.props || {}
      );

      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Enable/disable dynamic UI generation
   */
  setDynamicUIEnabled(enabled: boolean): void {
    this.config.enableDynamicUI = enabled;
  }

  /**
   * Enable/disable UI refinement loop
   */
  setUIRefinementEnabled(enabled: boolean): void {
    this.config.enableUIRefinement = enabled;
  }

  /**
   * Get UI generation configuration
   */
  getUIConfig(): {
    dynamicUIEnabled: boolean;
    refinementEnabled: boolean;
  } {
    return {
      dynamicUIEnabled: this.config.enableDynamicUI,
      refinementEnabled: this.config.enableUIRefinement,
    };
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
    agentInfo: { capabilities: string[]; complexity_range: [number, number] }
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
    data: Record<string, unknown>,
    metadata: Record<string, unknown>
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
      logger.error('Failed to log coordinator decision', error instanceof Error ? error : undefined, {
        decisionType,
      });
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
