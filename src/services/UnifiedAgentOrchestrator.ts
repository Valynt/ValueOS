/**
 * Unified Agent Orchestrator
 * 
 * CONSOLIDATION: Replaces the following fragmented orchestrators:
 * - AgentOrchestrator (singleton, deprecated)
 * - StatelessAgentOrchestrator (concurrent-safe base)
 * - WorkflowOrchestrator (DAG execution)
 * - CoordinatorAgent (task planning - partially)
 * 
 * Key Design Principles:
 * - Stateless: All state passed as parameters, safe for concurrent requests
 * - Unified: Single entry point for all agent orchestration
 * - Observable: Full tracing and audit logging
 * - Extensible: Plugin architecture for routing strategies
 */

import { logger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowStatus } from '../types';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { getAgentAPI, AgentType, AgentContext, AgentResponse as APIAgentResponse } from './AgentAPI';
import { SDUIPageDefinition } from '../sdui/schema';
import { renderPage, RenderPageOptions } from '../sdui/renderPage';
import { WorkflowDAG, WorkflowStage } from '../types/workflow';
import { AgentRegistry, AgentRecord } from './AgentRegistry';
import { AgentRoutingLayer, StageRoute } from './AgentRoutingLayer';
import { CircuitBreakerManager } from './CircuitBreaker';
import { supabase } from '../lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface AgentResponse {
  type: 'component' | 'message' | 'suggestion' | 'sdui-page';
  payload: any;
  streaming?: boolean;
  sduiPage?: SDUIPageDefinition;
}

export interface StreamingUpdate {
  stage: 'analyzing' | 'processing' | 'generating' | 'complete';
  message: string;
  progress?: number;
}

export interface ProcessQueryResult {
  response: AgentResponse | null;
  nextState: WorkflowState;
  traceId: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  status: WorkflowStatus;
  currentStage: string | null;
  completedStages: string[];
  error?: string;
}

export interface TaskPlanResult {
  taskId: string;
  subgoals: SubgoalDefinition[];
  executionOrder: string[];
  complexityScore: number;
  requiresSimulation: boolean;
}

export interface SubgoalDefinition {
  id: string;
  type: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  priority: number;
  estimatedComplexity: number;
}

export interface OrchestratorConfig {
  /** Enable workflow DAG execution */
  enableWorkflows: boolean;
  /** Enable task planning */
  enableTaskPlanning: boolean;
  /** Enable SDUI generation */
  enableSDUI: boolean;
  /** Enable simulation for complex tasks */
  enableSimulation: boolean;
  /** Default timeout for agent calls (ms) */
  defaultTimeoutMs: number;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enableWorkflows: true,
  enableTaskPlanning: true,
  enableSDUI: true,
  enableSimulation: true,
  defaultTimeoutMs: 30000,
  maxRetryAttempts: 3,
};

// ============================================================================
// Unified Agent Orchestrator
// ============================================================================

/**
 * Unified Agent Orchestrator
 * 
 * All methods are pure functions that take state as input
 * and return new state as output. No internal mutable state.
 */
