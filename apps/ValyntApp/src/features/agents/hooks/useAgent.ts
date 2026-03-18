import { useCallback, useState } from "react";

import type { AgentMessage, AgentSession, AgentStatus } from "../types";

import { apiClient } from "@/api/client/unified-api-client";

interface InvokeResponse {
  jobId?: string;
  status?: string;
  result?: {
    data?: unknown;
    reasoning?: { steps?: Array<{ description: string }> };
    confidence?: string;
    metadata?: { tokenUsage?: { total?: number } };
  };
  message?: string;
  cached?: boolean;
}

export function useAgent(agentId: string) {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    setStatus("idle");
    setMessages([]);
    setSession({
      id: `session_${Date.now()}`,
      agentId,
      status: "idle",
      messages: [],
      startedAt: new Date().toISOString(),
    });
  }, [agentId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: AgentMessage = {
        id: `msg_${Date.now()}`,
        agentId,
        type: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus("thinking");
      setError(null);

      try {
        const sessionId = session?.id ?? `session_${Date.now()}`;

        const response = await apiClient.post<InvokeResponse>(
          `/api/agents/${agentId}/invoke`,
          {
            query: content,
            sessionId,
            context: {},
          },
        );

        if (!response.success || !response.data) {
          throw new Error(response.error ?? "Agent invocation failed");
        }

        const payload = response.data;

        // Extract text content from the agent result
        let agentContent: string;
        const result = payload.result;
        if (result?.data && typeof result.data === "object") {
          const data = result.data as Record<string, unknown>;
          agentContent =
            (data.narrative as string) ??
            (data.summary as string) ??
            (data.content as string) ??
            JSON.stringify(result.data, null, 2);
        } else if (typeof result?.data === "string") {
          agentContent = result.data;
        } else {
          agentContent = payload.message ?? "Agent completed successfully.";
        }

        const confidence =
          (result?.confidence as "high" | "medium" | "low" | undefined) ??
          "medium";

        const agentMessage: AgentMessage = {
          id: `msg_${Date.now() + 1}`,
          agentId,
          type: "agent",
          content: agentContent,
          timestamp: new Date().toISOString(),
          metadata: { confidence },
        };

        setMessages((prev) => [...prev, agentMessage]);
        setStatus("idle");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Agent request failed";
        setError(message);
        setStatus("error");

        // Surface the error as a system message so the user sees it in context
        const errorMessage: AgentMessage = {
          id: `msg_err_${Date.now()}`,
          agentId,
          type: "system",
          content: `Error: ${message}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [agentId, session],
  );

  const executeAction = useCallback(async (actionId: string) => {
    setStatus("executing");
    try {
      // ADR-0014 / Phase 8: use UnifiedApiClient for auth, retry, error handling
      const result = await apiClient.post<{ message?: string }>(
        `/api/agents/${agentId}/actions/${actionId}`,
        {},
      );
      // optionally append a system message or update session based on result
      const systemMsg: AgentMessage = {
        id: `msg_${Date.now()}`,
        agentId,
        type: "system",
        content: `Action ${actionId} executed: ${result?.data?.message ?? 'success'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMsg]);

      setStatus("completed");
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      setStatus("error");
      throw err;
    }
  }, [agentId]);

  const reset = useCallback(() => {
    setStatus("idle");
    setMessages([]);
    setSession(null);
    setError(null);
  }, []);

  return {
    status,
    messages,
    session,
    error,
    startSession,
    sendMessage,
    executeAction,
    reset,
  };
}
