/**
 * Agent streaming hook — SSE consumer for real-time agent execution.
 *
 * Flow:
 *  1. `sendMessage` → POST /api/agents/:agentId/invoke  → returns { jobId }
 *  2. Opens SSE on GET /api/agents/jobs/:jobId/stream via fetchEventSource
 *     - Auth headers sent on every connection and reconnect
 *     - Last-Event-ID cursor sent on reconnect for resumability
 *     - Transient network errors trigger automatic retry (library default)
 *  3. Streams status updates until `completed` or `error`
 *  4. `processing` heartbeats forwarded to optional `onProgress` callback
 *
 * Used by AgentChat.tsx and useAgentOrchestrator.ts.
 */

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useCallback, useRef, useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";

export interface ReadinessComponent {
  name?: string;
  score: number;
  /** @deprecated Weight is not currently consumed by the UI */
  weight?: number;
}

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

export interface AgentProgressEvent {
  status: "processing";
  agentId?: string;
  subTask?: string;
  queuedAt?: string;
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
  onProgress?: (event: AgentProgressEvent) => void;
  onError?: (error: Error) => void;
  onToolExecuted?: (toolCall: unknown, result: unknown) => void;
}

function makeId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // AbortController ref — passed to fetchEventSource so closeStream() terminates the fetch
  const abortControllerRef = useRef<AbortController | null>(null);
  // Last-Event-ID cursor — sent on reconnect so the backend can resume the stream
  const lastEventIdRef = useRef<string | null>(null);

  const closeStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsReconnecting(false);
  }, []);

  const openStream = useCallback(
    (jobId: string) => {
      closeStream();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);

      const url = `/api/agents/jobs/${jobId}/stream`;

      // fetchEventSource handles reconnect + exponential backoff automatically.
      // We pass the signal so closeStream() / cancel() can abort it.
      // apiClient.fetchRaw is used as the underlying fetch so auth headers
      // (Authorization, x-tenant-id) are applied on every connection and
      // reconnect without duplicating header logic here.
      void fetchEventSource(url, {
        signal: controller.signal,
        fetch: apiClient.fetchRaw.bind(apiClient),

        // Last-Event-ID is sent as a header so the backend can resume the
        // stream from the last acknowledged event on reconnect.
        headers: {
          ...(lastEventIdRef.current
            ? { "Last-Event-ID": lastEventIdRef.current }
            : {}),
        },

        async onopen(response) {
          if (response.ok) return;
          // Non-2xx on open — throw to trigger the library's retry logic
          throw new Error(`SSE open failed: ${response.status}`);
        },

        onmessage(event) {
          // Track Last-Event-ID for resumability on reconnect
          if (event.id) {
            lastEventIdRef.current = event.id;
          }

          // Reset reconnect indicators on successful message receipt
          setIsReconnecting(false);
          setReconnectAttempts(0);

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
            } else if (data.status === "processing") {
              // Forward heartbeat to caller — do not append a message
              options?.onProgress?.({
                status: "processing",
                agentId: typeof data.agentId === "string" ? data.agentId : undefined,
                subTask: typeof data.subTask === "string" ? data.subTask : undefined,
                queuedAt: typeof data.queuedAt === "string" ? data.queuedAt : undefined,
              });
            }
          } catch {
            // Ignore malformed SSE frames
          }
        },

        onerror(err) {
          // fetchEventSource calls onerror on transient failures and retries
          // automatically unless we rethrow. Only rethrow on abort (user cancel).
          if (controller.signal.aborted) {
            throw err; // Stop retrying — user cancelled
          }
          // Surface the transient error and mark as reconnecting so the UI
          // can show a "reconnecting…" indicator.
          setIsReconnecting(true);
          setReconnectAttempts((n) => n + 1);
          options?.onError?.(err instanceof Error ? err : new Error("SSE connection lost — retrying"));
          // Return undefined to let the library retry with backoff
        },
      });
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

      // Reset reconnect state for the new job
      lastEventIdRef.current = null;
      setReconnectAttempts(0);
      setIsReconnecting(false);

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
    lastEventIdRef.current = null;
    setReconnectAttempts(0);
    setIsReconnecting(false);
  }, [closeStream]);

  return {
    messages,
    isStreaming,
    isReconnecting,
    reconnectAttempts,
    sendMessage,
    applySuggestion,
    executeTool,
    clearMessages,
    /** Manually open a stream for a given jobId (e.g. on reconnect). */
    openStream,
    /** Abort the active stream and set isStreaming to false. */
    closeStream,
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
