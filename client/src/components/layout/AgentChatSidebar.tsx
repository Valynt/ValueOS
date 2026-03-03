/*
 * Design: Atelier — Refined Workspace Craft
 * Agent Chat: Right-side sheet with conversational AI interface
 * Accessible, focus-trapped, keyboard-navigable
 */
import { useState } from "react";
import { ArrowUp, Bot, User, Sparkles, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "agent",
    content: "Hello! I'm your Value Agent. I can help you analyze opportunities, build value models, review agent runs, or explore your data. What would you like to work on?",
    timestamp: "Just now",
  },
];

const suggestions = [
  "Analyze Cloud Migration ROI opportunity",
  "Show me recent agent failures",
  "Summarize EMEA Sales Efficiency case",
  "Compare value models by category",
];

export function AgentChatSidebar() {
  const { agentChatOpen, setAgentChatOpen } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate agent response
    setTimeout(() => {
      const agentMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: "agent",
        content: `I'll analyze that for you. Based on the current data in your workspace, here's what I found:\n\nThe Cloud Migration ROI opportunity shows strong potential with an 88% confidence score. The ExtractionAgent has completed initial data gathering, and the value tree is being constructed. Would you like me to dive deeper into any specific aspect?`,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, agentMsg]);
    }, 1200);
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  return (
    <Sheet open={agentChatOpen} onOpenChange={setAgentChatOpen}>
      <SheetContent side="right" className="w-full sm:max-w-[440px] p-0 gap-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b flex-row items-center gap-3 space-y-0">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-[14px] font-semibold">Value Agent</SheetTitle>
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
              className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  msg.role === "user" ? "bg-foreground" : "bg-muted"
                )}
              >
                {msg.role === "user" ? (
                  <User className="w-3.5 h-3.5 text-background" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-2xl rounded-tr-md"
                    : "bg-muted text-foreground rounded-2xl rounded-tl-md"
                )}
              >
                {msg.content}
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
                    onClick={() => handleSuggestion(s)}
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
        <div className="p-4 border-t">
          <div className="flex items-end gap-2 bg-muted/50 border border-border rounded-2xl p-2">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask the agent anything..."
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                input.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Valynt Intelligence can make mistakes. Verify critical financial data.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
