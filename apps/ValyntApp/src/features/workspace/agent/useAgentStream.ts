/**
 * useAgentStream Hook
 *
 * Connects the agent API to the UI store.
 * Handles both real API calls and mock fallback.
 */

import { useCallback, useRef } from 'react';
import { useAgentStore } from './store';
import { generateMockAgentStream } from './mock-stream';
import {
  createErrorEvent,
  createPhaseChangeEvent,
} from './api-adapter';
import type { AgentPhase, AgentEvent, Artifact } from './types';
import { llmService, AVAILABLE_MODELS } from '@/services/llm';
import { AgentOrchestratorAdapter } from '@/services/AgentOrchestratorAdapter';

// Configuration
const USE_MOCK_API = false; // Set to false to use real backend API
const API_TIMEOUT = 30000; // 30 seconds

// Generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

interface UseAgentStreamOptions {
  /** Use mock API instead of real backend */
  useMock?: boolean;
  /** Company name for context */
  companyName?: string;
  /** Callback when stream completes */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

interface AgentStreamResult {
  /** Send a message to the agent */
  sendMessage: (message: string) => Promise<void>;
  /** Cancel the current stream */
  cancel: () => void;
  /** Whether a stream is currently active */
  isStreaming: boolean;
}

/**
 * Hook to manage agent streaming interactions
 */
export function useAgentStream(options: UseAgentStreamOptions = {}): AgentStreamResult {
  const {
    useMock = USE_MOCK_API,
    companyName = 'Target Company',
    onComplete,
    onError,
  } = options;

  const abortControllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const adapterRef = useRef<AgentOrchestratorAdapter | null>(null);

  const {
    phase,
    messages,
    isStreaming,
    processEvent,
    sendMessage: storeAddMessage,
    startRun,
    cancelRun,
  } = useAgentStore();

  /**
   * Send message using mock API
   */
  const sendWithMock = useCallback(async (message: string) => {
    const runId = `run_${Date.now()}`;
    runIdRef.current = runId;
    startRun(runId);

    try {
      await generateMockAgentStream(
        message,
        processEvent,
        {
          companyName,
          includeClarify: messages.length === 0,
          eventDelay: 200,
        }
      );
      onComplete?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      processEvent(createErrorEvent(err, runId));
      onError?.(err);
    }
  }, [companyName, messages.length, processEvent, startRun, onComplete, onError]);

  /**
   * Send message using real API
   *
   * Uses the AgentOrchestratorAdapter to connect to the backend
   * UnifiedAgentOrchestrator for async agent execution.
   */
  const sendWithRealAPI = useCallback(async (message: string) => {
    const runId = `run_${Date.now()}`;
    runIdRef.current = runId;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    startRun(runId);

    try {
      // Create a new adapter instance for this request
      if (!adapterRef.current) {
        adapterRef.current = new AgentOrchestratorAdapter();
      }

      // Send message to the backend
      await adapterRef.current.invokeAgent(
        'coordinator', // Use coordinator agent by default
        message,
        { companyName },
        runId,
        processEvent
      );

      onComplete?.();

    } catch (error) {
      if (signal.aborted) return;

      const err = error instanceof Error ? error : new Error(String(error));
      processEvent(createErrorEvent(err, runId));
      onError?.(err);
    }
  }, [companyName, processEvent, startRun, onComplete, onError]);

  /**
   * Main send message function
   */
  const sendMessage = useCallback(async (message: string) => {
    if (isStreaming) {
      console.warn('Already streaming, ignoring message');
      return;
    }

    // Add user message to store
    storeAddMessage(message);

    // Use mock or real API
    if (useMock) {
      await sendWithMock(message);
    } else {
      await sendWithRealAPI(message);
    }
  }, [isStreaming, useMock, storeAddMessage, sendWithMock, sendWithRealAPI]);

  /**
   * Cancel current stream
   */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    if (adapterRef.current) {
      adapterRef.current.cancel();
    }
    cancelRun();
  }, [cancelRun]);

  return {
    sendMessage,
    cancel,
    isStreaming,
  };
}

export default useAgentStream;
