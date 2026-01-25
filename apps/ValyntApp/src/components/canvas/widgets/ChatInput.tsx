/**
 * Canvas Widget: ChatInput
 * Input for follow-up questions to the agent
 */

import React, { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import type { WidgetProps } from "../CanvasHost";

interface ChatInputData {
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({ data, onAction }: WidgetProps) {
  const [value, setValue] = useState("");
  const {
    placeholder = "Ask a follow-up question...",
    disabled = false,
  } = (data as ChatInputData) ?? {};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && onAction) {
      onAction("submit", { message: value.trim() });
      setValue("");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatInput;
