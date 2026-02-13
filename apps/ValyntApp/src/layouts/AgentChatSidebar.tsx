import { X, ArrowUp, Bot, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AgentChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

const sampleMessages: ChatMessage[] = [
  {
    id: "1",
    role: "agent",
    content: "I'm ready to help with your value analysis. What would you like to explore?",
    timestamp: "Just now",
  },
];

export function AgentChatSidebar({ open, onClose }: AgentChatSidebarProps) {
  const [messages] = useState<ChatMessage[]>(sampleMessages);
  const [input, setInput] = useState("");

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      )}

      {/* Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 h-full w-screen max-w-[450px] overflow-x-hidden bg-white z-50 flex flex-col transition-transform duration-300 ease-out",
          "shadow-[-60px_0_60px_-15px_rgba(0,0,0,0.08)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-950 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">Value Agent</p>
              <p className="text-[11px] text-emerald-600 font-medium">Online</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-zinc-100 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                  msg.role === "user" ? "bg-zinc-950" : "bg-zinc-100"
                )}
              >
                {msg.role === "user" ? (
                  <User className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] px-4 py-3 rounded-3xl text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-zinc-950 text-white"
                    : "bg-white border border-zinc-200 text-zinc-700"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-zinc-200">
          <div className="flex items-end gap-2 bg-white border border-zinc-200 rounded-2xl p-2 shadow-lg">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the agent anything..."
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] text-zinc-900 placeholder:text-zinc-400 placeholder:italic placeholder:font-light outline-none"
            />
            <button className="w-10 h-10 bg-zinc-950 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-zinc-800 transition-colors">
              <ArrowUp className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
