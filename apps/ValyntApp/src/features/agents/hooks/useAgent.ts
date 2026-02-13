import { useState, useCallback } from "react";
import type { AgentMessage, AgentStatus, AgentSession } from "../types";

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
      // Feature flag: Show preview mode until backend is wired
      const AGENT_PREVIEW_MODE = import.meta.env.VITE_AGENT_PREVIEW_MODE === "true";
      if (!AGENT_PREVIEW_MODE) {
        setError("Agent functionality is in preview mode. Coming soon!");
        setStatus("error");
        return;
      }

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
        // Simulate streaming agent response
        const responseId = `msg_${Date.now() + 1}`;
        const fullContent = `I've analyzed your request regarding "${content}". Based on ESO benchmarks for your industry, I recommend focusing on efficiency gains in manual data entry, which typically shows a 15-20% improvement potential.`;

        let currentContent = "";
        const words = fullContent.split(" ");

        for (let i = 0; i < words.length; i++) {
          currentContent += (i === 0 ? "" : " ") + words[i];
          const streamingMessage: AgentMessage = {
            id: responseId,
            agentId,
            type: "agent",
            content: currentContent,
            timestamp: new Date().toISOString(),
            metadata: {
              confidence: "high",
            },
          };

          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== responseId);
            return [...filtered, streamingMessage];
          });

          await new Promise((resolve) => setTimeout(resolve, 50)); // Stream speed
        }

        setStatus("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        setStatus("error");
      }
    },
    [agentId]
  );

  const executeAction = useCallback(async (_actionId: string) => {
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
