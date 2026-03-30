import { CheckCircle, Loader2, Send, Wrench, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { logger } from "../lib/logger";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type AgentChatContext, type ChatMessage, useAgentStream } from "@/hooks/useAgentStream";
import { cn } from "@/lib/utils";

// Type definitions for message metadata
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status?: 'pending' | 'completed' | 'failed';
  result?: unknown;
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
}

interface MessageMetadata {
  toolCalls?: ToolCall[];
  suggestions?: Suggestion[];
}

interface AgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  context: AgentChatContext;
  onApplySuggestion?: (suggestion: unknown) => void;
}

export function AgentChat({ isOpen, onClose, context, onApplySuggestion }: AgentChatProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isStreaming, sendMessage, applySuggestion, executeTool, clearMessages } =
    useAgentStream({
      context,
      onMessage: (message) => {
        // Handle new messages
        logger.info("New message:", message);
      },
      onError: (error) => {
        logger.error("Agent chat error:", { error });
      },
      onToolExecuted: (toolCall, result) => {
        logger.info("Tool executed:", toolCall, result);
      },
    });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    const message = inputValue.trim();
    setInputValue("");
    await sendMessage(message);
  }, [inputValue, isStreaming, sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleApplySuggestion = useCallback((suggestionId: string) => {
    applySuggestion(suggestionId);
    onApplySuggestion?.(suggestionId);
  }, [applySuggestion, onApplySuggestion]);

  const handleExecuteTool = useCallback(async (toolName: string, args: Record<string, unknown>) => {
    await executeTool(toolName, args);
  }, [executeTool]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="AI Agent Collaboration"
    >
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col bg-[var(--vds-color-surface)] shadow-2xl border-[var(--vds-color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--vds-color-border)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--vds-color-text-primary)]">AI Agent Collaboration</h2>
            <p className="text-sm text-[var(--vds-color-text-muted)]">
              Generate content and validate assumptions for your Value Case
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close chat">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Context Info */}
        <div className="px-4 py-2 bg-[var(--vds-color-surface-2)] border-b border-[var(--vds-color-border)]">
          <div className="flex gap-4 text-sm">
            {context.customer && (
              <span className="text-[var(--vds-color-text-secondary)]">
                <strong className="text-[var(--vds-color-text-primary)]">Customer:</strong> {context.customer}
              </span>
            )}
            {context.industry && (
              <span className="text-[var(--vds-color-text-secondary)]">
                <strong className="text-[var(--vds-color-text-primary)]">Industry:</strong> {context.industry}
              </span>
            )}
            {context.drivers && context.drivers.length > 0 && (
              <span className="text-[var(--vds-color-text-secondary)]">
                <strong className="text-[var(--vds-color-text-primary)]">Drivers:</strong> {context.drivers.length}
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-[var(--vds-color-text-muted)] py-8">
              <p>
                Start a conversation with the AI agent to generate content and validate assumptions.
              </p>
              <p className="text-sm mt-2">
                Try asking: "Generate a value proposition for this case" or "Validate these
                assumptions"
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onApplySuggestion={handleApplySuggestion}
              onExecuteTool={handleExecuteTool}
            />
          ))}

          {isStreaming && (
            <div className="flex items-center gap-2 text-[var(--vds-color-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Agent is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--vds-color-border)]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask the agent to generate content or validate assumptions..."
              disabled={isStreaming}
              className="flex-1 px-3 py-2 border border-[var(--vds-color-border)] rounded-md bg-[var(--vds-color-surface)] text-[var(--vds-color-text-primary)] placeholder:text-[var(--vds-color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--vds-color-primary)]/30 disabled:opacity-50"
              aria-label="Chat input"
            />
            <Button onClick={handleSend} disabled={!inputValue.trim() || isStreaming} size="sm" aria-label="Send message">
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            <Button variant="outline" onClick={clearMessages} size="sm">
              Clear
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

AgentChat.displayName = "AgentChat";

interface MessageBubbleProps {
  message: ChatMessage;
  onApplySuggestion: (suggestionId: string) => void;
  onExecuteTool: (toolName: string, args: Record<string, unknown>) => Promise<void>;
}

function MessageBubble({ message, onApplySuggestion, onExecuteTool }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser
            ? "bg-[var(--vds-color-primary)] text-white"
            : "bg-[var(--vds-color-surface-2)] text-[var(--vds-color-text-primary)] border border-[var(--vds-color-border)]"
        )}
      >
        <div className="whitespace-pre-wrap">{String(message.content)}</div>

        {/* Tool Calls */}
        {(() => {
          const toolCalls = message.metadata?.toolCalls as ToolCall[] | undefined;
          return toolCalls && toolCalls.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold text-[var(--vds-color-text-muted)]">Tool Executions:</div>
              {toolCalls.map((toolCall: ToolCall) => (
                <div key={toolCall.id} className="bg-[var(--vds-color-surface)] rounded p-2 border border-[var(--vds-color-border)]">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="h-3 w-3 text-[var(--vds-color-text-muted)]" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--vds-color-text-primary)]">{toolCall.tool}</span>
                    <Badge variant="secondary" className="text-xs">
                      {toolCall.result ? "Executed" : "Pending"}
                    </Badge>
                  </div>
                  <div className="text-xs text-[var(--vds-color-text-muted)]">Args: {JSON.stringify(toolCall.args)}</div>
                  {toolCall.result && (
                    <div className="text-xs text-green-500 mt-1">
                      Result: {JSON.stringify(toolCall.result)}
                    </div>
                  )}
                  {!toolCall.result && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-6 text-xs"
                      onClick={() => onExecuteTool(toolCall.tool, toolCall.args)}
                    >
                      Execute
                    </Button>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Suggestions */}
        {(() => {
          const suggestions = message.metadata?.suggestions as Suggestion[] | undefined;
          return suggestions && suggestions.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold text-[var(--vds-color-text-muted)]">Suggestions:</div>
              {suggestions.map((suggestion: Suggestion) => (
                <div key={suggestion.id} className="bg-[var(--vds-color-surface)] rounded p-2 border border-[var(--vds-color-border)]">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs">
                      {suggestion.type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-6 text-xs"
                      onClick={() => onApplySuggestion(suggestion.id)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                      Apply
                    </Button>
                  </div>
                  <div className="text-xs text-[var(--vds-color-text-secondary)]">{suggestion.content}</div>
                </div>
              ))}
            </div>
          );
        })()}

        <div className="text-xs text-[var(--vds-color-text-muted)] mt-2">{new Date(message.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

MessageBubble.displayName = "MessageBubble";
