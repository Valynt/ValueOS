/**
 * Agent streaming hook — SSE consumer for real-time agent execution.
 *
 * Flow:
 *  1. `sendMessage` → POST /api/agents/:agentId/invoke  → returns { jobId }
 *  2. Opens SSE on GET /api/agents/jobs/:jobId/stream
 *  3. Streams status updates until `completed` or `error`
 *
 * Reconnect behaviour:
 *  - On connection loss, retries with exponential backoff (1 s → 30 s, max 5 attempts).
 *  - Passes `?lastEventId=<id>` on reconnect so the server can resume the stream.
 *    (Native EventSource sends Last-Event-ID automatically only when the server sets
 *    `id:` fields; the URL param is a belt-and-suspenders fallback for servers that
 *    read it from the query string.)
 *  - Deduplicates messages by event ID to prevent duplicates on reconnect.
 *  - After 5 failed attempts, surfaces an error with the jobId as correlation ID.
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

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

function makeId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function reconnectDelay(attempt: number): number {
  return Math.min(BASE_RECONNECT_DELAY_MS * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
}

export function useAgentStream(options?: UseAgentStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastEventIdRef = useRef<string | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  // Tracks event IDs seen in this stream session to deduplicate on reconnect.
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  // Whether the stream has reached a terminal state (completed/error).
  const isTerminalRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeStream = useCallback(() => {
    clearReconnectTimer();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setIsReconnecting(false);
  }, [clearReconnectTimer]);

  // Forward declaration — openStream and scheduleReconnect reference each other.
  const openStreamRef = useRef<((jobId: string) => void) | null>(null);

  const scheduleReconnect = useCallback(
    (jobId: string) => {
      const attempt = reconnectAttemptsRef.current;

      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        const correlationId = activeJobIdRef.current ?? jobId;
        const err = new Error(
          `SSE connection lost after ${MAX_RECONNECT_ATTEMPTS} attempts (jobId: ${correlationId})`,
        );
        setError(err);
        options?.onError?.(err);
        closeStream();
        isTerminalRef.current = true;
        return;
      }

      const delay = reconnectDelay(attempt);
      reconnectAttemptsRef.current += 1;
      setReconnectAttempts(reconnectAttemptsRef.current);
      setIsReconnecting(true);

      reconnectTimerRef.current = setTimeout(() => {
        openStreamRef.current?.(jobId);
      }, delay);
    },
    [closeStream, options],
  );

  const openStream = useCallback(
    (jobId: string) => {
      // Close any existing connection without resetting reconnect state.
      clearReconnectTimer();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      activeJobIdRef.current = jobId;
      isTerminalRef.current = false;

      // Append lastEventId as a query param so the server can resume the stream.
      const lastId = lastEventIdRef.current;
      const url = lastId
        ? `/api/agents/jobs/${jobId}/stream?lastEventId=${encodeURIComponent(lastId)}`
        : `/api/agents/jobs/${jobId}/stream`;

      const es = new EventSource(url);
      eventSourceRef.current = es;
      setIsStreaming(true);
      setIsReconnecting(false);

      es.onmessage = (event) => {
        try {
          // Track the last event ID for reconnect cursor.
          if (event.lastEventId) {
            lastEventIdRef.current = event.lastEventId;
          }

          // Deduplicate: skip events already rendered in this session.
          if (event.lastEventId && seenEventIdsRef.current.has(event.lastEventId)) {
            return;
          }
          if (event.lastEventId) {
            seenEventIdsRef.current.add(event.lastEventId);
          }

          // Reset reconnect counter on successful message receipt.
          reconnectAttemptsRef.current = 0;
          setReconnectAttempts(0);

          const data = JSON.parse(event.data) as Record<string, unknown>;

          if (data.status === "completed") {
            isTerminalRef.current = true;
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
            isTerminalRef.current = true;
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
        // If already in a terminal state, the connection closing is expected.
        if (isTerminalRef.current) {
          closeStream();
          return;
        }
        // Otherwise attempt reconnect with backoff.
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        scheduleReconnect(jobId);
      };
    },
    [clearReconnectTimer, closeStream, scheduleReconnect, options],
  );

  // Keep the ref in sync so scheduleReconnect can call openStream without a
  // circular dependency in the useCallback dependency arrays.
  openStreamRef.current = openStream;

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

      // Reset reconnect state for the new job.
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      lastEventIdRef.current = null;
      seenEventIdsRef.current = new Set();
      isTerminalRef.current = false;

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
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    lastEventIdRef.current = null;
    seenEventIdsRef.current = new Set();
    isTerminalRef.current = false;
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
