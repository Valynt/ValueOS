import {
  ArrowRight,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  PieChart,
  Search,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────
type ViewMode = "chat" | "report" | "financial";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: { label: string; url: string }[];
  metrics?: { label: string; value: string; trend?: "up" | "down" }[];
}

// ── Mock Data ───────────────────────────────────────────────────
const mockMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "What is the total addressable value across all active cases for Acme Corp?",
    timestamp: "2 min ago",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "Based on the 3 active value cases for Acme Corp, the total addressable value is **$4.2M annually** across infrastructure optimization ($1.8M), cloud migration ($1.5M), and security modernization ($0.9M). The weighted confidence score across all cases is **82%**, with the infrastructure case having the highest integrity rating at 91%.",
    timestamp: "1 min ago",
    sources: [
      { label: "Acme Corp — Infrastructure Optimization (VC-1024)", url: "#" },
      { label: "Acme Corp — Cloud Migration (VC-1031)", url: "#" },
      { label: "Gartner IT Spending Benchmark 2025", url: "#" },
    ],
    metrics: [
      { label: "Total Value", value: "$4.2M", trend: "up" },
      { label: "Avg Confidence", value: "82%", trend: "up" },
      { label: "Cases Active", value: "3" },
      { label: "Time to Close", value: "45 days", trend: "down" },
    ],
  },
];

const reportSections = [
  {
    id: "exec",
    title: "Executive Summary",
    content:
      "Acme Corp presents a high-value engagement opportunity with $4.2M in total addressable annual value across three active value cases. The enterprise platform migration represents the largest single opportunity at $1.8M, driven by server consolidation and license optimization. All three cases have passed initial integrity checks with a weighted confidence score of 82%.",
  },
  {
    id: "market",
    title: "Market Context",
    content:
      "The manufacturing sector IT spending is projected to grow 6.8% in 2025 (Gartner). Acme Corp's current IT spend of 7.5% of revenue ($180M) is within the industry range of 6.8-8.2%. Key market drivers include cloud-first mandates, supply chain digitization, and regulatory compliance requirements in APAC markets.",
  },
  {
    id: "risk",
    title: "Risk Assessment",
    content:
      "Two primary risks have been identified: (1) The 4:1 server consolidation ratio exceeds the industry average of 3:1, potentially overstating infrastructure savings by 15-20%. (2) The APAC revenue projection of $2.1M lacks competitive analysis — three incumbents hold 60% market share in the target segment. Mitigation strategies are recommended for both.",
  },
  {
    id: "financial",
    title: "Financial Impact",
    content:
      "Net present value of the combined engagement is estimated at $3.1M over 3 years with a 12% discount rate. The payback period for the infrastructure optimization case is 8 months, while the cloud migration case has a 14-month payback. Internal rate of return across all cases is 34%.",
  },
];

const financialModel = {
  revenue: { base: 2400, growth: 8.2 },
  costSavings: { infrastructure: 1800, cloud: 1500, security: 900 },
  implementation: { year1: 850, year2: 420, year3: 180 },
  roi: { year1: -12, year2: 45, year3: 89 },
  npv: 3100,
  irr: 34,
  payback: 14,
};

