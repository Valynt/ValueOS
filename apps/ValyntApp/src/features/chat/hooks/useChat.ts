import { useCallback, useState } from "react";
import type { ChatMessage } from "../types";
import { api } from "../../../api/client/unified-api-client";

export function useChat(_sessionId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setError(null);

    try {
      const response = await api.chat({
        prompt: content,
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      });

      if (!response.success) {
        throw new Error(response.error?.message || "Network request failed");
      }

      if (response.data && !response.data.success) {
        throw new Error(
          response.data.error || response.data.message || "Request failed"
        );
      }

      const result = response.data?.data;

      if (!result) {
        throw new Error("Invalid response format");
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: result.content,
        timestamp: new Date().toISOString(),
        metadata: {
          model: result.model,
          tokens: result.usage?.totalTokens,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}
