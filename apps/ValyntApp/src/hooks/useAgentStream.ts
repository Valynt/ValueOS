import { useCallback, useEffect, useRef, useState } from "react";
import { AgentOrchestratorAdapter } from "@/services/AgentOrchestratorAdapter";
import { RedisStreamBroker } from "@/services/messaging/RedisStreamBroker";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    toolCalls?: Array<{
      id: string;
      tool: string;
      args: Record<string, unknown>;
      result?: unknown;
    }>;
    suggestions?: Array<{
      id: string;
      type: "content" | "assumption" | "driver";
      content: string;
      applyData?: unknown;
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
  sessionId?: string;
  tenantId?: string;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onToolExecuted?: (toolCall: any, result: any) => void;
  onThinking?: (message: string) => void;
  onExecuting?: (message: string) => void;
  onCompleted?: (message: string) => void;
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
  const brokerRef = useRef<RedisStreamBroker | null>(null);
  const sessionIdRef = useRef<string>(options.sessionId || uuidv4());

  const { user } = useAuth();
  const {
    context,
    tenantId: providedTenantId,
    onMessage,
    onError,
    onToolExecuted,
    onThinking,
    onExecuting,
    onCompleted
  } = options;

  const tenantId = providedTenantId || user?.id || 'default-tenant'; // Fallback for tenantId

  // Initialize Redis broker and subscribe to stream updates
  useEffect(() => {
    const initializeBroker = async () => {
      if (!brokerRef.current) {
        brokerRef.current = new RedisStreamBroker({
          streamName: 'agent.streams',
          consumerName: `ui-${user?.id || 'anonymous'}-${sessionIdRef.current}`,
        });
        await brokerRef.current.initialize();

        // Start consumer to listen for streaming updates
        brokerRef.current.startConsumer(async (event) => {
          if (event.name === 'agent.stream.update') {
            const payload = event.payload;
            if (payload.sessionId === sessionIdRef.current && payload.tenantId === tenantId) {
              switch (payload.stage) {
                case 'thinking':
                  onThinking?.(payload.message);
                  break;
                case 'executing':
                  onExecuting?.(payload.message);
                  break;
                case 'completed':
                  onCompleted?.(payload.message);
                  setIsStreaming(false);
                  break;
              }
            }
          }
        });
      }
    };

    initializeBroker();

    return () => {
      // Cleanup broker on unmount
      if (brokerRef.current) {
        // Note: Redis broker doesn't have a cleanup method in the current implementation
        // This would need to be added to properly close connections
      }
    };
  }, [user?.id, tenantId, onThinking, onExecuting, onCompleted]);

  const addMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      onMessage?.(message);
    },
    [onMessage]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !brokerRef.current) return;

      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      addMessage(userMessage);
      setIsStreaming(true);

      try {
        // Publish agent query event to trigger backend processing
        await brokerRef.current.publish('agent.stream.update', {
          schemaVersion: '1.0.0',
          idempotencyKey: uuidv4(),
          emittedAt: new Date().toISOString(),
          tenantId,
          sessionId: sessionIdRef.current,
          userId: user?.id || 'anonymous',
          stage: 'thinking',
          message: 'Processing your request...',
        });

        // For now, still use adapter as fallback, but in full implementation
        // this would be handled entirely by the stream
        if (!adapterRef.current) {
          adapterRef.current = new AgentOrchestratorAdapter();
        }

        const response = await adapterRef.current.processQuery(content, {
          userId: user?.id,
          sessionId: sessionIdRef.current,
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

        // Publish completion event
        await brokerRef.current.publish('agent.stream.update', {
          schemaVersion: '1.0.0',
          idempotencyKey: uuidv4(),
          emittedAt: new Date().toISOString(),
          tenantId,
          sessionId: sessionIdRef.current,
          userId: user?.id || 'anonymous',
          stage: 'completed',
          message: 'Response generated',
        });
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
        setIsStreaming(false);
      }
    },
    [isStreaming, context, addMessage, onError, tenantId, user?.id]
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
        logger.info("Applying suggestion:", suggestion);
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
