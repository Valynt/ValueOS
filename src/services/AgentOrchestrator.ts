import { CanvasComponent, AgentMessage, WorkflowStatus } from '../types';
import { layoutEngine } from './LayoutEngine';
import { getAgentAPI, AgentType, AgentContext, AgentResponse as APIAgentResponse } from './AgentAPI';
import { SDUIPageDefinition } from '../sdui/schema';
import { renderPage, RenderPageOptions } from '../sdui/renderPage';
import { workflowDAGExecutor, getWorkflowExecutionStatus, retryWorkflowFromLastStage } from './workflows/WorkflowDAGIntegration';
import { WorkflowDAG } from '../types/workflow';
import { ALL_WORKFLOW_DEFINITIONS, getWorkflowById } from './workflows/WorkflowDAGDefinitions';

interface AgentResponse {
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

interface WorkflowState {
  currentStage: string;
  status: WorkflowStatus;
  completedStages: string[];
  context: Record<string, any>;
}

interface AgentCapability {
  name: string;
  description: string;
  canHandle: (query: string) => boolean;
  execute: (query: string, context: any) => Promise<AgentResponse>;
}

class MockAgentOrchestrator {
  private capabilities: AgentCapability[] = [];
  private messageCallbacks: Array<(message: AgentMessage) => void> = [];
  private streamingCallbacks: Array<(update: StreamingUpdate) => void> = [];
  private workflowState: WorkflowState | null = null;
  private agentAPI = getAgentAPI();

  constructor() {
    this.initializeAgents();
  }

  initializeWorkflow(initialStage: string, context: Record<string, any> = {}): void {
    this.workflowState = {
      currentStage: initialStage,
      status: 'initiated',
      completedStages: [],
      context
    };
  }

  getWorkflowState(): WorkflowState | null {
    return this.workflowState;
  }

  updateWorkflowStage(stage: string, status: WorkflowStatus): void {
    if (!this.workflowState) return;

    if (status === 'completed' && !this.workflowState.completedStages.includes(this.workflowState.currentStage)) {
      this.workflowState.completedStages.push(this.workflowState.currentStage);
    }

    this.workflowState.currentStage = stage;
    this.workflowState.status = status;
  }

  resetWorkflow(): void {
    this.workflowState = null;
  }

  private initializeAgents() {
    // Calculation Agent
    this.capabilities.push({
      name: 'Calculation Agent',
      description: 'Handles financial calculations and scenario modeling',
      canHandle: (query) => query.toLowerCase().includes('roi') || 
                            query.toLowerCase().includes('scenario') ||
                            query.toLowerCase().includes('cost'),
      execute: async (query, context) => {
        if (query.includes('scenario')) {
          return {
            type: 'component',
            payload: {
              type: 'interactive-chart',
              position: { x: 50, y: 400 },
              size: { width: 500, height: 300 },
              props: {
                title: 'ROI Scenario Analysis',
                type: 'bar',
                data: [
                  { name: 'Conservative', value: 180, id: 'conservative', color: '#ef4444' },
                  { name: 'Likely', value: 245, id: 'likely', color: '#3b82f6' },
                  { name: 'Optimistic', value: 320, id: 'optimistic', color: '#10b981' }
                ],
                config: { showValue: true, showLegend: true }
              }
            }
          };
        }
        return { type: 'message', payload: { content: 'Calculating...' } };
      }
    });

    // Assumption Agent  
    this.capabilities.push({
      name: 'Assumption Agent',
      description: 'Manages data inputs and validates assumptions',
      canHandle: (query) => query.toLowerCase().includes('assumption') ||
                            query.toLowerCase().includes('data') ||
                            query.toLowerCase().includes('benchmark'),
      execute: async (query, context) => {
        return {
          type: 'component',
          payload: {
            type: 'data-table',
            position: { x: 50, y: 250 },
            size: { width: 600, height: 200 },
            props: {
              title: 'Key Assumptions',
              headers: ['Assumption', 'Value', 'Source', 'Confidence'],
              rows: [
                ['User Adoption Rate', '85%', 'Industry Benchmark', 'High'],
                ['Efficiency Gain', '15%', 'Vendor Claims', 'Medium'],
                ['Implementation Time', '3 months', 'Historical Data', 'High']
              ],
              editableColumns: [1]
            }
          }
        };
      }
    });

    // Visualization Agent
    this.capabilities.push({
      name: 'Visualization Agent',
      description: 'Creates charts and visual representations',
      canHandle: (query) => query.toLowerCase().includes('chart') ||
                            query.toLowerCase().includes('visual') ||
                            query.toLowerCase().includes('breakdown'),
      execute: async (query, context) => {
        if (query.includes('breakdown')) {
          return {
            type: 'component',
            payload: {
              type: 'interactive-chart',
              position: { x: 400, y: 200 },
              size: { width: 450, height: 300 },
              props: {
                title: 'Cost Breakdown Analysis',
                type: 'pie',
                data: [
                  { name: 'Software Licenses', value: 120000, id: 'licenses', color: '#3b82f6' },
                  { name: 'Implementation', value: 75000, id: 'implementation', color: '#10b981' },
                  { name: 'Training', value: 25000, id: 'training', color: '#f59e0b' },
                  { name: 'Ongoing Support', value: 35000, id: 'support', color: '#ef4444' }
                ],
                config: { showValue: true, showLegend: true }
              }
            }
          };
        }
        return { type: 'message', payload: { content: 'Creating visualization...' } };
      }
    });
  }

