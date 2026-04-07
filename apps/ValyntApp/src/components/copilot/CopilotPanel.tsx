/**
 * CopilotPanel — Workspace-embedded copilot chat panel
 *
 * Embedded chat interface with warmth-contextual prompts and quick actions.
 *
 * Phase 2: Copilot Mode
 */

import { useState } from "react";

import { useChat } from "@/features/chat/hooks/useChat";
import type { WarmthState } from "@shared/domain/Warmth";

interface CopilotPanelProps {
  caseId: string;
  warmth: WarmthState;
  onNavigateToNode: (nodeId: string) => void;
  onSwitchMode: (mode: "canvas" | "narrative" | "evidence") => void;
}

const suggestedPrompts: Record<WarmthState, string[]> = {
  forming: [
    "What data do we need to gather?",
    "Help me find evidence sources",
    "Build initial case structure",
    "Discover key value drivers",
  ],
  firm: [
    "Review current assumptions",
    "Validate evidence strength",
    "Which assumptions need strengthening?",
    "Check for blind spots",
  ],
  verified: [
    "Share case summary",
    "Export executive report",
    "Prepare presentation",
    "Generate value summary",
  ],
};

const quickActions = [
  "Request CRM data",
  "Import report",
  "Run analysis",
  "Clear chat",
];

export function CopilotPanel({
  caseId,
  warmth,
  onNavigateToNode,
  onSwitchMode,
}: CopilotPanelProps): JSX.Element {
  const [input, setInput] = useState("");
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChat();

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  const warmthBorderColor = {
    forming: "border-amber-200",
    firm: "border-blue-200",
    verified: "border-emerald-200",
  }[warmth];

  return (
    <div className={`flex h-full flex-col rounded-lg border ${warmthBorderColor} bg-white`}>
      {/* Suggested prompts */}
      <div className="border-b border-gray-100 p-3">
        <div className="mb-2 text-xs font-medium text-gray-500">Suggested prompts</div>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts[warmth].map((prompt, index) => (
            <button
              key={index}
              onClick={() => {
                setInput(prompt);
                sendMessage(prompt);
              }}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400">Start a conversation with the copilot</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-3 rounded-lg p-3 ${
                msg.role === "user" ? "bg-zinc-900 text-white" : "border border-gray-200 bg-white"
              }`}
            >
              <div className="text-sm">{msg.content}</div>
              {msg.role === "assistant" && msg.metadata?.model && (
                <div className="mt-1 text-xs text-gray-400">{msg.metadata.model}</div>
              )}
            </div>
          ))
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-gray-500" aria-label="Thinking...">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            aria-label="Send message"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send
          </button>
        </div>

        {/* Quick actions */}
        <div className="mt-2 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => {
                if (action === "Clear chat") {
                  clearMessages();
                } else {
                  sendMessage(action);
                }
              }}
              className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CopilotPanel;
