import { useState, useCallback } from "react";
import type { Agent, AgentMessage, AgentStatus, AgentSession } from "../types";

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

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: AgentMessage = {
      id: `msg_${Date.now()}`,
      agentId,
      type: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setStatus("thinking");

    try {
      // TODO: Implement actual agent API call
      // const response = await api.post(`/agents/${agentId}/chat`, { message: content });

      // Simulate agent response
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const agentMessage: AgentMessage = {
        id: `msg_${Date.now() + 1}`,
        agentId,
        type: "agent",
        content: `I received your message: "${content}". This is a placeholder response.`,
        timestamp: new Date().toISOString(),
        metadata: {
          confidence: "high",
        },
      };

      setMessages((prev) => [...prev, agentMessage]);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setStatus("error");
    }
  }, [agentId]);

  const executeAction = useCallback(async (actionId: string) => {
    setStatus("executing");
    try {
      // TODO: Implement actual action execution
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setStatus("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      setStatus("error");
    }
  }, []);

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
