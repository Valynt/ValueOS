import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, Wrench, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAgentStream, type ChatMessage, type AgentChatContext } from "@/hooks/useAgentStream";

interface AgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  context: AgentChatContext;
  onApplySuggestion?: (suggestion: any) => void;
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
        console.log("New message:", message);
      },
      onError: (error) => {
        console.error("Agent chat error:", error);
      },
      onToolExecuted: (toolCall, result) => {
        console.log("Tool executed:", toolCall, result);
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

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const message = inputValue.trim();
    setInputValue("");
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplySuggestion = (suggestionId: string) => {
    applySuggestion(suggestionId);
    onApplySuggestion?.(suggestionId);
  };

  const handleExecuteTool = async (toolName: string, args: Record<string, any>) => {
    await executeTool(toolName, args);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold">AI Agent Collaboration</h2>
            <p className="text-sm text-muted-foreground">
              Generate content and validate assumptions for your Value Case
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Context Info */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <div className="flex gap-4 text-sm">
            {context.customer && (
              <span>
                <strong>Customer:</strong> {context.customer}
              </span>
            )}
            {context.industry && (
              <span>
                <strong>Industry:</strong> {context.industry}
              </span>
            )}
            {context.drivers && context.drivers.length > 0 && (
              <span>
                <strong>Drivers:</strong> {context.drivers.length}
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
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
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Agent is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask the agent to generate content or validate assumptions..."
              disabled={isStreaming}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            />
            <Button onClick={handleSend} disabled={!inputValue.trim() || isStreaming} size="sm">
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
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

interface MessageBubbleProps {
  message: ChatMessage;
  onApplySuggestion: (suggestionId: string) => void;
  onExecuteTool: (toolName: string, args: Record<string, any>) => Promise<void>;
}

function MessageBubble({ message, onApplySuggestion, onExecuteTool }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser ? "bg-primary text-white" : "bg-slate-100 text-slate-800"
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Tool Calls */}
        {message.metadata?.toolCalls && message.metadata.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-600">Tool Executions:</div>
            {message.metadata.toolCalls.map((toolCall) => (
              <div key={toolCall.id} className="bg-white rounded p-2 border">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="h-3 w-3" />
                  <span className="text-xs font-medium">{toolCall.tool}</span>
                  <Badge variant="secondary" className="text-xs">
                    {toolCall.result ? "Executed" : "Pending"}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">Args: {JSON.stringify(toolCall.args)}</div>
                {toolCall.result && (
                  <div className="text-xs text-green-600 mt-1">
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
        )}

        {/* Suggestions */}
        {message.metadata?.suggestions && message.metadata.suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-600">Suggestions:</div>
            {message.metadata.suggestions.map((suggestion) => (
              <div key={suggestion.id} className="bg-white rounded p-2 border">
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
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Apply
                  </Button>
                </div>
                <div className="text-xs text-slate-700">{suggestion.content}</div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-slate-500 mt-2">{message.timestamp.toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
