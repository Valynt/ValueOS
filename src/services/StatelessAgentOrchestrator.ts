/**
 * Stateless Agent Orchestrator
 * 
 * CRITICAL FIX: Replaces singleton MockAgentOrchestrator
 * 
 * Key Changes:
 * - No internal state (workflowState removed)
 * - State passed as parameter to all methods
 * - Returns new state instead of mutating internal state
 * - Safe for concurrent requests
 * 
 * Migration Path:
 * 1. Use feature flag to switch between old and new orchestrator
 * 2. Test with canary deployment
 * 3. Full rollout after validation
 */

import { logger } from '../lib/logger';
import { CanvasComponent, AgentMessage, WorkflowStatus } from '../types';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { getAgentAPI, AgentType, AgentContext } from './AgentAPI';

export interface AgentResponse {
  type: 'component' | 'message' | 'suggestion' | 'sdui-page';
  payload: any;
  streaming?: boolean;
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

/**
 * Stateless Agent Orchestrator
 * 
 * All methods are pure functions that take state as input
 * and return new state as output.
 */
export class StatelessAgentOrchestrator {
  private agentAPI = getAgentAPI();

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
    traceId: string
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

      // Call agent
      const agentResponse = await this.agentAPI.callAgent(
        agentType,
        query,
        agentContext
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

  /**
   * Initialize a new workflow state
   * 
   * @param initialStage Initial workflow stage
   * @param context Initial context
   * @returns Initial workflow state
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
   * Update workflow stage
   * 
   * @param currentState Current workflow state
   * @param stage New stage
   * @param status New status
   * @returns Updated workflow state
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

    // Add current stage to completed if status is completed
    if (status === 'completed' && !nextState.completedStages.includes(currentState.currentStage)) {
      nextState.completedStages.push(currentState.currentStage);
    }

    return nextState;
  }

  /**
   * Select appropriate agent based on query and state
   * 
   * @param query User query
   * @param state Current workflow state
   * @returns Agent type to use
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

    // Default to coordinator
    return 'coordinator';
  }

  /**
   * Check if workflow is complete
   * 
   * @param state Workflow state
   * @returns True if workflow is complete
   */
  isWorkflowComplete(state: WorkflowState): boolean {
    return state.status === 'completed' || state.status === 'error';
  }

  /**
   * Get workflow progress percentage
   * 
   * @param state Workflow state
   * @param totalStages Total number of stages
   * @returns Progress percentage (0-100)
   */
  getProgress(state: WorkflowState, totalStages: number = 5): number {
    return Math.round((state.completedStages.length / totalStages) * 100);
  }
}
