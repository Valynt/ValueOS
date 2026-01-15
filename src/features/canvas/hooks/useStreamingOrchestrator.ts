/**
 * useStreamingOrchestrator Hook
 *
 * Async agent response control and streaming updates for ChatCanvasLayout.
 * Manages SDUI rendering, streaming updates, and agent orchestration.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { StreamingUpdate } from "../../../services/UnifiedAgentOrchestrator";
import { SDUIPageDefinition } from '@sdui/schema";
import { renderPage } from '@sdui/renderPage";
import { useCanvasStore } from '@sdui/canvas/CanvasStore";
import { logger } from "../../../lib/logger";

export interface UseStreamingOrchestratorOptions {
  onUpdate?: (update: StreamingUpdate) => void;
  onComplete?: (finalPage: SDUIPageDefinition) => void;
  onError?: (error: Error) => void;
}

export interface UseStreamingOrchestratorReturn {
  // State
  isStreaming: boolean;
  currentStreamId: string | null;
  streamingUpdates: StreamingUpdate[];

  // Actions
  startStreaming: (streamId: string, initialData?: any) => void;
  updateStreaming: (update: StreamingUpdate) => void;
  completeStreaming: (finalData?: any) => Promise<void>;
  cancelStreaming: () => void;
  clearStreaming: () => void;

  // Computed
  latestUpdate: StreamingUpdate | null;
  isComplete: boolean;
}

export function useStreamingOrchestrator(
  options: UseStreamingOrchestratorOptions = {}
): UseStreamingOrchestratorReturn {
  const { onUpdate, onComplete, onError } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [streamingUpdates, setStreamingUpdates] = useState<StreamingUpdate[]>(
    []
  );

  const canvasStore = useCanvasStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Computed values
  const latestUpdate =
    streamingUpdates.length > 0
      ? streamingUpdates[streamingUpdates.length - 1]
      : null;
  const isComplete =
    latestUpdate?.type === "complete" || latestUpdate?.type === "error";

  const startStreaming = useCallback(
    (streamId: string, initialData?: any) => {
      logger.info("Starting streaming session", { streamId });

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setCurrentStreamId(streamId);
      setStreamingUpdates([]);

      // Initialize with starting update if provided
      if (initialData) {
        const initialUpdate: StreamingUpdate = {
          id: `${streamId}-start`,
          type: "start",
          timestamp: new Date().toISOString(),
          data: initialData,
        };
        setStreamingUpdates([initialUpdate]);
        onUpdate?.(initialUpdate);
      }
    },
    [onUpdate]
  );

  const updateStreaming = useCallback(
    (update: StreamingUpdate) => {
      if (isStreaming && update.id.includes(currentStreamId || "")) {
        logger.debug("Processing streaming update", {
          updateType: update.type,
          streamId: currentStreamId,
        });

        setStreamingUpdates((prev) => [...prev, update]);
        onUpdate?.(update);
      }
    },
    [isStreaming, currentStreamId, onUpdate]
  );

  const completeStreaming = useCallback(
    async (finalData?: any) => {
      if (!currentStreamId) {
        logger.warn("Cannot complete streaming: no active stream");
        return;
      }

      try {
        logger.info("Completing streaming session", {
          streamId: currentStreamId,
        });

        setIsStreaming(false);

        // Add completion update
        const completeUpdate: StreamingUpdate = {
          id: `${currentStreamId}-complete`,
          type: "complete",
          timestamp: new Date().toISOString(),
          data: finalData,
        };

        setStreamingUpdates((prev) => [...prev, completeUpdate]);
        onUpdate?.(completeUpdate);

        // Render final SDUI page if workflow state provided
        if (finalData?.workflow_state) {
          const finalPage = await renderPage(finalData.workflow_state);
          onComplete?.(finalPage);
          logger.info("Rendered final SDUI page", {
            streamId: currentStreamId,
            pageId: finalPage.id,
          });
        } else {
          onComplete?.(null as any);
        }
      } catch (error) {
        logger.error("Failed to complete streaming", {
          streamId: currentStreamId,
          error,
        });
        onError?.(error as Error);

        // Add error update
        const errorUpdate: StreamingUpdate = {
          id: `${currentStreamId}-error`,
          type: "error",
          timestamp: new Date().toISOString(),
          data: { error: (error as Error).message },
        };

        setStreamingUpdates((prev) => [...prev, errorUpdate]);
        onUpdate?.(errorUpdate);
      } finally {
        setCurrentStreamId(null);
        if (abortControllerRef.current) {
          abortControllerRef.current = null;
        }
      }
    },
    [currentStreamId, onUpdate, onComplete, onError]
  );

  const cancelStreaming = useCallback(() => {
    if (!currentStreamId) {
      return;
    }

    logger.info("Cancelling streaming session", { streamId: currentStreamId });

    // Abort any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsStreaming(false);
    setCurrentStreamId(null);

    // Add cancellation update
    const cancelUpdate: StreamingUpdate = {
      id: `${currentStreamId}-cancelled`,
      type: "cancelled",
      timestamp: new Date().toISOString(),
      data: { reason: "user_cancelled" },
    };

    setStreamingUpdates((prev) => [...prev, cancelUpdate]);
    onUpdate?.(cancelUpdate);
  }, [currentStreamId, onUpdate]);

  const clearStreaming = useCallback(() => {
    logger.debug("Clearing streaming state");

    setIsStreaming(false);
    setCurrentStreamId(null);
    setStreamingUpdates([]);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    isStreaming,
    currentStreamId,
    streamingUpdates,

    // Actions
    startStreaming,
    updateStreaming,
    completeStreaming,
    cancelStreaming,
    clearStreaming,

    // Computed
    latestUpdate,
    isComplete,
  };
}
