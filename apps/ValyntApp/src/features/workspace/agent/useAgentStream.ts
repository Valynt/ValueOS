import { useCallback, useRef } from 'react';
import { useAgentStore } from './store';
import { generateMockAgentStream } from './mock-stream';
import { createErrorEvent } from './api-adapter';
import type { AgentEvent } from './types';
import { AgentOrchestratorAdapter } from '@/services/AgentOrchestratorAdapter';

// Configuration
const USE_MOCK_API = false;

// Generate unique IDs
const generateRunId = () => `run_${Date.now()}`;

interface UseAgentStreamOptions {
  useMock?: boolean;
  companyName?: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface AgentStreamResult {
  sendMessage: (message: string) => Promise<void>;
  cancel: () => void;
  isStreaming: boolean;
}

export function useAgentStream(
  options: UseAgentStreamOptions = {}
): AgentStreamResult {
  const {
    useMock = USE_MOCK_API,
    companyName = 'Target Company',
    onComplete,
    onError,
  } = options;

  const abortControllerRef = useRef<AbortController | null>(null);
  const adapterRef = useRef<AgentOrchestratorAdapter | null>(null);
  const runIdRef = useRef<string | null>(null);

  const {
    isStreaming,
    processEvent,
    sendMessage: storeAddMessage,
    startRun,
    cancelRun,
  } = useAgentStore();

  /**
   * Mock path (local dev / demos)
   */
  const sendWithMock = useCallback(
    async (message: string) => {
      const runId = generateRunId();
      runIdRef.current = runId;
      startRun(runId);

      try {
        await generateMockAgentStream(
          message,
          processEvent,
          { companyName, eventDelay: 200 }
        );

        onComplete?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        processEvent(createErrorEvent(err, runId));
        onError?.(err);
      }
    },
    [companyName, processEvent, startRun, onComplete, onError]
  );

  /**
   * Real backend streaming via Agent Orchestrator
   */
  const sendWithRealAPI = useCallback(
    async (message: string) => {
      const runId = generateRunId();
      runIdRef.current = runId;

      abortControllerRef.current = new AbortController();
      startRun(runId);

      try {
        if (!adapterRef.current) {
          adapterRef.current = new AgentOrchestratorAdapter();
        }

        await adapterRef.current.invokeAgent(
          'coordinator',
          message,
          { companyName },
          runId,
          processEvent
        );

        onComplete?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        processEvent(createErrorEvent(err, runId));
        onError?.(err);
      }
    },
    [companyName, processEvent, startRun, onComplete, onError]
  );

  /**
   * Public send
   */
  const sendMessage = useCallback(
    async (message: string) => {
      if (isStreaming) return;

      storeAddMessage(message);

      if (useMock) {
        await sendWithMock(message);
      } else {
        await sendWithRealAPI(message);
      }
    },
    [isStreaming, useMock, storeAddMessage, sendWithMock, sendWithRealAPI]
  );

  /**
   * Cancel
   */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    adapterRef.current?.cancel();
    cancelRun();
  }, [cancelRun]);

  return {
    sendMessage,
    cancel,
    isStreaming,
  };
}

export default useAgentStream;
