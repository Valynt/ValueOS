/*
 * VALYNT Agent Chat Sidebar — Sheet overlay from right
 * Streams responses from Together.ai via /api/chat SSE endpoint
 * Supports agent selection, tool execution visibility, and context-aware suggestions
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles,
  Bot,
  ArrowUp,
  ChevronDown,
  Wrench,
  Check,
  Search,
  Shield,
  Target,
  FileText,
  Swords,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/* -------------------------------------------------------
   Types
   ------------------------------------------------------- */

interface AgentChatSidebarProps {
  open: boolean;
  onClose: () => void;
  initialAgentSlug?: string;
}

interface ToolEvent {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  round: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  agentSlug?: string;
  agentName?: string;
  toolEvents?: ToolEvent[];
}

/* -------------------------------------------------------
   Agent metadata (client-side, mirrors server registry)
   ------------------------------------------------------- */

interface AgentOption {
  slug: string;
  name: string;
  icon: React.ReactNode;
  model: string;
  description: string;
  suggestions: string[];
}

const AGENTS: AgentOption[] = [
  {
    slug: "architect",
    name: "Value Architect",
    icon: <Sparkles className="w-3.5 h-3.5" />,
    model: "Llama 3.3 70B",
    description: "General-purpose assistant for value engineering",
    suggestions: [
      "Summarize Acme Corp case",
      "Compare value models",
      "What enrichment data is available?",
      "Help me build a business case",
    ],
  },
  {
    slug: "opportunity",
    name: "Opportunity Agent",
    icon: <Zap className="w-3.5 h-3.5" />,
    model: "Qwen 2.5 72B",
    description: "Data extraction and opportunity identification",
    suggestions: [
      "Enrich Salesforce",
      "Pull SEC filings for Microsoft",
      "What's the SIC code for cloud software?",
      "Find IT spend metrics for Oracle",
    ],
  },
  {
    slug: "research",
    name: "Research Agent",
    icon: <Search className="w-3.5 h-3.5" />,
    model: "DeepSeek R1",
    description: "Deep competitive analysis and market research",
    suggestions: [
      "Competitive landscape for ServiceNow",
      "Compare Snowflake vs Databricks financials",
      "Industry benchmarks for SaaS margins",
      "Market size for enterprise AI",
    ],
  },
  {
    slug: "integrity",
    name: "Integrity Agent",
    icon: <Shield className="w-3.5 h-3.5" />,
    model: "DeepSeek R1",
    description: "Claim validation and evidence classification",
    suggestions: [
      "Validate: Annual revenue is $2.4B",
      "Check this ROI claim against EDGAR",
      "What evidence tier is this metric?",
      "Flag unsupported claims in this case",
    ],
  },
  {
    slug: "target",
    name: "Target Agent",
    icon: <Target className="w-3.5 h-3.5" />,
    model: "Qwen 2.5 72B",
    description: "Value tree modeling and ROI projections",
    suggestions: [
      "Build a value tree for cloud migration",
      "Calculate ROI for $500K investment",
      "Model 3 scenarios for this case",
      "What's the payback period?",
    ],
  },
  {
    slug: "narrative",
    name: "Narrative Agent",
    icon: <FileText className="w-3.5 h-3.5" />,
    model: "Llama 3.3 70B",
    description: "Executive-ready business writing",
    suggestions: [
      "Write an executive summary",
      "Draft a CFO defense brief",
      "Create presentation bullets",
      "Summarize findings for procurement",
    ],
  },
  {
    slug: "redteam",
    name: "Red Team Agent",
    icon: <Swords className="w-3.5 h-3.5" />,
    model: "DeepSeek R1",
    description: "Adversarial stress-testing of value cases",
    suggestions: [
      "Challenge this 4:1 consolidation ratio",
      "What would a CFO object to?",
      "Stress-test the top 3 assumptions",
      "Rate the resilience of this case",
    ],
  },
];

/* -------------------------------------------------------
   Helpers
   ------------------------------------------------------- */

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------
   Tool Event Chip
   ------------------------------------------------------- */

