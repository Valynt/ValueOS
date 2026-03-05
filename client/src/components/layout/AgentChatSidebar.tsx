/*
 * VALYNT Agent Chat Sidebar — Sheet overlay from right
 * Streams responses from Together.ai via /api/chat SSE endpoint
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Bot, ArrowUp, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AgentChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

const suggestions = [
  "Analyze Cloud Migration ROI",
  "Summarize Acme Corp case",
  "Compare value models",
  "What enrichment data is available?",
];

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentChatSidebar({ open, onClose }: AgentChatSidebarProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm the VALYNT Value Architect. I can help you build business cases, analyze opportunities, and validate value hypotheses. What would you like to explore?",
      timestamp: Date.now(),
    },
  ]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      const assistantId = `a_${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);

      // Build message history for the API (exclude the empty assistant placeholder)
      const apiMessages = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Server error (${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                );
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Mark streaming complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content || "Response cancelled.",
                    isStreaming: false,
                  }
                : m
            )
          );
        } else {
          const errMsg =
            err instanceof Error ? err.message : "Connection failed";
          setError(errMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Sorry, I encountered an error. Please try again.",
                    isStreaming: false,
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages]
  );

  const handleSend = () => {
    sendMessage(input);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 gap-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b flex-row items-center gap-3 space-y-0">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-background" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-[14px] font-semibold">
              Value Architect
            </SheetTitle>
            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isStreaming ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                )}
              />
              {isStreaming ? "Thinking..." : "Online"}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Llama 3.3 70B
          </p>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2.5",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-700" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.isStreaming && !msg.content && (
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                )}
                {msg.isStreaming && msg.content && (
                  <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                )}
                <p
                  className={cn(
                    "text-[10px] mt-1.5",
                    msg.role === "user"
                      ? "text-background/50"
                      : "text-muted-foreground"
                  )}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-[12px]">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-destructive/60 hover:text-destructive"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="pt-2 space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Suggestions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 rounded-full border border-border text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3.5 py-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                isStreaming
                  ? "Waiting for response..."
                  : "Ask a follow-up question..."
              }
              disabled={isStreaming}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground transition-colors"
                title="Stop generating"
              >
                <div className="w-3 h-3 rounded-sm bg-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  input.trim()
                    ? "bg-foreground text-background"
                    : "bg-muted-foreground/20 text-muted-foreground"
                )}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Powered by Together.ai · Llama 3.3 70B · Verify critical financial
            data.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
