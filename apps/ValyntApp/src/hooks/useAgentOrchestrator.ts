/**
 * Orchestration Layer: useAgentOrchestrator
 * 
 * Manages the Agent Lifecycle:
 * - Handles WebSocket streams
 * - Parses ThoughtEvents
 * - Manages state transitions: IDLE → PLANNING → EXECUTING → IDLE
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
  const { onThought, onStateChange, onError } = options;

  const [state, setState] = useState<AgentState>("IDLE");
  const [context, setContext] = useState<AgentContext>(initialContext);
  const [thoughts, setThoughts] = useState<ThoughtEvent[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const isProcessing = state === "PLANNING" || state === "EXECUTING";

  // Notify on state change
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const updateState = useCallback((newState: AgentState) => {
    setState(newState);
  }, []);

  const addThought = useCallback((event: ThoughtEvent) => {
    setThoughts((prev) => [...prev, event]);
    onThought?.(event);
  }, [onThought]);

  const submitQuery = useCallback(async (query: string) => {
    if (isProcessing) return;

    // Cancel any existing request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      updateState("PLANNING");

      // Simulate planning phase
      addThought({
        id: crypto.randomUUID(),
        type: "thought",
        content: `Analyzing request: "${query}"`,
        timestamp: new Date().toISOString(),
      });

      // Simulate plan creation
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      setContext((prev) => ({
        ...prev,
        currentStep: "PLANNING",
        planSteps: [
          "Gather context from value case",
          "Analyze relevant data sources",
          "Generate insights",
          "Format response",
        ],
      }));

      addThought({
        id: crypto.randomUUID(),
        type: "thought",
        content: "Created execution plan with 4 steps",
        timestamp: new Date().toISOString(),
      });

      updateState("EXECUTING");

      // Simulate execution
      const steps = ["Gathering context...", "Analyzing data...", "Generating insights...", "Formatting response..."];
      
      for (let i = 0; i < steps.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error("Cancelled");
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
        
        setContext((prev) => ({
          ...prev,
          currentStep: steps[i] ?? "",
          completedSteps: [...prev.completedSteps, prev.planSteps[i] ?? ""],
        }));

        addThought({
          id: crypto.randomUUID(),
          type: "action",
          content: steps[i] ?? "",
          timestamp: new Date().toISOString(),
        });
      }

      // Final result
      addThought({
        id: crypto.randomUUID(),
        type: "result",
        content: `Completed analysis for: "${query}"`,
        timestamp: new Date().toISOString(),
      });

      updateState("IDLE");
      setContext(initialContext);

    } catch (error) {
      if (error instanceof Error && error.message === "Cancelled") {
        updateState("IDLE");
        return;
      }
      
      updateState("ERROR");
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [isProcessing, updateState, addThought, onError]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    updateState("IDLE");
    setContext(initialContext);
  }, [updateState]);

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