// ── Chat View ───────────────────────────────────────────────────
function ChatView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(mockMessages);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I'm analyzing your query across all available data sources. Based on the current value cases and market intelligence, I can provide a detailed breakdown. Would you like me to generate a full report or focus on specific metrics?",
          timestamp: "Just now",
          sources: [{ label: "ValueOS Analysis Engine", url: "#" }],
        },
      ]);
      setIsTyping(false);
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={cn("max-w-[600px]", msg.role === "user" ? "order-first" : "")}>
              <div
                className={cn(
                  "p-4 rounded-2xl text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-zinc-950 text-white ml-auto"
                    : "bg-white border border-zinc-200 text-zinc-700"
                )}
              >
                {msg.content}
              </div>

              {/* Metrics */}
              {msg.metrics && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {msg.metrics.map((m) => (
                    <div key={m.label} className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
                      <p className="text-[15px] font-black text-zinc-950 tracking-tight">{m.value}</p>
                      <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{m.label}</p>
                      {m.trend && (
                        <div className="flex items-center justify-center gap-0.5 mt-1">
                          {m.trend === "up" ? (
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sources */}
              {msg.sources && (
                <div className="mt-3 space-y-1">
                  {msg.sources.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-lg text-[11px] text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span className="flex-1 truncate">{s.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-zinc-300 mt-1.5 px-1">{msg.timestamp}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              <span className="text-[12px] text-zinc-400">Analyzing across data sources...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 bg-white">
        <div className="flex items-center gap-3 bg-zinc-50 rounded-2xl p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about value cases, company intelligence, or financial models..."
            className="flex-1 bg-transparent text-[13px] text-zinc-700 placeholder:text-zinc-400 px-3 py-2 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 bg-zinc-950 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 px-2">
          <span className="text-[10px] text-zinc-400">Suggested:</span>
          {["Show ROI breakdown", "Compare all cases", "Risk summary"].map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="text-[10px] px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-full hover:bg-zinc-200"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Report View ─────────────────────────────────────────────────
function ReportView() {
  const [activeSection, setActiveSection] = useState("exec");

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* TOC sidebar */}
      <div className="w-56 border-r border-zinc-200 bg-white p-4 flex-shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">Table of Contents</h3>
        <div className="space-y-1">
          {reportSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-colors",
                activeSection === s.id ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100"
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Report content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-zinc-950 tracking-tight">Value Analysis Report</h2>
              <p className="text-[12px] text-zinc-400 mt-1">Generated by ValueOS Analysis Engine — March 4, 2026</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>

          {reportSections.map((section) => (
            <div key={section.id} id={section.id} className="mb-8">
              <h3 className="text-[15px] font-bold text-zinc-900 mb-3 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-zinc-400" />
                {section.title}
              </h3>
              <p className="text-[13px] text-zinc-600 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Financial Model View ────────────────────────────────────────
function FinancialView() {
  const [growthRate, setGrowthRate] = useState(financialModel.revenue.growth);
  const [discountRate, setDiscountRate] = useState(12);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">Financial Model</h2>
            <p className="text-[12px] text-zinc-400 mt-1">Interactive scenario planning — adjust assumptions below</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
            <Download className="w-3.5 h-3.5" />
            Export Model
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Net Present Value", value: `$${financialModel.npv.toLocaleString()}K`, trend: "up" as const },
            { label: "Internal Rate of Return", value: `${financialModel.irr}%`, trend: "up" as const },
            { label: "Payback Period", value: `${financialModel.payback} mo`, trend: "down" as const },
            { label: "Total Cost Savings", value: `$${((financialModel.costSavings.infrastructure + financialModel.costSavings.cloud + financialModel.costSavings.security) / 1000).toFixed(1)}M` },
          ].map((m) => (
            <div key={m.label} className="bg-white border border-zinc-200 rounded-2xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 mb-1">{m.label}</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black text-zinc-950 tracking-tight">{m.value}</p>
                {m.trend && (
                  m.trend === "up" ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-emerald-500" />
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Assumption Sliders */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h3 className="text-[13px] font-semibold text-zinc-900 mb-4">Scenario Assumptions</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-medium text-zinc-600">Revenue Growth Rate</label>
                <span className="text-[12px] font-bold text-zinc-900">{growthRate.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={0.1}
                value={growthRate}
                onChange={(e) => setGrowthRate(parseFloat(e.target.value))}
                className="w-full accent-zinc-950"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                <span>0%</span>
                <span>20%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-medium text-zinc-600">Discount Rate</label>
                <span className="text-[12px] font-bold text-zinc-900">{discountRate}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={25}
                step={1}
                value={discountRate}
                onChange={(e) => setDiscountRate(parseInt(e.target.value))}
                className="w-full accent-zinc-950"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                <span>5%</span>
                <span>25%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Savings Breakdown */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h3 className="text-[13px] font-semibold text-zinc-900 mb-4">Cost Savings Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: "Infrastructure Optimization", value: financialModel.costSavings.infrastructure, color: "bg-blue-500" },
              { label: "Cloud Migration", value: financialModel.costSavings.cloud, color: "bg-violet-500" },
              { label: "Security Modernization", value: financialModel.costSavings.security, color: "bg-emerald-500" },
            ].map((item) => {
              const total = financialModel.costSavings.infrastructure + financialModel.costSavings.cloud + financialModel.costSavings.security;
              const pct = (item.value / total) * 100;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-zinc-600">{item.label}</span>
                    <span className="text-[12px] font-bold text-zinc-900">${(item.value / 1000).toFixed(1)}M</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", item.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3-Year P&L Snapshot */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h3 className="text-[13px] font-semibold text-zinc-900 mb-4">3-Year P&L Snapshot</h3>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 font-semibold text-zinc-500">Metric</th>
                <th className="text-right py-2 font-semibold text-zinc-500">Year 1</th>
                <th className="text-right py-2 font-semibold text-zinc-500">Year 2</th>
                <th className="text-right py-2 font-semibold text-zinc-500">Year 3</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100">
                <td className="py-2 text-zinc-700">Total Savings</td>
                <td className="py-2 text-right text-zinc-900 font-medium">$4.2M</td>
                <td className="py-2 text-right text-zinc-900 font-medium">$4.5M</td>
                <td className="py-2 text-right text-zinc-900 font-medium">$4.9M</td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-2 text-zinc-700">Implementation Cost</td>
                <td className="py-2 text-right text-red-600 font-medium">($850K)</td>
                <td className="py-2 text-right text-red-600 font-medium">($420K)</td>
                <td className="py-2 text-right text-red-600 font-medium">($180K)</td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-2 text-zinc-700 font-semibold">Net Value</td>
                <td className="py-2 text-right text-zinc-900 font-bold">$3.35M</td>
                <td className="py-2 text-right text-zinc-900 font-bold">$4.08M</td>
                <td className="py-2 text-right text-zinc-900 font-bold">$4.72M</td>
              </tr>
              <tr>
                <td className="py-2 text-zinc-700">ROI</td>
                <td className={cn("py-2 text-right font-bold", financialModel.roi.year1 < 0 ? "text-red-600" : "text-emerald-600")}>
                  {financialModel.roi.year1}%
                </td>
                <td className="py-2 text-right text-emerald-600 font-bold">{financialModel.roi.year2}%</td>
                <td className="py-2 text-right text-emerald-600 font-bold">{financialModel.roi.year3}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Ask View ───────────────────────────────────────────────
export default function Ask() {
  const [viewMode, setViewMode] = useState<ViewMode>("chat");

  const views: { key: ViewMode; label: string; icon: React.ElementType }[] = [
    { key: "chat", label: "Chat", icon: MessageSquare },
    { key: "report", label: "Full Report", icon: FileText },
    { key: "financial", label: "Financial Model", icon: BarChart3 },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center gap-4 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-zinc-950 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-[15px] font-black text-zinc-950 tracking-tight">ValueOS Analysis</h2>
          <p className="text-[11px] text-zinc-400">Ask questions about your value cases, company intelligence, and financial models</p>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
          {views.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                  viewMode === v.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* View content */}
      {viewMode === "chat" && <ChatView />}
      {viewMode === "report" && <ReportView />}
      {viewMode === "financial" && <FinancialView />}
    </div>
  );
}
