/**
 * ArtifactComposer
 *
 * Assembles final business case artifacts: SDUI page generation, task planning,
 * and narrative framing. Extracted from UnifiedAgentOrchestrator in Sprint 4.
 *
 * Owns:
 *  - generateSDUIPage / generateAndRenderPage (delegated to WorkflowRenderService)
 *  - planTask / generateSubgoals / determineExecutionOrder / calculateComplexity
 */

import { v4 as uuidv4 } from 'uuid';

import { getAgentAPI } from '../../services/AgentAPI.js';
import { DefaultWorkflowRenderService } from '../../services/workflows/WorkflowRenderService.js';
import { DefaultWorkflowSimulationService } from '../../services/workflows/WorkflowSimulationService.js';
import type { AgentType } from '../../services/agent-types.js';
import type { AgentContext } from '../../services/AgentAPI.js';
import type { WorkflowContextDTO } from '../../types/workflow/orchestration.js';
import type {
  AgentResponse,
  ExecutionEnvelope,
  RenderPageOptions,
  StreamingUpdate,
  TaskPlanResult,
  SubgoalDefinition,
} from '../../services/UnifiedAgentOrchestrator.js';

export type { TaskPlanResult, SubgoalDefinition };

export interface ArtifactComposerConfig {
  enableSDUI: boolean;
  enableTaskPlanning: boolean;
  enableSimulation: boolean;
}

const DEFAULT_CONFIG: ArtifactComposerConfig = {
  enableSDUI: true,
  enableTaskPlanning: true,
  enableSimulation: false,
};

export class ArtifactComposer {
  private readonly renderService: DefaultWorkflowRenderService;
  private readonly simulationService: DefaultWorkflowSimulationService;

  constructor(
    private readonly config: ArtifactComposerConfig = DEFAULT_CONFIG,
    validateExecutionIntent?: (envelope: ExecutionEnvelope) => void,
  ) {
    const agentAPI = getAgentAPI();
    const validate = validateExecutionIntent ?? ((_e: ExecutionEnvelope) => {});
    this.renderService = new DefaultWorkflowRenderService(agentAPI, validate, () => this.config.enableSDUI);
    this.simulationService = new DefaultWorkflowSimulationService(agentAPI);
  }

  async generateSDUIPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    streamingCallback?: (update: StreamingUpdate) => void,
  ): Promise<AgentResponse> {
    return this.renderService.generateSDUIPage(envelope, agent, query, context, streamingCallback);
  }

  async generateAndRenderPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    renderOptions?: RenderPageOptions,
  ): Promise<{ response: AgentResponse; rendered: unknown }> {
    return this.renderService.generateAndRenderPage(envelope, agent, query, context, renderOptions);
  }

  async planTask(
    intentType: string,
    description: string,
    context: WorkflowContextDTO = {},
  ): Promise<TaskPlanResult> {
    if (!this.config.enableTaskPlanning) throw new Error('Task planning is disabled');
    const taskId = uuidv4();
    const subgoals = this._generateSubgoals(taskId, intentType, description, context);
    const executionOrder = this._determineExecutionOrder(subgoals);
    const complexityScore = this._calculateComplexity(subgoals);
    const requiresSimulation = this.config.enableSimulation && complexityScore > 0.7;
    return { taskId, subgoals, executionOrder, complexityScore, requiresSimulation };
  }

  private _generateSubgoals(
    _taskId: string,
    intentType: string,
    description: string,
    _context: WorkflowContextDTO,
  ): SubgoalDefinition[] {
    const patterns: Record<string, Array<{ type: string; agent: string; deps: string[] }>> = {
      value_assessment: [
        { type: 'discovery', agent: 'opportunity', deps: [] },
        { type: 'analysis', agent: 'system-mapper', deps: ['discovery'] },
        { type: 'design', agent: 'intervention-designer', deps: ['analysis'] },
        { type: 'validation', agent: 'value-eval', deps: ['design'] },
      ],
      financial_modeling: [
        { type: 'data_collection', agent: 'company-intelligence', deps: [] },
        { type: 'modeling', agent: 'financial-modeling', deps: ['data_collection'] },
        { type: 'reporting', agent: 'coordinator', deps: ['modeling'] },
      ],
      expansion_planning: [
        { type: 'analysis', agent: 'expansion', deps: [] },
        { type: 'opportunity_mapping', agent: 'opportunity', deps: ['analysis'] },
        { type: 'planning', agent: 'coordinator', deps: ['opportunity_mapping'] },
      ],
    };
    const pattern = patterns[intentType] ?? patterns['value_assessment'] ?? [];
    const idMap = new Map<string, string>();
    return pattern.map((step, index) => {
      const id = uuidv4();
      idMap.set(step.type, id);
      const dependencies = step.deps.map((d) => idMap.get(d)).filter((x): x is string => x !== undefined);
      return { id, type: step.type, description: `${step.type}: ${description}`, assignedAgent: step.agent, dependencies, priority: pattern.length - index, estimatedComplexity: 0.5 + index * 0.1 };
    });
  }

  private _determineExecutionOrder(subgoals: SubgoalDefinition[]): string[] {
    const order: string[] = [];
    const completed = new Set<string>();
    const remaining = [...subgoals];
    while (remaining.length > 0) {
      const ready = remaining.filter((sg) => sg.dependencies.every((dep) => completed.has(dep)));
      if (ready.length === 0) throw new Error('Circular dependency detected in subgoals');
      for (const sg of ready) { order.push(sg.id); completed.add(sg.id); remaining.splice(remaining.indexOf(sg), 1); }
    }
    return order;
  }

  private _calculateComplexity(subgoals: SubgoalDefinition[]): number {
    if (subgoals.length === 0) return 0;
    const avg = subgoals.reduce((s, sg) => s + sg.estimatedComplexity, 0) / subgoals.length;
    const countFactor = Math.min(subgoals.length / 10, 1);
    const totalDeps = subgoals.reduce((s, sg) => s + sg.dependencies.length, 0);
    const depFactor = Math.min(totalDeps / (subgoals.length * 2), 1);
    return Math.min((avg + countFactor + depFactor) / 3, 1);
  }
}

export const artifactComposer = new ArtifactComposer();
