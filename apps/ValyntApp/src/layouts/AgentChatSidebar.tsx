import { ArrowUp, Bot, Loader2, User, X, Zap } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { useChat } from "@/features/chat/hooks/useChat";
import type { ChatMessage } from "@/features/chat/types";
import { cn } from "@/lib/utils";

interface AgentChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface AgentChatPanelProps {
  onClose: () => void;
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const SUGGESTED_PROMPTS = [
  "What's the ROI potential for a cloud migration?",
  "Help me build a value case for a new prospect",
  "What KPIs should I track for a supply chain deal?",
  "Summarize the integrity issues in my active cases",
];

/**
 * Inner panel — only mounted when open=true (keeps the DOM lean).
 * Chat state is owned by AgentChatSidebar so it survives open/close cycles.
 */
function AgentChatPanel({
  onClose,
  messages,
  isStreaming,
  error,
  sendMessage,
  clearMessages,
}: AgentChatPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus trap + keyboard handling
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    setTimeout(() => textareaRef.current?.focus(), 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!panelRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      if (focusable.length === 0) { event.preventDefault(); return; }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose]);

  const handleSend = async () => {
    const text = textareaRef.current?.value.trim();
    if (!text || isStreaming) return;
    if (textareaRef.current) textareaRef.current.value = "";
    resizeTextarea();
    try {
      await sendMessage(text);
    } catch {
      // sendMessage failures are surfaced via the error field from useChat.
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggest = (prompt: string) => {
    if (textareaRef.current) {
      textareaRef.current.value = prompt;
      textareaRef.current.focus();
      resizeTextarea();
    }
  };

  const handleClear = () => {
    clearMessages();
    if (textareaRef.current) {
      textareaRef.current.value = "";
      resizeTextarea();
    }
  };

  // Cross-browser textarea auto-resize (fieldSizing: content is Chromium-only)
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const isEmpty = messages.length === 0;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-950 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 id={titleId} className="text-[13px] font-semibold text-zinc-900">Value Agent</h2>
            <p className={cn("text-[11px] font-medium", isStreaming ? "text-amber-500" : "text-emerald-600")}>
              {isStreaming ? "Thinking…" : "Ready"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="px-2.5 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close agent chat"
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {isEmpty ? (
          <div className="h-full flex flex-col justify-center">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-900 mb-1">Ask the Value Agent</p>
              <p className="text-[12px] text-zinc-400">Powered by multi-agent reasoning and ground truth data</p>
            </div>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggest(prompt)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-zinc-200 text-[13px] text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  msg.role === "user" ? "bg-zinc-950" : "bg-zinc-100"
                )}>
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5 text-white" />
                    : <Bot className="w-3.5 h-3.5 text-zinc-600" />
                  }
                </div>
                <div className={cn(
                  "max-w-[82%] px-4 py-3 rounded-3xl text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-zinc-950 text-white rounded-tr-sm"
                    : "bg-white border border-zinc-200 text-zinc-700 rounded-tl-sm"
                )}>
                  {msg.content}
                  {msg.metadata?.model && (
                    <p className="mt-1.5 text-[10px] text-zinc-400 opacity-70">{msg.metadata.model.split("/").pop()}</p>
                  )}
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-zinc-600" />
                </div>
                <div className="px-4 py-3 rounded-3xl rounded-tl-sm bg-white border border-zinc-200">
                  <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-[12px] text-red-600">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 flex-shrink-0">
        <div className="flex items-end gap-2 bg-white border border-zinc-200 rounded-2xl p-2 shadow-sm focus-within:border-zinc-400 transition-colors">
          <textarea
            ref={textareaRef}
            onKeyDown={handleKeyDown}
            onInput={resizeTextarea}
            placeholder="Ask anything about your value cases…"
            rows={1}
            aria-label="Message Value Agent"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] text-zinc-900 placeholder:text-zinc-400 placeholder:italic placeholder:font-light outline-none overflow-hidden"
            style={{ maxHeight: "128px" }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming}
            aria-label="Send message"
            className="w-10 h-10 bg-zinc-950 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <ArrowUp className="w-4 h-4 text-white" />
            }
          </button>
        </div>
        <p className="mt-2 text-[10px] text-zinc-400 text-center">
          Powered by Together.ai · Ground truth from EDGAR &amp; XBRL
        </p>
      </div>
    </aside>
  );
}

/**
 * Shell — always rendered, owns chat state so conversation history
 * survives open/close cycles. AgentChatPanel is only mounted when open=true
 * to keep the DOM lean while the panel is hidden.
 */
export function AgentChatSidebar({ open, onClose }: AgentChatSidebarProps) {
  // useChat lives here so messages persist across open/close cycles.
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChat();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-full sm:w-[28rem] bg-white z-50",
          "shadow-[-60px_0_60px_-15px_rgba(0,0,0,0.08)]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {open && (
          <AgentChatPanel
            onClose={onClose}
            messages={messages}
            isStreaming={isStreaming}
            error={error}
            sendMessage={sendMessage}
            clearMessages={clearMessages}
          />
        )}
      </div>
    </>
  );
}
