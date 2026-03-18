/**
 * Agent streaming hook — SSE consumer for real-time agent execution.
 *
 * Flow:
 *  1. `sendMessage` → POST /api/agents/:agentId/invoke  → returns { jobId }
 *  2. Opens SSE on GET /api/agents/jobs/:jobId/stream
 *  3. Streams status updates until `completed` or `error`
 *
 * Used by AgentChat.tsx.
 */

import { useCallback, useRef, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentChatContext {
  sessionId: string;
  agentId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  customer?: string;
  industry?: string;
  drivers?: string[];
}

interface AgentInvokeResult {
  jobId: string;
  status: string;
  mode?: "direct" | "kafka";
  result?: unknown;
}

interface UseAgentStreamOptions {
  context?: AgentChatContext;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onToolExecuted?: (toolCall: unknown, result: unknown) => void;
}

function makeId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useAgentStream(options?: UseAgentStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const openStream = useCallback(
    (jobId: string) => {
      closeStream();

      const url = `/api/agents/jobs/${jobId}/stream`;
      const es = new EventSource(url);
      eventSourceRef.current = es;
      setIsStreaming(true);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;

          if (data.status === "completed") {
            const content =
              typeof data.result === "string"
                ? data.result
                : JSON.stringify(data.result ?? "Agent completed.");
            const msg: ChatMessage = {
              id: makeId(),
              role: "assistant",
              content,
              timestamp: new Date().toISOString(),
              metadata: data,
            };
            setMessages((prev) => [...prev, msg]);
            options?.onMessage?.(msg);
            closeStream();
          } else if (data.status === "error") {
            const err = new Error(
              typeof data.error === "string" ? data.error : "Agent execution failed",
            );
            setError(err);
            options?.onError?.(err);
            closeStream();
          }
          // "processing" events are progress heartbeats — no UI update needed
        } catch {
          // ignore malformed SSE frames
        }
      };

      es.onerror = () => {
        const err = new Error("SSE connection lost");
        setError(err);
        options?.onError?.(err);
        closeStream();
      };
    },
    [closeStream, options],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const agentId = options?.context?.agentId || "opportunity";
      const sessionId = options?.context?.sessionId || "";

      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setError(null);

      try {
        const res = await apiClient.post<{ data: AgentInvokeResult }>(
          `/api/agents/${agentId}/invoke`,
          {
            query: content,
            sessionId,
            context: {
              customer: options?.context?.customer,
              industry: options?.context?.industry,
              drivers: options?.context?.drivers,
            },
          },
        );

        if (!res.success) {
          throw new Error(res.error?.message ?? "Agent invocation failed");
        }

        const result = res.data?.data;
        if (!result?.jobId) {
          // Direct-mode response (no async job)
          const directContent =
            typeof result?.result === "string"
              ? result.result
              : JSON.stringify(result?.result ?? "Done.");
          const assistantMsg: ChatMessage = {
            id: makeId(),
            role: "assistant",
            content: directContent,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          options?.onMessage?.(assistantMsg);
          return;
        }

        // Async mode — open SSE stream
        openStream(result.jobId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Unknown error");
        setError(e);
        options?.onError?.(e);
      }
    },
    [openStream, options],
  );

  const applySuggestion = useCallback(
    (suggestionId: string) => {
      const msg: ChatMessage = {
        id: makeId(),
        role: "system",
        content: `Applied suggestion: ${suggestionId}`,
        timestamp: new Date().toISOString(),
        metadata: { type: "suggestion_applied", suggestionId },
      };
      setMessages((prev) => [...prev, msg]);
      options?.onMessage?.(msg);
    },
    [options],
  );

  const executeTool = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      try {
        const res = await apiClient.post<{ result: unknown }>(
          `/api/agents/tools/${toolName}/execute`,
          { args },
        );
        if (!res.success) {
          throw new Error(res.error?.message ?? "Tool execution failed");
        }
        options?.onToolExecuted?.({ toolName, args }, res.data?.result);
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Tool execution failed");
        setError(e);
        options?.onError?.(e);
      }
    },
    [options],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    closeStream();
  }, [closeStream]);

  return {
    messages,
    isStreaming,
    sendMessage,
    applySuggestion,
    executeTool,
    clearMessages,
    context: {
      sessionId: options?.context?.sessionId ?? "",
      agentId: options?.context?.agentId ?? "",
      messages,
      isStreaming,
      customer: options?.context?.customer,
      industry: options?.context?.industry,
      drivers: options?.context?.drivers,
    },
    error,
  };
}
