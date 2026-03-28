/**
 * Orchestration Layer: useAgentOrchestrator
 *
 * Manages the agent lifecycle by consuming real backend events:
 *   IDLE → PLANNING → EXECUTING → IDLE (or ERROR)
 *
 * State transitions are driven exclusively by SSE payloads from
 * /api/agents/jobs/:jobId/stream — no mock timers or hardcoded steps.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";

import type { AgentProgressEvent, ChatMessage } from "./useAgentStream";
import { useAgentStream } from "./useAgentStream";

export type AgentState = "IDLE" | "PLANNING" | "EXECUTING" | "ERROR";

export interface ThoughtEvent {
  id: string;
  type: "thought" | "action" | "observation" | "result";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  currentStep: string;
  activeWorkers: string[];
  planSteps: string[];
  completedSteps: string[];
}

interface UseAgentOrchestratorOptions {
  agentId?: string;
  onThought?: (event: ThoughtEvent) => void;
  onStateChange?: (state: AgentState) => void;
  onError?: (error: Error) => void;
}

interface UseAgentOrchestratorReturn {
  state: AgentState;
  context: AgentContext;
  thoughts: ThoughtEvent[];
  isProcessing: boolean;
  submitQuery: (query: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const initialContext: AgentContext = {
  currentStep: "",
  activeWorkers: [],
  planSteps: [],
  completedSteps: [],
};

export function useAgentOrchestrator(
  options: UseAgentOrchestratorOptions = {}
): UseAgentOrchestratorReturn {
  const { agentId = "opportunity", onThought, onStateChange, onError } = options;

  const [state, setState] = useState<AgentState>("IDLE");
  const [context, setContext] = useState<AgentContext>(initialContext);
  const [thoughts, setThoughts] = useState<ThoughtEvent[]>([]);

  // Tracks the in-flight POST so cancel() can abort it
  const invokeAbortRef = useRef<AbortController | null>(null);

  const isProcessing = state === "PLANNING" || state === "EXECUTING";

  // Notify caller on state change
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const addThought = useCallback(
    (event: ThoughtEvent) => {
      setThoughts((prev) => [...prev, event]);
      onThought?.(event);
    },
    [onThought],
  );

  // Stable refs for callbacks — avoids recreating the options object on every
  // render, which would cause useAgentStream's useCallback deps to fire and
  // trigger an infinite re-render loop.
  const addThoughtRef = useRef(addThought);
  addThoughtRef.current = addThought;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const streamOptions = useMemo(
    () => ({
      context: { sessionId: "", agentId, messages: [] as ChatMessage[], isStreaming: false },

      onProgress(event: AgentProgressEvent) {
        // processing heartbeat → EXECUTING state + update current step
        setState("EXECUTING");
        setContext((prev) => ({
          ...prev,
          currentStep: event.subTask ?? event.agentId ?? "Processing\u2026",
          activeWorkers: event.agentId ? [event.agentId] : prev.activeWorkers,
        }));
        addThoughtRef.current({
          id: crypto.randomUUID(),
          type: "action",
          content: event.subTask ?? event.agentId ?? "Processing\u2026",
          timestamp: new Date().toISOString(),
        });
      },

      onMessage(message: ChatMessage) {
        // completed event — result arrives as an assistant message
        addThoughtRef.current({
          id: crypto.randomUUID(),
          type: "result",
          content: message.content,
          timestamp: message.timestamp,
          metadata: message.metadata,
        });
        setState("IDLE");
        setContext(initialContext);
      },

      onError(error: Error) {
        setState("ERROR");
        setContext(initialContext);
        onErrorRef.current?.(error);
      },
    }),
    // Intentional dependency omission: addThoughtRef and onErrorRef are stable
    // refs that always point to the latest callbacks. Including them would cause
    // unnecessary re-creation of stream options on every render. Only agentId
    // changes should trigger recreation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId],
  );

  // SSE stream — wired to drive state transitions
  const { openStream, closeStream } = useAgentStream(streamOptions);

  const submitQuery = useCallback(
    async (query: string) => {
      if (isProcessing) return;

      // Cancel any previous in-flight request
      invokeAbortRef.current?.abort();
      invokeAbortRef.current = new AbortController();

      setState("PLANNING");
      addThought({
        id: crypto.randomUUID(),
        type: "thought",
        content: `Analyzing request: "${query}"`,
        timestamp: new Date().toISOString(),
      });

      try {
        const res = await apiClient.post<{ data: { jobId?: string; result?: unknown; mode?: string } }>(
          `/api/agents/${agentId}/invoke`,
          { query, sessionId: "", context: {} },
        );

        if (!res.success) {
          throw new Error(res.error?.message ?? "Agent invocation failed");
        }

        const payload = res.data?.data;

        if (!payload?.jobId) {
          // Direct-mode — result already available, no stream needed
          addThought({
            id: crypto.randomUUID(),
            type: "result",
            content:
              typeof payload?.result === "string"
                ? payload.result
                : JSON.stringify(payload?.result ?? "Done."),
            timestamp: new Date().toISOString(),
          });
          setState("IDLE");
          setContext(initialContext);
          return;
        }

        // Async mode — open SSE stream; state transitions driven by events
        openStream(payload.jobId);
      } catch (error) {
        if (invokeAbortRef.current?.signal.aborted) {
          // User cancelled — already handled by cancel()
          return;
        }
        setState("ERROR");
        setContext(initialContext);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [isProcessing, agentId, addThought, openStream, onError],
  );

  const cancel = useCallback(() => {
    invokeAbortRef.current?.abort();
    invokeAbortRef.current = null;
    closeStream();
    setState("IDLE");
    setContext(initialContext);
  }, [closeStream]);

  const reset = useCallback(() => {
    cancel();
    setThoughts([]);
  }, [cancel]);

  return {
    state,
    context,
    thoughts,
    isProcessing,
    submitQuery,
    cancel,
    reset,
  };
}

export default useAgentOrchestrator;