export class UnifiedAgentOrchestrator {
  private agentAPI = getAgentAPI();
  private registry: AgentRegistry;
  private routingLayer: AgentRoutingLayer;
  private circuitBreakers: CircuitBreakerManager;
  private config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = new AgentRegistry();
    this.routingLayer = new AgentRoutingLayer(this.registry);
    this.circuitBreakers = new CircuitBreakerManager();
  }

  // ==========================================================================
  // Query Processing (from StatelessAgentOrchestrator)
  // ==========================================================================

  /**
   * Process a user query with given workflow state
   * 
   * @param query User query
   * @param currentState Current workflow state
   * @param userId User identifier
   * @param sessionId Session identifier
   * @param traceId Trace ID for logging
   * @returns Result with response and next state
   */
  async processQuery(
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4()
  ): Promise<ProcessQueryResult> {
    logger.info('Processing query', {
      traceId,
      sessionId,
      userId,
      currentStage: currentState.currentStage,
      queryLength: query.length,
    });

    try {
      // Create immutable copy of state
      const nextState: WorkflowState = {
        ...currentState,
        context: { ...currentState.context },
        completedStages: [...currentState.completedStages],
      };

      // Determine which agent to use based on query and current stage
      const agentType = this.selectAgent(query, currentState);

      logger.debug('Agent selected', {
        traceId,
        agentType,
        currentStage: currentState.currentStage,
      });

      // Build agent context
      const agentContext: AgentContext = {
        userId,
        sessionId,
        conversationHistory: currentState.context.conversationHistory || [],
        companyProfile: currentState.context.companyProfile,
        currentStage: currentState.currentStage,
      };

      // Call agent with circuit breaker protection
      const circuitBreakerKey = `query-${agentType}`;
      const agentResponse = await this.circuitBreakers.execute(
        circuitBreakerKey,
        () => this.agentAPI.callAgent(agentType, query, agentContext),
        { timeoutMs: this.config.defaultTimeoutMs }
      );

      // Update state based on response
      nextState.context.conversationHistory = [
        ...(nextState.context.conversationHistory || []),
        {
          role: 'user',
          content: query,
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: agentResponse.content,
          timestamp: new Date().toISOString(),
        },
      ];

      // Update stage if needed
      if (agentResponse.nextStage) {
        if (!nextState.completedStages.includes(currentState.currentStage)) {
          nextState.completedStages.push(currentState.currentStage);
        }
        nextState.currentStage = agentResponse.nextStage;
      }

      // Update status
      nextState.status = agentResponse.status || currentState.status;

      // Build response
      const response: AgentResponse = {
        type: agentResponse.type || 'message',
        payload: agentResponse.payload || { message: agentResponse.content },
      };

      logger.info('Query processed successfully', {
        traceId,
        sessionId,
        nextStage: nextState.currentStage,
        responseType: response.type,
      });

      return {
        response,
        nextState,
        traceId,
      };
    } catch (error) {
      logger.error('Error processing query', error instanceof Error ? error : undefined, {
        traceId,
        sessionId,
        userId,
      });

      // Return error state
      const errorState: WorkflowState = {
        ...currentState,
        status: 'error',
        context: {
          ...currentState.context,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          errorTimestamp: new Date().toISOString(),
        },
      };

      return {
        response: {
          type: 'message',
          payload: {
            message: 'I encountered an error processing your request. Please try again.',
            error: true,
          },
        },
        nextState: errorState,
        traceId,
      };
    }
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Initialize a new workflow state
   */
  createInitialState(
    initialStage: string,
    context: Record<string, any> = {}
  ): WorkflowState {
    return {
      currentStage: initialStage,
      status: 'initiated',
      completedStages: [],
      context: {
        ...context,
        conversationHistory: [],
      },
      metadata: {
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        errorCount: 0,
        retryCount: 0,
      },
    };
  }

  /**
   * Update workflow stage (pure function)
   */
  updateStage(
    currentState: WorkflowState,
    stage: string,
    status: WorkflowStatus
  ): WorkflowState {
    const nextState: WorkflowState = {
      ...currentState,
      currentStage: stage,
      status,
      completedStages: [...currentState.completedStages],
    };

    if (status === 'completed' && !nextState.completedStages.includes(currentState.currentStage)) {
      nextState.completedStages.push(currentState.currentStage);
    }

    return nextState;
  }

  // ==========================================================================
  // Workflow DAG Execution (from WorkflowOrchestrator)
  // ==========================================================================

  /**
   * Execute a workflow DAG
   */
  async executeWorkflow(
    workflowDefinitionId: string,
    context: Record<string, any> = {},
    userId: string
  ): Promise<WorkflowExecutionResult> {
    if (!this.config.enableWorkflows) {
      throw new Error('Workflow execution is disabled');
    }

    const traceId = uuidv4();
    logger.info('Starting workflow execution', {
      traceId,
      workflowDefinitionId,
      userId,
    });

    try {
      // Fetch workflow definition
      const { data: definition, error: defError } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('id', workflowDefinitionId)
        .eq('is_active', true)
        .maybeSingle();

      if (defError || !definition) {
        throw new Error(`Workflow definition not found: ${workflowDefinitionId}`);
      }

      const dag: WorkflowDAG = definition.dag_schema as WorkflowDAG;

      // Create execution record
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_definition_id: workflowDefinitionId,
          workflow_version: definition.version,
          status: 'initiated',
          current_stage: dag.initial_stage,
          context,
          audit_context: { workflow: definition.name, version: definition.version, traceId },
          circuit_breaker_state: {}
        })
        .select()
        .single();

      if (execError || !execution) {
        throw new Error('Failed to create workflow execution');
      }

      // Execute DAG asynchronously
      this.executeDAGAsync(execution.id, dag, context, traceId).catch(async (error) => {
        await this.handleWorkflowFailure(execution.id, error.message);
      });

      return {
        executionId: execution.id,
        status: 'initiated',
        currentStage: dag.initial_stage,
        completedStages: [],
      };
    } catch (error) {
      logger.error('Workflow execution failed', error instanceof Error ? error : undefined, {
        traceId,
        workflowDefinitionId,
      });
      throw error;
    }
  }

  /**
   * Execute DAG stages asynchronously
   */
  private async executeDAGAsync(
    executionId: string,
    dag: WorkflowDAG,
    initialContext: Record<string, any>,
    traceId: string
  ): Promise<void> {
    let currentStageId = dag.initial_stage;
    let executionContext = { ...initialContext };
    const visitedStages = new Set<string>();

    while (currentStageId && !dag.final_stages.includes(currentStageId)) {
      if (visitedStages.has(currentStageId)) {
        throw new Error(`Circular dependency at stage: ${currentStageId}`);
      }
      visitedStages.add(currentStageId);

      // Route to appropriate agent
      const route = this.routingLayer.routeStage(dag, currentStageId, executionContext);
      const stage = route.stage;

      // Update execution status
      await this.updateExecutionStatus(executionId, 'in_progress', currentStageId);

      // Execute stage with retry
      const stageResult = await this.executeStageWithRetry(
        executionId,
        stage,
        executionContext,
        route,
        traceId
      );

      if (stageResult.status === 'failed') {
        throw new Error(`Stage ${currentStageId} failed: ${stageResult.error}`);
      }

      // Merge context
      executionContext = {
        ...executionContext,
        ...stageResult.output,
      };

      // Move to next stage
      const nextTransition = dag.transitions.find(t => t.from_stage === currentStageId);
      if (!nextTransition) break;
      currentStageId = nextTransition.to_stage;
    }

    await this.updateExecutionStatus(executionId, 'completed', null);
  }

  /**
   * Execute a single stage with retry logic
   */
  private async executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: Record<string, any>,
    route: StageRoute,
    traceId: string
  ): Promise<{ status: 'completed' | 'failed'; output?: any; error?: string }> {
    const circuitBreakerKey = `${executionId}-${stage.id}`;
    const retryConfig = stage.retry_config || {
      max_attempts: this.config.maxRetryAttempts,
      initial_delay_ms: 1000,
      max_delay_ms: 10000,
      multiplier: 2,
      jitter: true,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryConfig.max_attempts; attempt++) {
      try {
        const result = await this.circuitBreakers.execute(
          circuitBreakerKey,
          () => this.executeStage(stage, context, route),
          {
            latencyThresholdMs: Math.floor(stage.timeout_seconds * 1000 * 0.8),
            timeoutMs: stage.timeout_seconds * 1000
          }
        );

        // Record success
        if (route.selected_agent) {
          this.registry.recordRelease(route.selected_agent.id);
          this.registry.markHealthy(route.selected_agent.id);
        }

        return { status: 'completed', output: result };
      } catch (error) {
        lastError = error as Error;
        
        if (route.selected_agent) {
          this.registry.recordFailure(route.selected_agent.id);
        }

        if (attempt < retryConfig.max_attempts) {
          const delay = this.calculateRetryDelay(
            attempt,
            retryConfig.initial_delay_ms,
            retryConfig.max_delay_ms,
            retryConfig.multiplier,
            retryConfig.jitter
          );
          await this.delay(delay);
        }
      }
    }

    return { status: 'failed', error: lastError?.message || 'Unknown error' };
  }

  /**
   * Execute a single stage
   */
  private async executeStage(
    stage: WorkflowStage,
    context: Record<string, any>,
    route: StageRoute
  ): Promise<Record<string, any>> {
    const agentType = stage.agent_type as AgentType;
    const agentContext: AgentContext = {
      userId: context.userId,
      sessionId: context.sessionId,
      currentStage: stage.id,
    };

    const response = await this.agentAPI.callAgent(
      agentType,
      stage.description || `Execute ${stage.id}`,
      agentContext
    );

    return {
      stage_id: stage.id,
      agent_type: stage.agent_type,
      agent_id: route.selected_agent?.id,
      output: response.payload,
    };
  }

  // ==========================================================================
  // SDUI Generation (from AgentOrchestrator)
  // ==========================================================================

  /**
   * Generate SDUI page using AgentAPI
   */
  async generateSDUIPage(
    agent: AgentType,
    query: string,
    context?: AgentContext,
    streamingCallback?: (update: StreamingUpdate) => void
  ): Promise<AgentResponse> {
    if (!this.config.enableSDUI) {
      throw new Error('SDUI generation is disabled');
    }

    const traceId = uuidv4();
    
    streamingCallback?.({
      stage: 'analyzing',
      message: `Invoking ${agent} agent...`,
      progress: 10,
    });

    try {
      let response: APIAgentResponse<SDUIPageDefinition>;

      // Route to appropriate agent method
      switch (agent) {
        case 'opportunity':
          response = await this.agentAPI.generateValueCase(query, context);
          break;
        case 'realization':
          response = await this.agentAPI.generateRealizationDashboard(query, context);
          break;
        case 'expansion':
          response = await this.agentAPI.generateExpansionOpportunities(query, context);
          break;
        default:
          response = await this.agentAPI.invokeAgent({ agent, query, context });
      }

      streamingCallback?.({
        stage: 'processing',
        message: 'Processing agent response...',
        progress: 60,
      });

      if (!response.success) {
        throw new Error(response.error || 'Agent request failed');
      }

      streamingCallback?.({
        stage: 'complete',
        message: 'SDUI page generated successfully',
        progress: 100,
      });

      return {
        type: 'sdui-page',
        payload: response.data,
        sduiPage: response.data,
      };
    } catch (error) {
      logger.error('SDUI generation failed', error instanceof Error ? error : undefined, {
        traceId,
        agent,
      });
      throw error;
    }
  }

  /**
   * Generate and render SDUI page
   */
  async generateAndRenderPage(
    agent: AgentType,
    query: string,
    context?: AgentContext,
    renderOptions?: RenderPageOptions
  ): Promise<{
    response: AgentResponse;
    rendered: ReturnType<typeof renderPage>;
  }> {
    const response = await this.generateSDUIPage(agent, query, context);

    if (response.sduiPage) {
      const rendered = renderPage(response.sduiPage, renderOptions);
      return { response, rendered };
    }

    throw new Error('No SDUI page in response');
  }

  // ==========================================================================
  // Task Planning (from CoordinatorAgent - simplified)
  // ==========================================================================

  /**
   * Plan a task by breaking it into subgoals
   */
  async planTask(
    intentType: string,
    description: string,
    context: Record<string, any> = {}
  ): Promise<TaskPlanResult> {
    if (!this.config.enableTaskPlanning) {
      throw new Error('Task planning is disabled');
    }

    const taskId = uuidv4();
    
    // Generate subgoals based on intent type
    const subgoals = this.generateSubgoals(taskId, intentType, description, context);
    
    // Determine execution order
    const executionOrder = this.determineExecutionOrder(subgoals);
    
    // Calculate complexity
    const complexityScore = this.calculateComplexity(subgoals);
    
    // Determine if simulation is needed
    const requiresSimulation = this.config.enableSimulation && complexityScore > 0.7;

    return {
      taskId,
      subgoals,
      executionOrder,
      complexityScore,
      requiresSimulation,
    };
  }

  /**
   * Generate subgoals for a task
   */
  private generateSubgoals(
    taskId: string,
    intentType: string,
    description: string,
    context: Record<string, any>
  ): SubgoalDefinition[] {
    // Map intent types to subgoal sequences
    const subgoalPatterns: Record<string, Array<{ type: string; agent: string; deps: string[] }>> = {
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

    const pattern = subgoalPatterns[intentType] || subgoalPatterns.value_assessment;
    const subgoalIdMap = new Map<string, string>();
    
    return pattern.map((step, index) => {
      const subgoalId = uuidv4();
      subgoalIdMap.set(step.type, subgoalId);
      
      const dependencies = step.deps
        .map(dep => subgoalIdMap.get(dep))
        .filter((id): id is string => id !== undefined);

      return {
        id: subgoalId,
        type: step.type,
        description: `${step.type}: ${description}`,
        assignedAgent: step.agent,
        dependencies,
        priority: pattern.length - index,
        estimatedComplexity: 0.5 + (index * 0.1),
      };
    });
  }

  /**
   * Determine execution order based on dependencies
   */
  private determineExecutionOrder(subgoals: SubgoalDefinition[]): string[] {
    const order: string[] = [];
    const completed = new Set<string>();
    const remaining = [...subgoals];

    while (remaining.length > 0) {
      const ready = remaining.filter(sg =>
        sg.dependencies.every(dep => completed.has(dep))
      );

      if (ready.length === 0 && remaining.length > 0) {
        throw new Error('Circular dependency detected in subgoals');
      }

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
   * Calculate task complexity
   */
  private calculateComplexity(subgoals: SubgoalDefinition[]): number {
    if (subgoals.length === 0) return 0;

    const avgComplexity = subgoals.reduce((sum, sg) => sum + sg.estimatedComplexity, 0) / subgoals.length;
    const countFactor = Math.min(subgoals.length / 10, 1);
    const totalDeps = subgoals.reduce((sum, sg) => sum + sg.dependencies.length, 0);
    const depFactor = Math.min(totalDeps / (subgoals.length * 2), 1);

    return Math.min((avgComplexity + countFactor + depFactor) / 3, 1);
  }

  // ==========================================================================
  // Agent Selection & Routing
  // ==========================================================================

  /**
   * Select appropriate agent based on query and state
   */
  private selectAgent(query: string, state: WorkflowState): AgentType {
    const lowerQuery = query.toLowerCase();

    // Stage-based routing
    switch (state.currentStage) {
      case 'discovery':
        return 'company-intelligence';
      case 'analysis':
        return 'system-mapper';
      case 'design':
        return 'intervention-designer';
      case 'modeling':
        return 'financial-modeling';
      default:
        break;
    }

    // Intent-based routing
    if (lowerQuery.includes('roi') || lowerQuery.includes('financial')) {
      return 'financial-modeling';
    }

    if (lowerQuery.includes('system') || lowerQuery.includes('map')) {
      return 'system-mapper';
    }

    if (lowerQuery.includes('intervention') || lowerQuery.includes('solution')) {
      return 'intervention-designer';
    }

    if (lowerQuery.includes('outcome') || lowerQuery.includes('result')) {
      return 'outcome-engineer';
    }

    if (lowerQuery.includes('expand') || lowerQuery.includes('growth')) {
      return 'expansion';
    }

    if (lowerQuery.includes('value') || lowerQuery.includes('opportunity')) {
      return 'opportunity';
    }

    // Default to coordinator
    return 'coordinator';
  }

  // ==========================================================================
  // Circuit Breaker Management
  // ==========================================================================

  /**
   * Get circuit breaker status for an agent
   */
  getCircuitBreakerStatus(agent: AgentType) {
    return this.agentAPI.getCircuitBreakerStatus(agent);
  }

  /**
   * Reset circuit breaker for an agent
   */
  resetCircuitBreaker(agent: AgentType) {
    this.agentAPI.resetCircuitBreaker(agent);
  }

  // ==========================================================================
  // Registry Access
  // ==========================================================================

  /**
   * Get agent registry for external access
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /**
   * Register an agent
   */
  registerAgent(registration: Parameters<AgentRegistry['registerAgent']>[0]): AgentRecord {
    return this.registry.registerAgent(registration);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private calculateRetryDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    multiplier: number,
    jitter: boolean
  ): number {
    let delay = initialDelay * Math.pow(multiplier, attempt - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      const jitterAmount = delay * 0.1;
      const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay += randomJitter;
    }

    return Math.floor(delay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async updateExecutionStatus(
    executionId: string,
    status: WorkflowStatus,
    currentStage: string | null
  ): Promise<void> {
    const update: any = {
      status,
      current_stage: currentStage,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
      update.completed_at = new Date().toISOString();
    }

    await supabase
      .from('workflow_executions')
      .update(update)
      .eq('id', executionId);
  }

  private async handleWorkflowFailure(executionId: string, errorMessage: string): Promise<void> {
    await supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);

    logger.error('Workflow failed', undefined, { executionId, errorMessage });
  }

  // ==========================================================================
  // Workflow Status Helpers
  // ==========================================================================

  isWorkflowComplete(state: WorkflowState): boolean {
    return state.status === 'completed' || state.status === 'error';
  }

  getProgress(state: WorkflowState, totalStages: number = 5): number {
    return Math.round((state.completedStages.length / totalStages) * 100);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: UnifiedAgentOrchestrator | null = null;

/**
 * Get singleton instance of UnifiedAgentOrchestrator
 */
export function getUnifiedOrchestrator(config?: Partial<OrchestratorConfig>): UnifiedAgentOrchestrator {
  if (!instance) {
    instance = new UnifiedAgentOrchestrator(config);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetUnifiedOrchestrator(): void {
  instance = null;
}

/**
 * Default export for convenience
 */
export const unifiedOrchestrator = getUnifiedOrchestrator();
