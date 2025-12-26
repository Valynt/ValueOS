import { useState } from "react";
import {
  Building2,
  Calculator,
  ChevronRight,
  Cpu,
  Eye,
  GitBranch,
  Lightbulb,
  Loader2,
  Rocket,
  Send,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import { withAgentErrorBoundary } from "../Agent/AgentErrorBoundary";
import {
  AgentHandoff,
  AgentMessage,
  AGENTS,
  AgentType,
  Challenge,
} from "../../types/agents";
import LogicTrace from "./LogicTrace";
import RichAgentWidget from "./RichAgentWidget";
import ChallengeCard from "./ChallengeCard";

const iconMap: Record<string, React.ElementType> = {
  Building2,
  Lightbulb,
  Target,
  GitBranch,
  Calculator,
  ShieldCheck,
  Swords,
  TrendingUp,
  Rocket,
  Cpu,
};

const mockMessages: AgentMessage[] = [
  {
    id: "1",
    agentId: "company-intelligence",
    content:
      "Analyzed Acme Corp's 10-K filing. Found 3 key risk factors affecting operational efficiency.",
    timestamp: new Date(Date.now() - 300000),
    type: "insight",
    confidence: 92,
    sources: [
      {
        type: "document",
        label: "ACME 10-K 2024",
        reference: "Page 45-48",
        confidence: 98,
      },
      {
        type: "database",
        label: "Industry Benchmarks",
        reference: "Manufacturing Sector",
        confidence: 94,
      },
    ],
    constraints: ["Conservative risk model"],
  },
  {
    id: "2",
    agentId: "opportunity",
    content: "Identified manufacturing automation as high-value opportunity.",
    timestamp: new Date(Date.now() - 240000),
    type: "action",
    confidence: 87,
    sources: [
      {
        type: "model",
        label: "Opportunity Scoring Model v2.1",
        confidence: 91,
      },
    ],
  },
  {
    id: "3",
    agentId: "adversarial",
    content: "Automation ROI assumes 20% efficiency gain",
    timestamp: new Date(Date.now() - 120000),
    type: "challenge",
    metadata: {
      counterArgument:
        "Industry benchmarks suggest 12-15% is more realistic for brownfield deployments.",
      severity: "medium",
    },
  },
];

const mockHandoff: AgentHandoff = {
  from: "opportunity",
  to: "financial-modeling",
  reason: "Opportunity validated, ready for financial modeling",
  timestamp: new Date(),
};

interface AgentChatInterfaceProps {
  compact?: boolean;
  currentPath?: string;
}

const phaseAgentMap: Record<string, AgentType> = {
  "/": "orchestrator",
  "/canvas": "value-mapping",
  "/calculator": "financial-modeling",
  "/cascade": "target",
  "/agents": "orchestrator",
  "/dashboard": "realization",
};

export default function AgentChatInterface({
  compact = false,
  currentPath = "/",
}: AgentChatInterfaceProps) {
  const [messages] = useState<AgentMessage[]>(mockMessages);
  const [input, setInput] = useState("");
  const [activeHandoff] = useState<AgentHandoff | null>(mockHandoff);
  const [isProcessing, setIsProcessing] = useState(false);
  const [challenges, setChallenges] = useState<
    Record<string, Challenge["status"]>
  >({});

  const activeAgent = phaseAgentMap[currentPath] || "orchestrator";
  const activeAgentData = AGENTS[activeAgent];
  const ActiveIcon = iconMap[activeAgentData.icon];

  const handleSend = () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setInput("");
    }, 1500);
  };

  const getAgentIcon = (agentId: AgentType) => {
    const agent = AGENTS[agentId];
    const IconComponent = iconMap[agent.icon];
    return IconComponent ? <IconComponent className="w-3 h-3" /> : null;
  };

  const getMessageTypeStyle = (type: AgentMessage["type"]) => {
    switch (type) {
      case "challenge":
        return "border-l-neutral-500/50 bg-neutral-800/30";
      case "validation":
        return "border-l-primary/50 bg-primary/5";
      case "handoff":
        return "border-l-primary/50 bg-primary/5";
      case "widget":
        return "border-l-primary/50 bg-primary/5";
      default:
        return "border-l-white/10";
    }
  };

  const getAuthorityBadge = (agentId: AgentType) => {
    const agent = AGENTS[agentId];
    const config = {
      read: { label: "Read", class: "bg-primary/20 text-primary" },
      suggest: {
        label: "Suggest",
        class: "bg-neutral-700/50 text-neutral-400",
      },
      write: { label: "Write", class: "bg-primary/20 text-primary" },
      govern: { label: "Govern", class: "bg-primary/20 text-primary" },
    };
    return config[agent.authority];
  };

  const handleChallengeResolve = (id: string) => {
    setChallenges((prev) => ({ ...prev, [id]: "resolved" }));
  };

  const handleChallengeAcknowledge = (id: string) => {
    setChallenges((prev) => ({ ...prev, [id]: "acknowledged" }));
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className={`px-3 py-2.5 border-b border-white/5 flex items-center gap-2 bg-${activeAgentData.color.replace("bg-", "")}/5`}
      >
        <div
          className={`w-5 h-5 rounded-md ${activeAgentData.color} flex items-center justify-center text-white shadow-sm`}
        >
          {ActiveIcon && <ActiveIcon className="w-3 h-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 truncate">
              <span className="font-medium text-slate-300">
                {activeAgentData.shortName}
              </span>{" "}
              observing
            </span>
          </div>
        </div>
        <span
          className={`text-[8px] px-1.5 py-0.5 rounded-md font-medium ${getAuthorityBadge(activeAgent).class}`}
        >
          {getAuthorityBadge(activeAgent).label}
        </span>
      </div>

      {activeHandoff && (
        <div className="px-3 py-2.5 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center gap-1.5 text-[10px]">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="text-primary font-medium">Handoff</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div
              className={`px-2 py-1 rounded-md text-[9px] font-medium ${AGENTS[activeHandoff.from].color} text-white`}
            >
              {AGENTS[activeHandoff.from].shortName}
            </div>
            <ChevronRight className="w-3 h-3 text-slate-500" />
            <div
              className={`px-2 py-1 rounded-md text-[9px] font-medium ${AGENTS[activeHandoff.to].color} text-white`}
            >
              {AGENTS[activeHandoff.to].shortName}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center mt-8">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/10">
              <Cpu className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-[11px] text-slate-500 px-4 leading-relaxed">
              I'm listening. Click any element on the canvas to analyze it, or
              ask me a question.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const agent = AGENTS[message.agentId];
            const authorityBadge = getAuthorityBadge(message.agentId);

            if (message.type === "challenge") {
              const challenge: Challenge = {
                id: message.id,
                claim: message.content,
                counterArgument:
                  (message.metadata?.counterArgument as string) ||
                  "No additional context available.",
                severity:
                  (message.metadata?.severity as Challenge["severity"]) ||
                  "medium",
                status: challenges[message.id] || "pending",
              };

              return (
                <div key={message.id}>
                  <ChallengeCard
                    challenge={challenge}
                    onResolve={handleChallengeResolve}
                    onAcknowledge={handleChallengeAcknowledge}
                    compact
                  />
                  <div className="text-[9px] text-slate-600 mt-1.5 pl-5 font-mono">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`border-l-2 pl-3 py-2 rounded-r-lg ${getMessageTypeStyle(message.type)}`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div
                    className={`w-5 h-5 rounded-md ${agent.color} flex items-center justify-center text-white`}
                  >
                    {getAgentIcon(message.agentId)}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-200">
                    {agent.shortName}
                  </span>
                  <span
                    className={`text-[8px] px-1.5 py-0.5 rounded-md font-medium ${authorityBadge.class}`}
                  >
                    {authorityBadge.label}
                  </span>
                  {message.confidence && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-400 ml-auto font-mono">
                      {message.confidence}%
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {message.content}
                </p>

                {message.widget && (
                  <div className="mt-2">
                    <RichAgentWidget
                      config={message.widget.config as any}
                      onConfirm={(value) => console.log("Confirmed:", value)}
                      onCancel={() => console.log("Cancelled")}
                    />
                  </div>
                )}

                {message.sources &&
                  message.sources.length > 0 &&
                  !message.widget &&
                  !compact && (
                    <LogicTrace
                      sources={message.sources}
                      constraints={message.constraints}
                      modelVersion="ValueOS v2.4"
                    />
                  )}

                <div className="text-[9px] text-slate-600 mt-1.5 font-mono">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400 p-2 bg-white/5 rounded-lg">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span>Routing request...</span>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/5 bg-black/20">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask AI..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-3 pr-10 py-2.5 text-[11px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-lg hover:shadow-glow-teal disabled:opacity-50 disabled:hover:shadow-none transition-all"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
