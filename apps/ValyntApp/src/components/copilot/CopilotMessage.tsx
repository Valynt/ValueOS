/**
 * CopilotMessage — Enhanced message bubble with inline action buttons
 *
 * Phase 2: Copilot Mode
 */

import type { WarmthState } from "@shared/domain/Warmth";

interface MessageAction {
  label: string;
  icon: string;
  action: string;
  params?: Record<string, unknown>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
  };
}

interface CopilotMessageProps {
  message: Message;
  actions?: MessageAction[];
  onAction?: (action: string, params?: Record<string, unknown>) => void;
  warmth: WarmthState;
}

export function CopilotMessage({
  message,
  actions,
  onAction,
}: CopilotMessageProps): JSX.Element {
  const isUser = message.role === "user";

  return (
    <div
      className={`mb-3 rounded-lg p-3 ${isUser
          ? "bg-zinc-950 text-white"
          : "border border-gray-200 bg-white"
        }`}
    >
      {/* Message content */}
      <div className="text-sm">{message.content}</div>

      {/* Model info for assistant messages */}
      {!isUser && message.metadata?.model && (
        <div className="mt-1 text-xs text-gray-400">{message.metadata.model}</div>
      )}

      {/* Action buttons */}
      {!isUser && actions && actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => onAction?.(action.action, action.params)}
              className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CopilotMessage;