function ToolEventChip({ event }: { event: ToolEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
      >
        {event.result ? (
          <Check className="w-3 h-3 text-emerald-600" />
        ) : (
          <Wrench className="w-3 h-3 animate-spin" />
        )}
        {formatToolName(event.name)}
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="mt-1 ml-2 p-2 rounded bg-muted text-[10px] font-mono text-muted-foreground max-h-32 overflow-auto">
          {event.arguments && (
            <div className="mb-1">
              <span className="text-amber-600 font-semibold">Input:</span>{" "}
              {event.arguments}
            </div>
          )}
          {event.result && (
            <div>
              <span className="text-emerald-600 font-semibold">Output:</span>{" "}
              {event.result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   Main Component
   ------------------------------------------------------- */

export function AgentChatSidebar({
  open,
  onClose,
  initialAgentSlug,
}: AgentChatSidebarProps) {
  const [selectedSlug, setSelectedSlug] = useState(
    initialAgentSlug || "architect"
  );
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedAgent = useMemo(
    () => AGENTS.find((a) => a.slug === selectedSlug) || AGENTS[0],
    [selectedSlug]
  );

  // Reset to initial agent when sidebar opens with a new agent
  useEffect(() => {
    if (initialAgentSlug && open) {
      setSelectedSlug(initialAgentSlug);
    }
  }, [initialAgentSlug, open]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Generate welcome message when agent changes
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hello! I'm the **${selectedAgent.name}**. ${selectedAgent.description}. How can I help you today?`,
        timestamp: Date.now(),
        agentSlug: selectedAgent.slug,
        agentName: selectedAgent.name,
      },
    ]);
  }, [selectedAgent]);

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
        agentSlug: selectedAgent.slug,
        agentName: selectedAgent.name,
        toolEvents: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);

      // Build message history for the API (exclude the welcome message)
      const apiMessages = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            agentSlug: selectedAgent.slug === "architect" ? undefined : selectedAgent.slug,
          }),
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
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;

            try {
              const parsed = JSON.parse(payload);

              // Content delta — append to message
              if (parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                );
              }

              // Tool call event — add to tool events
              if (parsed.toolCall) {
                const tc = parsed.toolCall;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          toolEvents: [
                            ...(m.toolEvents || []),
                            {
                              id: tc.id,
                              name: tc.name,
                              arguments: tc.arguments,
                              round: tc.round,
                            },
                          ],
                        }
                      : m
                  )
                );
              }

              // Tool result event — update the matching tool event
              if (parsed.toolResult) {
                const tr = parsed.toolResult;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          toolEvents: (m.toolEvents || []).map((te) =>
                            te.id === tr.id
                              ? { ...te, result: tr.result }
                              : te
                          ),
                        }
                      : m
                  )
                );
              }

              // Error event
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
                    content:
                      "Sorry, I encountered an error. Please try again.",
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
    [isStreaming, messages, selectedAgent]
  );

  const handleSend = () => sendMessage(input);
  const handleStop = () => abortRef.current?.abort();

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setShowAgentPicker(false);
        }
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 gap-0 flex flex-col"
      >
        {/* Header with Agent Selector */}
        <SheetHeader className="px-5 py-4 border-b flex-row items-center gap-3 space-y-0">
          <button
            onClick={() => setShowAgentPicker(!showAgentPicker)}
            className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center flex-shrink-0">
              {selectedAgent.icon}
            </div>
            <div className="flex-1 text-left">
              <SheetTitle className="text-[14px] font-semibold flex items-center gap-1.5">
                {selectedAgent.name}
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform",
                    showAgentPicker && "rotate-180"
                  )}
                />
              </SheetTitle>
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isStreaming
                      ? "bg-amber-500 animate-pulse"
                      : "bg-emerald-500"
                  )}
                />
                {isStreaming ? "Thinking..." : "Online"}
              </p>
            </div>
          </button>
          <p className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
            {selectedAgent.model}
          </p>
        </SheetHeader>

        {/* Agent Picker Dropdown */}
        {showAgentPicker && (
          <div className="border-b bg-muted/30 px-3 py-2 space-y-1 max-h-[280px] overflow-y-auto">
            {AGENTS.map((agent) => (
              <button
                key={agent.slug}
                onClick={() => {
                  setSelectedSlug(agent.slug);
                  setShowAgentPicker(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  agent.slug === selectedSlug
                    ? "bg-foreground/10 border border-foreground/20"
                    : "hover:bg-muted"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
                    agent.slug === selectedSlug
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">
                    {agent.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {agent.description}
                  </p>
                </div>
                <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                  {agent.model}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2.5",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
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
                {/* Tool events */}
                {msg.toolEvents && msg.toolEvents.length > 0 && (
                  <div className="mb-2">
                    {msg.toolEvents.map((te) => (
                      <ToolEventChip key={te.id} event={te} />
                    ))}
                  </div>
                )}

                {/* Message content */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Streaming indicators */}
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

                {/* Timestamp and agent badge */}
                <div className="flex items-center gap-2 mt-1.5">
                  <p
                    className={cn(
                      "text-[10px]",
                      msg.role === "user"
                        ? "text-background/50"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTime(msg.timestamp)}
                  </p>
                  {msg.agentName && msg.role === "assistant" && msg.id !== "welcome" && (
                    <span className="text-[9px] text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                      via {msg.agentName}
                    </span>
                  )}
                </div>
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
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedAgent.suggestions.map((s) => (
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
                  : `Ask ${selectedAgent.name}...`
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
            Powered by Together.ai · {selectedAgent.model} · Verify critical
            financial data.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
