import { useState, useCallback, useRef } from "react";
import { AgentOrchestratorAdapter } from "@/services/AgentOrchestratorAdapter";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    toolCalls?: Array<{
      id: string;
      tool: string;
      args: Record<string, any>;
      result?: any;
    }>;
    suggestions?: Array<{
      id: string;
      type: "content" | "assumption" | "driver";
      content: string;
      applyData?: any;
    }>;
  };
}

export interface AgentChatContext {
  customer?: string;
  industry?: string;
  drivers?: Array<{
    id: string;
    name: string;
    value: number;
  }>;
  caseId?: string;
}

interface UseAgentStreamOptions {
  context?: AgentChatContext;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onToolExecuted?: (toolCall: any, result: any) => void;
}

interface AgentStreamResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;
  applySuggestion: (suggestionId: string) => void;
  executeTool: (toolName: string, args: Record<string, any>) => Promise<any>;
  clearMessages: () => void;
}

export function useAgentStream(options: UseAgentStreamOptions = {}): AgentStreamResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const adapterRef = useRef<AgentOrchestratorAdapter | null>(null);

  const { context, onMessage, onError, onToolExecuted } = options;

  const addMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      onMessage?.(message);
    },
    [onMessage]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      addMessage(userMessage);
      setIsStreaming(true);

      try {
        if (!adapterRef.current) {
          adapterRef.current = new AgentOrchestratorAdapter();
        }

        // For now, use processQuery as invokeAgent might not exist
        const response = await adapterRef.current.processQuery(content, {
          context: {
            intent: "agent-chat",
            environment: "production",
            ...context,
          },
        });

        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: response?.content || "No response",
          timestamp: new Date(),
          metadata: response?.metadata,
        };

        addMessage(assistantMessage);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now() + 2}`,
          role: "assistant",
          content: `Error: ${err.message}`,
          timestamp: new Date(),
        };
        addMessage(errorMessage);
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, context, addMessage, onError]
  );

  const applySuggestion = useCallback(
    (suggestionId: string) => {
      // Find the suggestion in messages
      const message = messages.find((m) =>
        m.metadata?.suggestions?.some((s) => s.id === suggestionId)
      );
      const suggestion = message?.metadata?.suggestions?.find((s) => s.id === suggestionId);

      if (suggestion) {
        // Apply to Value Case - this would integrate with the store
        console.log("Applying suggestion:", suggestion);
        // TODO: Integrate with Value Case store
      }
    },
    [messages]
  );

  const executeTool = useCallback(
    async (toolName: string, args: Record<string, any>) => {
      try {
        // For now, simulate tool execution
        // In real implementation, this would call the backend tool service
        const result = { success: true, data: `Executed ${toolName} with ${JSON.stringify(args)}` };
        onToolExecuted?.({ tool: toolName, args }, result);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        throw err;
      }
    },
    [onError, onToolExecuted]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    applySuggestion,
    executeTool,
    clearMessages,
  };
}
