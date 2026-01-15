/**
 * useCanvasCommand Hook
 *
 * Extracts command processing logic from ChatCanvasLayout.
 * Handles user command submission, agent processing, and SDUI rendering.
 */

import { useCallback, useState } from 'react';
import { agentChatService, ChatRequest, ChatResponse } from '../../services/AgentChatService';
import { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { renderPage, RenderPageResult } from '@sdui/renderPage';
import { SDUIPageDefinition } from '@sdui/schema';
import {
  sduiTelemetry,
  TelemetryEventType
} from '../../lib/telemetry/SDUITelemetry';
import { logger } from '../../lib/logger';
import { toUserFriendlyError } from '../../utils/errorHandling';
import { useToast } from '../Common/Toast';
import { supabase } from '../../lib/supabase';
import { getWorkflowStateService, IWorkflowStateService } from '../../services/WorkflowStateServiceInterface';

export interface UseCanvasCommandOptions {
  selectedCaseId: string | null;
  selectedCase: any;
  workflowState: WorkflowState | null;
  currentSessionId: string | null;
  currentTenantId: string | undefined;
  onWorkflowStateUpdate: (state: WorkflowState) => void;
  onRenderedPageUpdate: (page: RenderPageResult) => void;
  onStreamingUpdate: (update: StreamingUpdate | null) => void;
  onLoadingUpdate: (loading: boolean) => void;
  refetchCases: () => void;
}

export interface StreamingUpdate {
  stage: string;
  message: string;
  progress?: number;
}

export interface CommandResult {
  success: boolean;
  error?: Error;
  traceId?: string;
}

/**
 * Hook for processing canvas commands with full pipeline support
 */
export function useCanvasCommand(options: UseCanvasCommandOptions) {
  const {
    selectedCaseId,
    selectedCase,
    workflowState,
    currentSessionId,
    currentTenantId,
    onWorkflowStateUpdate,
    onRenderedPageUpdate,
    onStreamingUpdate,
    onLoadingUpdate,
    refetchCases,
  } = options;

  const { error: showError } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const processCommand = useCallback(async (
    query: string,
    additionalContext?: Record<string, any>
  ): Promise<CommandResult> => {
    if (!selectedCaseId) {
      return {
        success: false,
        error: new Error('No case selected'),
      };
    }

    // Initialize workflow state if not set
    if (!workflowState && selectedCase) {
      const initialState: WorkflowState = {
        currentStage: selectedCase.stage,
        status: 'in_progress',
        completedStages: [],
        context: {
          caseId: selectedCase.id,
          company: selectedCase.company,
          ...additionalContext,
        },
      };
      onWorkflowStateUpdate(initialState);
    }

    setIsProcessing(true);
    onLoadingUpdate(true);
    onStreamingUpdate({
      stage: 'analyzing',
      message: 'Understanding your request...',
    });

    try {
      // Get user session info
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || 'anonymous';
      const sessionId = currentSessionId || sessionData?.session?.access_token?.slice(0, 36) || crypto.randomUUID();

      onStreamingUpdate({
        stage: 'processing',
        message: 'Consulting AI agent...',
      });

      // Track chat request
      const chatSpanId = `chat-${Date.now()}`;
      sduiTelemetry.startSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_START,
        {
          caseId: selectedCaseId,
          stage: workflowState?.currentStage || 'unknown',
          queryLength: query.length,
        }
      );

      // Process through AgentChatService
      const chatRequest: ChatRequest = {
        query,
        caseId: selectedCaseId,
        userId,
        sessionId,
        workflowState: workflowState ?? ({} as WorkflowState),
      };

      const result: ChatResponse = await agentChatService.chat(chatRequest);

      // Track completion
      sduiTelemetry.endSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_COMPLETE,
        {
          hasSDUI: !!result.sduiPage,
          stageTransitioned: workflowState ?
            result.nextState.currentStage !== workflowState.currentStage : false,
        }
      );

      // Update workflow state
      onWorkflowStateUpdate(result.nextState);

      // Persist state if we have a session
      if (currentSessionId && currentTenantId) {
        try {
          await persistWorkflowState(currentSessionId, result.nextState, currentTenantId);

          // Track stage transition
          if (workflowState && result.nextState.currentStage !== workflowState.currentStage) {
            sduiTelemetry.recordWorkflowStateChange(
              currentSessionId,
              workflowState?.currentStage || 'unknown',
              result.nextState.currentStage,
              { caseId: selectedCaseId }
            );
          }
        } catch (error) {
          logger.warn('Failed to persist workflow state', { error });
        }
      }

      onStreamingUpdate({
        stage: 'generating',
        message: 'Generating response...',
      });

      // Render SDUI if available
      if (result.sduiPage) {
        const renderResult = await renderSDUIPage(result.sduiPage, selectedCaseId, result.nextState.currentStage);
        onRenderedPageUpdate(renderResult);
      }

      // Update case stage if changed
      if (result.nextState.currentStage !== workflowState?.currentStage) {
        refetchCases();
      }

      onStreamingUpdate({ stage: 'complete', message: 'Done!' });
      setTimeout(() => onStreamingUpdate(null), 1000);

      return {
        success: true,
        traceId: result.traceId,
      };

    } catch (error) {
      return handleCommandError(error, query, workflowState?.currentStage);
    } finally {
      setIsProcessing(false);
      onLoadingUpdate(false);
    }
  }, [
    selectedCaseId,
    selectedCase,
    workflowState,
    currentSessionId,
    currentTenantId,
    onWorkflowStateUpdate,
    onRenderedPageUpdate,
    onStreamingUpdate,
    onLoadingUpdate,
    refetchCases,
  ]);

  const renderSDUIPage = useCallback(async (
    sduiPage: SDUIPageDefinition,
    caseId: string,
    stage: string
  ): Promise<RenderPageResult> => {
    const renderSpanId = `render-response-${Date.now()}`;
    sduiTelemetry.startSpan(renderSpanId, TelemetryEventType.RENDER_START, {
      caseId,
      stage,
    });

    try {
      const handleSDUIAction = (action: string, payload: any) => {
        if (action === 'select_hypothesis') {
          processCommand(
            `I want to explore the hypothesis: "${payload.title}". ${payload.description}. Please analyze this potential value driver deeper.`
          );
        }
      };

      const rendered = renderPage(sduiPage, {
        onAction: handleSDUIAction,
      });

      sduiTelemetry.endSpan(
        renderSpanId,
        TelemetryEventType.RENDER_COMPLETE,
        {
          componentCount: rendered.metadata?.componentCount,
          warnings: rendered.warnings?.length || 0,
        }
      );

      return rendered;
    } catch (renderError) {
      sduiTelemetry.endSpan(
        renderSpanId,
        TelemetryEventType.RENDER_ERROR,
        {},
        {
          message: renderError instanceof Error ? renderError.message : 'Render error',
          stack: renderError instanceof Error ? renderError.stack : undefined,
        }
      );
      throw renderError;
    }
  }, [processCommand]);

  const handleCommandError = useCallback((
    error: any,
    query: string,
    stage?: string
  ): CommandResult => {
    // Track error
    sduiTelemetry.recordEvent({
      type: TelemetryEventType.CHAT_REQUEST_ERROR,
      metadata: {
        caseId: selectedCaseId,
        stage,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    logger.error('Agent chat failed', error instanceof Error ? error : new Error(String(error)));

    // Show user-friendly error
    const friendlyError = toUserFriendlyError(error, 'AI Analysis', () =>
      processCommand(query)
    );

    showError(friendlyError.title, friendlyError.message, friendlyError.action);

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }, [selectedCaseId, showError, processCommand]);

  const persistWorkflowState = useCallback(async (
    sessionId: string,
    state: WorkflowState,
    tenantId: string
  ): Promise<void> => {
    // Use the interface to avoid circular dependencies
    const workflowStateService: IWorkflowStateService = await getWorkflowStateService();

    sduiTelemetry.recordEvent({
      type: TelemetryEventType.WORKFLOW_STATE_SAVE,
      metadata: {
        sessionId,
        stage: state.currentStage,
      },
    });

    await workflowStateService.saveWorkflowState(sessionId, state, tenantId);
  }, []);

  return {
    processCommand,
    isProcessing,
    canProcess: !!selectedCaseId && !isProcessing,
  };
}