  async processQuery(query: string, context: any = {}): Promise<AgentResponse | null> {
    const capability = this.capabilities.find(cap => cap.canHandle(query));

    if (capability) {
      this.notifyActivity({
        agent: capability.name,
        title: 'Processing request',
        content: `Analyzing: "${query}"`
      });

      this.notifyStreaming({
        stage: 'analyzing',
        message: 'Understanding your request...',
        progress: 25
      });

      await this.delay(500);

      this.notifyStreaming({
        stage: 'processing',
        message: 'Analyzing context and dependencies...',
        progress: 50
      });

      await this.delay(500);

      this.notifyStreaming({
        stage: 'generating',
        message: 'Creating component...',
        progress: 75
      });

      const response = await capability.execute(query, context);

      if (response.type === 'component' && context.components) {
        const optimalPosition = layoutEngine.suggestOptimalPosition(
          response.payload,
          context.components
        );
        response.payload.position = optimalPosition;
      }

      this.notifyStreaming({
        stage: 'complete',
        message: 'Ready to place on canvas',
        progress: 100
      });

      this.notifyActivity({
        agent: capability.name,
        title: 'Request completed',
        content: `Generated ${response.type} for your query`
      });

      return response;
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notifyActivity(activity: { agent: string; title: string; content: string }) {
    const message: AgentMessage = {
      id: `activity-${Date.now()}`,
      type: 'activity',
      timestamp: new Date(),
      ...activity
    };

    this.messageCallbacks.forEach(callback => callback(message));
  }

  onMessage(callback: (message: AgentMessage) => void) {
    this.messageCallbacks.push(callback);
  }

  onStreaming(callback: (update: StreamingUpdate) => void) {
    this.streamingCallbacks.push(callback);
  }

  /**
   * Generate SDUI page using AgentAPI
   */
  async generateSDUIPage(
    agent: AgentType,
    query: string,
    context?: AgentContext
  ): Promise<AgentResponse> {
    this.notifyStreaming({
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

      this.notifyStreaming({
        stage: 'processing',
        message: 'Processing agent response...',
        progress: 60,
      });

      if (!response.success) {
        throw new Error(response.error || 'Agent request failed');
      }

      this.notifyStreaming({
        stage: 'complete',
        message: 'SDUI page generated successfully',
        progress: 100,
      });

      this.notifyActivity({
        agent: `${agent} Agent`,
        title: 'SDUI Page Generated',
        content: `Generated dynamic page layout with ${response.data?.sections?.length || 0} sections`,
      });

      return {
        type: 'sdui-page',
        payload: response.data,
        sduiPage: response.data,
      };
    } catch (error) {
      this.notifyActivity({
        agent: `${agent} Agent`,
        title: 'Generation Failed',
        content: (error as Error).message,
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

  /**
   * Get circuit breaker status for an agent
   */
  getAgentCircuitBreakerStatus(agent: AgentType) {
    return this.agentAPI.getCircuitBreakerStatus(agent);
  }

  /**
   * Reset circuit breaker for an agent
   */
  resetAgentCircuitBreaker(agent: AgentType) {
    this.agentAPI.resetCircuitBreaker(agent);
  }

  private notifyStreaming(update: StreamingUpdate) {
    this.streamingCallbacks.forEach(callback => callback(update));
  }

  async processQueryWithContext(query: string, context: any = {}): Promise<AgentResponse | null> {
    const lowerQuery = query.toLowerCase();

    if (context.selectedComponent && !lowerQuery.includes('new')) {
      const componentContext = `Refining ${context.selectedComponent.type}: ${context.selectedComponent.props.title || 'component'}`;

      this.notifyStreaming({
        stage: 'analyzing',
        message: componentContext,
        progress: 30
      });

      await this.delay(800);
    }

    return this.processQuery(query, context);
  }

  generateSuggestion(context: any) {
    const suggestions = [
      {
        agent: 'Calculation Agent',
        title: 'Scenario analysis recommended',
        content: 'Your ROI calculation shows high sensitivity to user adoption rates. Consider creating best/worst case scenarios.',
        actions: [
          { label: 'Create Scenarios', action: 'create-scenarios' },
          { label: 'Dismiss', action: 'dismiss' }
        ]
      },
      {
        agent: 'Assumption Agent',
        title: 'Data validation needed',
        content: 'Some assumptions haven\'t been updated in 30 days. Would you like to refresh from latest benchmarks?',
        actions: [
          { label: 'Refresh Data', action: 'refresh-data' },
          { label: 'Skip', action: 'skip' }
        ]
      }
    ];

    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }
}

export const agentOrchestrator = new MockAgentOrchestrator();

// ============================================================================
// Workflow DAG Integration Methods
// ============================================================================

/**
 * Initialize workflow system by registering all workflow definitions
 */
export async function initializeWorkflowSystem(): Promise<void> {
  await workflowDAGExecutor.registerAllWorkflows();
}

/**
 * Execute a workflow by ID
 */
export async function executeWorkflowDAG(
  workflowId: string,
  context: Record<string, any>,
  userId: string
): Promise<string> {
  return workflowDAGExecutor.executeWorkflow(workflowId, context, userId);
}

/**
 * Get workflow execution status
 */
export async function getWorkflowStatus(executionId: string) {
  return getWorkflowExecutionStatus(executionId);
}

/**
 * Retry failed workflow
 */
export async function retryFailedWorkflow(executionId: string, userId: string): Promise<string> {
  return retryWorkflowFromLastStage(executionId, userId);
}

/**
 * Get all available workflow definitions
 */
export function getAvailableWorkflows(): WorkflowDAG[] {
  return ALL_WORKFLOW_DEFINITIONS;
}

/**
 * Get workflow definition by ID
 */
export function getWorkflowDefinition(workflowId: string): WorkflowDAG | undefined {
  return getWorkflowById(workflowId);
}

/**
 * Get circuit breaker status for a workflow stage
 */
export function getWorkflowCircuitBreakerStatus(workflowId: string, stageId: string) {
  return workflowDAGExecutor.getCircuitBreakerStatus(workflowId, stageId);
}

/**
 * Reset circuit breaker for a workflow stage
 */
export function resetWorkflowCircuitBreaker(workflowId: string, stageId: string): void {
  workflowDAGExecutor.resetCircuitBreaker(workflowId, stageId);
}