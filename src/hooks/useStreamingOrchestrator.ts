/**
 * useStreamingOrchestrator Hook
 *
 * Extracted from ChatCanvasLayout.tsx (lines 927-1159)
 * Handles agent chat processing, streaming updates, and telemetry
 *
 * Responsibilities:
 * - Agent chat processing
 * - Streaming updates management
 * - Loading states
 * - Telemetry tracking
 * - Error handling
 */

import { useState, useCallback } from 'react';
import { agentChatService } from '../services/AgentChatService';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { RenderPageResult } from '@sdui/renderPage';
import { StreamingUpdate } from '../services/UnifiedAgentOrchestrator';
import { logger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';

export interface StreamingOrchestratorReturn {
  // Processing state
  isLoading: boolean;
  streamingUpdate: StreamingUpdate | null;
  renderedPage: RenderPageResult | null;

  // Actions
  processCommand: (query: string, context: CommandContext) => Promise<void>;
  cancelProcessing: () => void;
  retryProcessing: () => Promise<void>;

  // Telemetry
  telemetry: {
    startSpan: (id: string, type: TelemetryEventType, data: any) => void;
    endSpan: (id: string, type: TelemetryEventType, data: any) => void;
  };

  // Error handling
  error: Error | null;
  clearError: () => void;
}

export interface CommandContext {
  caseId: string;
  userId: string;
  sessionId: string;
  workflowState: WorkflowState;
  tenantId?: string;
}

export enum TelemetryEventType {
  CHAT_REQUEST_START = 'chat.request.start',
  CHAT_REQUEST_COMPLETE = 'chat.request.complete',
  CHAT_REQUEST_ERROR = 'chat.request.error',
  STREAMING_UPDATE = 'chat.streaming.update',
}

export const useStreamingOrchestrator = (
  onRenderedPage: (page: RenderPageResult) => void,
  onWorkflowStateUpdate: (state: WorkflowState) => void
): StreamingOrchestratorReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingUpdate, setStreamingUpdate] = useState<StreamingUpdate | null>(null);
  const [renderedPage, setRenderedPage] = useState<RenderPageResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);

  // Telemetry tracking
  const telemetry = {
    startSpan: useCallback((id: string, type: TelemetryEventType, data: any) => {
      logger.info('Telemetry span started', { id, type, data });
      // In real implementation, this would send to telemetry service
    }, []),

    endSpan: useCallback((id: string, type: TelemetryEventType, data: any) => {
      logger.info('Telemetry span ended', { id, type, data });
      // In real implementation, this would send to telemetry service
    }, []),
  };

  // Process a command through the agent chat service
  const processCommand = useCallback(async (
    query: string,
    context: CommandContext
  ): Promise<void> => {
    const processingId = uuidv4();
    setCurrentProcessingId(processingId);
    setError(null);

    try {
      setIsLoading(true);
      setStreamingUpdate({
        stage: "analyzing",
        message: "Understanding your request...",
      });

      // Track chat request start
      const chatSpanId = `chat-${Date.now()}`;
      telemetry.startSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_START,
        {
          caseId: context.caseId,
          stage: context.workflowState.currentStage,
          queryLength: query.length,
        }
      );

      // Update streaming state
      setStreamingUpdate({
        stage: "processing",
        message: "Consulting AI agent...",
      });

      // Process through AgentChatService
      const result = await agentChatService.chat({
        query,
        caseId: context.caseId,
        userId: context.userId,
        sessionId: context.sessionId,
        workflowState: context.workflowState,
      });

      // Track chat completion
      telemetry.endSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_COMPLETE,
        {
          hasSDUI: !!result.sduiPage,
          stageTransitioned: result.nextState.currentStage !== context.workflowState.currentStage,
        }
      );

      // Update rendered page
      if (result.sduiPage) {
        setRenderedPage({
          page: result.sduiPage,
          components: [], // Would be populated by renderPage
          metadata: {
            renderTime: 0,
            componentCount: 0,
          },
        });
        onRenderedPage(result.sduiPage);
      }

      // Update workflow state if changed
      if (result.nextState.currentStage !== context.workflowState.currentStage) {
        onWorkflowStateUpdate(result.nextState);
      }

      // Final streaming update
      setStreamingUpdate({
        stage: "complete",
        message: "Analysis complete",
      });

      logger.info('Command processed successfully', {
        processingId,
        caseId: context.caseId,
        hasSDUI: !!result.sduiPage,
      });

    } catch (error) {
      const err = error as Error;
      setError(err);

      // Track error
      telemetry.endSpan(
        `chat-${Date.now()}`,
        TelemetryEventType.CHAT_REQUEST_ERROR,
        {
          error: err.message,
          stack: err.stack,
        }
      );

      logger.error('Command processing failed', err, {
        processingId,
        caseId: context.caseId,
      });

      // Show error state in streaming
      setStreamingUpdate({
        stage: "error",
        message: "Processing failed. Please try again.",
      });

    } finally {
      setIsLoading(false);
      setCurrentProcessingId(null);

      // Clear streaming update after delay
      setTimeout(() => {
        setStreamingUpdate(null);
      }, 3000);
    }
  }, [telemetry, onRenderedPage, onWorkflowStateUpdate]);

  // Cancel current processing
  const cancelProcessing = useCallback(() => {
    if (currentProcessingId && isLoading) {
      logger.info('Processing cancelled', { processingId: currentProcessingId });

      setIsLoading(false);
      setStreamingUpdate({
        stage: "cancelled",
        message: "Processing cancelled",
      });
      setCurrentProcessingId(null);
      setError(null);
    }
  }, [currentProcessingId, isLoading]);

  // Retry last processing
  const retryProcessing = useCallback(async () => {
    // This would need to store the last command context
    logger.info('Retry requested');
    setError(null);

    // Implementation would depend on stored context
    // For now, just clear error state
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Processing state
    isLoading,
    streamingUpdate,
    renderedPage,

    // Actions
    processCommand,
    cancelProcessing,
    retryProcessing,

    // Telemetry
    telemetry,

    // Error handling
    error,
    clearError,
  };
};
