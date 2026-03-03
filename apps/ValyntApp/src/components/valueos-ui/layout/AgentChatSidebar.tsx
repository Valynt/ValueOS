/*
 * VALYNT Agent Chat Sidebar — Sheet overlay from right
 * Used as a global "Ask Agent" chat panel
 */
import { useState } from "react";
import { X, Send, Sparkles, Bot, ArrowUp, Paperclip, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface AgentChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: string;
}

const suggestions = [
  "Analyze Cloud Migration ROI",
  "Show recent agent failures",
  "Summarize Acme Corp case",
  "Compare value models",
];

export function AgentChatSidebar({ open, onClose }: AgentChatSidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "agent",
      text: "Hello! I'm the VALYNT Value Architect. I can help you build business cases, analyze opportunities, and validate value hypotheses. What would you like to explore?",
      timestamp: "Just now",
    },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text: input,
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTimeout(() => {
      const agentMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: "agent",
        text: "I'm analyzing your request. Based on available data, I can provide insights on market sizing, competitive positioning, and financial projections. Would you like me to generate a detailed analysis?",
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, agentMsg]);
    }, 1200);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 gap-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b flex-row items-center gap-3 space-y-0">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-background" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-[14px] font-semibold">Value Architect</SheetTitle>
            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online
            </p>
          </div>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-2.5", msg.role === "user" && "flex-row-reverse")}
            >
              {msg.role === "agent" && (
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
                {msg.text}
                <p className={cn(
                  "text-[10px] mt-1.5",
                  msg.role === "user" ? "text-background/50" : "text-muted-foreground"
                )}>{msg.timestamp}</p>
              </div>
            </div>
          ))}

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="pt-2 space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
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
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask a follow-up question..."
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
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
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            ValueOS Intelligence can make mistakes. Verify critical financial data.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
