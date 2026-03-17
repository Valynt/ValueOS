/**
 * Agent streaming hook - stub declaration.
 * TODO: Replace with full implementation when agent streaming feature is complete.
 */

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
}

export interface UseAgentStreamReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;
  context: AgentChatContext;
  error: Error | null;
}

export function useAgentStream(_options?: {
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: unknown, result: unknown) => void;
}): UseAgentStreamReturn {
  return {
    messages: [],
    isStreaming: false,
    sendMessage: async () => {},
    context: { sessionId: "", agentId: "", messages: [], isStreaming: false },
    error: null,
  };
}
