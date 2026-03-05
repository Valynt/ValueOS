/*
 * ValueOS Ask / Analysis Interface
 * Chat-style AI analysis with report and financial model views
 * Matches reference screenshots: Ask sidebar, response cards, report view, financial model
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare, BookOpen, Clock, Search, Send, ArrowRight,
  ChevronRight, FileText, TrendingUp, Shield, CheckCircle2,
  AlertTriangle, BarChart3, Globe, DollarSign, Target,
  Sparkles, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";

// --- Types ---
interface Analysis {
  id: string;
  title: string;
  date: string;
  type: "expansion" | "competitive" | "financial" | "risk";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  analysis?: AnalysisResponse;
}

interface AnalysisResponse {
  title: string;
  confidence: "high" | "medium" | "low";
  metrics: { label: string; value: string; sublabel: string }[];
  summary: string;
  readiness: number;
  riskLevel: "low" | "medium" | "high";
  sourceCount: number;
}

// --- Mock Data ---
const recentAnalyses: Analysis[] = [
  { id: "a1", title: "Expansion Analysis: Europe", date: "2h ago", type: "expansion" },
  { id: "a2", title: "Competitive Moat: Acme vs Beta", date: "1d ago", type: "competitive" },
  { id: "a3", title: "ROI Projection: Cloud Migration", date: "3d ago", type: "financial" },
  { id: "a4", title: "Risk Assessment: APAC Launch", date: "1w ago", type: "risk" },
];

const cashFlowData = [
  { month: "M0", cumulative: -450, revenue: 0, expense: 37.5 },
  { month: "M3", cumulative: -420, revenue: 15, expense: 37.5 },
  { month: "M6", cumulative: -350, revenue: 35, expense: 37.5 },
  { month: "M9", cumulative: -240, revenue: 55, expense: 37.5 },
  { month: "M12", cumulative: -100, revenue: 80, expense: 37.5 },
  { month: "M15", cumulative: 60, revenue: 100, expense: 37.5 },
  { month: "M18", cumulative: 250, revenue: 120, expense: 37.5 },
  { month: "M21", cumulative: 470, revenue: 140, expense: 37.5 },
  { month: "M24", cumulative: 720, revenue: 155, expense: 37.5 },
];

const revenueExpenseData = [
  { quarter: "Q1", revenue: 45, expense: 112.5 },
  { quarter: "Q2", revenue: 105, expense: 112.5 },
  { quarter: "Q3", revenue: 165, expense: 112.5 },
  { quarter: "Q4", revenue: 240, expense: 112.5 },
  { quarter: "Q5", revenue: 300, expense: 112.5 },
  { quarter: "Q6", revenue: 360, expense: 112.5 },
  { quarter: "Q7", revenue: 420, expense: 112.5 },
  { quarter: "Q8", revenue: 465, expense: 112.5 },
];

const plSnapshot = [
  { label: "Revenue", value: "$960,000" },
  { label: "Cost of Goods Sold", value: "$192,000" },
  { label: "Gross Profit", value: "$768,000" },
  { label: "Operating Expenses", value: "$450,000" },
  { label: "Net Income", value: "$318,000" },
  { label: "Net Margin", value: "33.1%" },
];

const reportSections = [
  { id: "exec", title: "Executive Summary", icon: FileText },
  { id: "market", title: "Market Segmentation", icon: Globe },
  { id: "competitive", title: "Competitive Moats", icon: Shield },
  { id: "risk", title: "Risk Matrix", icon: AlertTriangle },
  { id: "financial", title: "Financial Projections", icon: TrendingUp },
];

// --- Sub-views ---
type AskView = "chat" | "report" | "financial";
type SidebarTab = "ask" | "library" | "history";

export default function Ask() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("ask");
  const [currentView, setCurrentView] = useState<AskView>("chat");
  const [inputValue, setInputValue] = useState("");
  const [activeReportSection, setActiveReportSection] = useState("exec");
  const [investmentSlider, setInvestmentSlider] = useState(450000);
  const [cacSlider, setCacSlider] = useState(1200);
  const [velocitySlider, setVelocitySlider] = useState(5);
  const [expandedCascade, setExpandedCascade] = useState<string[]>(["market"]);

  const [messages] = useState<ChatMessage[]>([
    {
      id: "m1",
      role: "user",
      content: "Analyze the European expansion opportunity for our enterprise platform. What's the market potential and what would it take to establish a presence?",
    },
    {
      id: "m2",
      role: "assistant",
      content: "",
      analysis: {
        title: "Expansion Analysis: Europe",
        confidence: "high",
        metrics: [
          { label: "Market Size", value: "$2.3B", sublabel: "TAM" },
          { label: "Initial Investment", value: "$450K", sublabel: "Est." },
          { label: "Break-Even", value: "18 Months", sublabel: "" },
        ],
        summary: "The European enterprise platform market presents a compelling expansion opportunity. Our analysis of 847 companies across 12 EU markets indicates strong demand for value engineering solutions, particularly in Germany, UK, and France. The regulatory environment (GDPR compliance) creates a natural moat for established players, and our existing SOC 2 certification provides a competitive advantage.",
        readiness: 78,
        riskLevel: "medium",
        sourceCount: 12,
      },
    },
  ]);

  const toggleCascade = (id: string) => {
    setExpandedCascade((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <div className="w-[260px] border-r bg-white flex flex-col flex-shrink-0">
        {/* Tabs */}
        <div className="flex border-b">
          {(["ask", "library", "history"] as SidebarTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={cn(
                "flex-1 py-3 text-[12px] font-semibold capitalize transition-colors",
                sidebarTab === tab
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                {tab === "ask" && <MessageSquare className="w-3.5 h-3.5" />}
                {tab === "library" && <BookOpen className="w-3.5 h-3.5" />}
                {tab === "history" && <Clock className="w-3.5 h-3.5" />}
                {tab}
              </div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search analyses..."
              className="w-full pl-8 pr-3 py-2 text-[12px] border rounded-lg bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Recent Analyses */}
        <div className="flex-1 overflow-y-auto px-2">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Analyses
          </p>
          {recentAnalyses.map((a) => (
            <button
              key={a.id}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors",
                a.id === "a1" ? "bg-muted" : "hover:bg-muted/50"
              )}
            >
              <p className="text-[12px] font-medium truncate">{a.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{a.date}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View Tabs */}
        <div className="border-b px-6 flex items-center gap-1 bg-white">
          {(
            [
              { key: "chat", label: "Analysis", icon: Sparkles },
              { key: "report", label: "Full Report", icon: FileText },
              { key: "financial", label: "Financial Model", icon: BarChart3 },
            ] as { key: AskView; label: string; icon: typeof Sparkles }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCurrentView(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors",
                currentView === tab.key
                  ? "text-foreground border-foreground"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chat View */}
        {currentView === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[600px] bg-foreground text-background rounded-2xl rounded-br-sm px-5 py-3">
                        <p className="text-[13px] leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ) : msg.analysis ? (
                    <div className="max-w-[700px]">
                      {/* Analysis Response Card */}
                      <Card className="border shadow-sm">
                        <CardContent className="p-0">
                          {/* Header */}
                          <div className="p-5 pb-4 border-b">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                                  <Sparkles className="w-4 h-4 text-background" />
                                </div>
                                <div>
                                  <h3 className="text-[15px] font-bold">{msg.analysis.title}</h3>
                                  <p className="text-[11px] text-muted-foreground">ValueOS Analysis Engine</p>
                                </div>
                              </div>
                              <Badge
                                className={cn(
                                  "text-[10px] font-bold uppercase",
                                  msg.analysis.confidence === "high"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : msg.analysis.confidence === "medium"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                )}
                              >
                                {msg.analysis.confidence} Confidence
                              </Badge>
                            </div>
                          </div>

                          {/* Metrics Row */}
                          <div className="grid grid-cols-3 border-b">
                            {msg.analysis.metrics.map((m, i) => (
                              <div
                                key={i}
                                className={cn("p-4 text-center", i < 2 && "border-r")}
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {m.label}
                                </p>
                                <p className="text-xl font-bold mt-1">{m.value}</p>
                                {m.sublabel && (
                                  <p className="text-[10px] text-muted-foreground">{m.sublabel}</p>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Summary */}
                          <div className="p-5 border-b">
                            <p className="text-[13px] leading-relaxed text-muted-foreground">
                              {msg.analysis.summary}
                            </p>
                          </div>

                          {/* Readiness / Risk */}
                          <div className="p-5 border-b grid grid-cols-2 gap-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Market Readiness
                                </span>
                                <span className="text-[12px] font-mono font-bold">
                                  {msg.analysis.readiness}%
                                </span>
                              </div>
                              <Progress value={msg.analysis.readiness} className="h-2" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                Risk Level
                              </p>
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-3 h-3 rounded-full",
                                    msg.analysis.riskLevel === "low"
                                      ? "bg-emerald-500"
                                      : msg.analysis.riskLevel === "medium"
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                  )}
                                />
                                <span className="text-[13px] font-semibold capitalize">
                                  {msg.analysis.riskLevel}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setCurrentView("report")}
                                className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-lg text-[12px] font-semibold hover:opacity-90 transition-opacity"
                              >
                                View Full Report
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setCurrentView("financial")}
                                className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-[12px] font-semibold hover:bg-muted/50 transition-colors"
                              >
                                See Financial Model
                                <BarChart3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              {msg.analysis.sourceCount} Verified Sources
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t p-4 bg-white">
              <div className="max-w-[700px] mx-auto relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="w-full pl-4 pr-12 py-3 border rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-ring bg-muted/20"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report View */}
        {currentView === "report" && (
          <div className="flex-1 flex overflow-hidden">
            {/* TOC Sidebar */}
            <div className="w-[220px] border-r bg-white p-4 flex-shrink-0 overflow-y-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Table of Contents
              </p>
              {reportSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveReportSection(s.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium mb-0.5 transition-colors",
                    activeReportSection === s.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <s.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {s.title}
                </button>
              ))}
            </div>

            {/* Report Content */}
            <div className="flex-1 overflow-y-auto p-8 max-w-[800px]">
              <div className="mb-6">
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase mb-3">
                  High Confidence
                </Badge>
                <h1 className="text-2xl font-bold">European Market Expansion Analysis</h1>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Generated by ValueOS Analysis Engine · 12 verified sources · Updated 2h ago
                </p>
              </div>

              {/* Executive Summary */}
              {activeReportSection === "exec" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold mb-3">Executive Summary</h2>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      The European enterprise software market represents a $2.3B total addressable market for value engineering solutions. Our analysis identifies Germany, the United Kingdom, and France as the three highest-potential markets, collectively representing 62% of the addressable opportunity. The regulatory landscape, particularly GDPR compliance requirements, creates both a barrier to entry and a competitive moat for established players with existing compliance infrastructure.
                    </p>
                    <p className="text-[13px] leading-relaxed text-muted-foreground mt-3">
                      Based on our modeling of 847 enterprise accounts across 12 EU markets, we project an initial investment requirement of $450K with a break-even timeline of approximately 18 months. The primary risk factors include currency fluctuation exposure and the need for localized go-to-market strategies in each target market.
                    </p>
                  </div>

                  {/* Key Factors */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-emerald-600" />
                          <span className="text-[12px] font-bold">Market Opportunity</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                          Strong demand signals from 340+ enterprise accounts currently using legacy value engineering tools. 67% express interest in modern, AI-powered alternatives.
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-4 h-4 text-blue-600" />
                          <span className="text-[12px] font-bold">Competitive Advantage</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                          Existing SOC 2 Type II and ISO 27001 certifications provide immediate compliance readiness. GDPR data residency requirements can be met through EU-based infrastructure.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Regional Hub Selection */}
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-[14px] font-bold mb-3">Regional Hub Selection</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { city: "London", score: 92, factors: ["Financial services hub", "English-speaking", "Strong tech ecosystem"] },
                          { city: "Frankfurt", score: 88, factors: ["EU data center hub", "Manufacturing base", "Central location"] },
                          { city: "Paris", score: 85, factors: ["Large enterprise market", "Government contracts", "Innovation hub"] },
                        ].map((hub) => (
                          <div key={hub.city} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[13px] font-bold">{hub.city}</span>
                              <span className="text-[11px] font-mono font-bold text-emerald-600">{hub.score}/100</span>
                            </div>
                            <div className="space-y-1">
                              {hub.factors.map((f, i) => (
                                <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  {f}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Market Segmentation */}
              {activeReportSection === "market" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold">Market Segmentation</h2>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    The European market segments into four primary tiers based on enterprise size, technology maturity, and value engineering adoption readiness.
                  </p>

                  {[
                    { segment: "Enterprise (5000+ employees)", tam: "$1.2B", penetration: "12%", growth: "+18% YoY" },
                    { segment: "Mid-Market (500-5000)", tam: "$680M", penetration: "8%", growth: "+24% YoY" },
                    { segment: "Growth (100-500)", tam: "$320M", penetration: "4%", growth: "+31% YoY" },
                    { segment: "SMB (<100)", tam: "$100M", penetration: "2%", growth: "+15% YoY" },
                  ].map((seg) => (
                    <Card key={seg.segment}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[13px] font-bold">{seg.segment}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              TAM: {seg.tam} · Penetration: {seg.penetration}
                            </p>
                          </div>
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                            {seg.growth}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Competitive Moats */}
              {activeReportSection === "competitive" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold">Competitive Moats</h2>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Three primary competitive moats have been identified that would protect market position in the European expansion.
                  </p>
                  {[
                    { moat: "Data & Compliance Infrastructure", strength: 92, desc: "Existing SOC 2, ISO 27001, and GDPR-ready architecture creates a 12-18 month lead over competitors starting from scratch." },
                    { moat: "AI/ML Model Maturity", strength: 87, desc: "Proprietary value engineering models trained on 10,000+ enterprise cases provide accuracy advantages that require years to replicate." },
                    { moat: "Integration Ecosystem", strength: 78, desc: "Pre-built integrations with Salesforce, HubSpot, and major CRM platforms reduce implementation time by 60%." },
                  ].map((m) => (
                    <Card key={m.moat}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold">{m.moat}</span>
                          <span className="text-[12px] font-mono font-bold">{m.strength}/100</span>
                        </div>
                        <Progress value={m.strength} className="h-1.5 mb-3" />
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{m.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Risk Matrix */}
              {activeReportSection === "risk" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold">Risk Matrix</h2>
                  {[
                    { risk: "Currency Fluctuation", impact: "high", probability: "medium", mitigation: "Multi-currency pricing with quarterly adjustments. EUR/GBP hedging strategy." },
                    { risk: "Regulatory Changes", impact: "high", probability: "low", mitigation: "Dedicated compliance monitoring. Flexible data residency architecture." },
                    { risk: "Talent Acquisition", impact: "medium", probability: "high", mitigation: "Remote-first hiring strategy. Partner with local recruitment agencies." },
                    { risk: "Competitive Response", impact: "medium", probability: "medium", mitigation: "First-mover advantage in AI-powered value engineering. Patent portfolio." },
                  ].map((r) => (
                    <Card key={r.risk}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold">{r.risk}</span>
                          <div className="flex gap-2">
                            <Badge className={cn(
                              "text-[10px] font-bold uppercase",
                              r.impact === "high" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            )}>
                              Impact: {r.impact}
                            </Badge>
                            <Badge className={cn(
                              "text-[10px] font-bold uppercase",
                              r.probability === "high" ? "bg-red-50 text-red-700 border-red-200" :
                              r.probability === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                              Prob: {r.probability}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{r.mitigation}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Financial Projections */}
              {activeReportSection === "financial" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold">Financial Projections</h2>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Detailed financial projections are available in the interactive Financial Model tab. Key highlights below.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Year 1 Revenue", value: "$960K" },
                      { label: "Year 1 Net Income", value: "$318K" },
                      { label: "Payback Period", value: "18 months" },
                    ].map((m) => (
                      <Card key={m.label}>
                        <CardContent className="p-4 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                          <p className="text-xl font-bold mt-1">{m.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentView("financial")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-lg text-[12px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    Open Interactive Financial Model
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Financial Model View */}
        {currentView === "financial" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Variable Parameters Sidebar */}
            <div className="w-[280px] border-r bg-white p-5 flex-shrink-0 overflow-y-auto">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Variable Parameters
              </p>

              <div className="space-y-6">
                {/* Initial Investment */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold">Initial Investment</label>
                    <span className="text-[12px] font-mono font-bold">${(investmentSlider / 1000).toFixed(0)}K</span>
                  </div>
                  <input
                    type="range"
                    min={100000}
                    max={1000000}
                    step={10000}
                    value={investmentSlider}
                    onChange={(e) => setInvestmentSlider(Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-foreground"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>$100K</span>
                    <span>$1M</span>
                  </div>
                </div>

                {/* Monthly CAC */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold">Monthly CAC</label>
                    <span className="text-[12px] font-mono font-bold">${cacSlider.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={100}
                    value={cacSlider}
                    onChange={(e) => setCacSlider(Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-foreground"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>$500</span>
                    <span>$5,000</span>
                  </div>
                </div>

                {/* Sales Velocity */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold">Sales Velocity</label>
                    <span className="text-[12px] font-mono font-bold">{velocitySlider} deals/mo</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={velocitySlider}
                    onChange={(e) => setVelocitySlider(Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-foreground"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>
              </div>

              {/* Model Assumptions */}
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={() => toggleCascade("assumptions")}
                  className="flex items-center justify-between w-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Model Assumptions
                  {expandedCascade.includes("assumptions") ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {expandedCascade.includes("assumptions") && (
                  <div className="mt-3 space-y-2">
                    {[
                      { label: "Time Horizon", value: "36 months" },
                      { label: "Discount Rate", value: "12%" },
                      { label: "Initial Adoption", value: "50%" },
                      { label: "Ramp Duration", value: "12 months" },
                      { label: "Inflation Rate", value: "2.5%" },
                    ].map((a) => (
                      <div key={a.label} className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{a.label}</span>
                        <span className="text-[11px] font-mono font-semibold">{a.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Charts & Results */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cumulative Cash Flow */}
                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-[14px] font-bold mb-1">Cumulative Cash Flow Projection</h3>
                    <p className="text-[11px] text-muted-foreground mb-4">24-month projection ($K)</p>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlowData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                          <defs>
                            <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0a0a0a" stopOpacity={0.08} />
                              <stop offset="95%" stopColor="#0a0a0a" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}K`} />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }} formatter={(value: number) => [`$${value}K`, "Cumulative"]} />
                          <Area type="monotone" dataKey="cumulative" stroke="#0a0a0a" strokeWidth={2} fill="url(#cfGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue vs Expense */}
                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-[14px] font-bold mb-1">Revenue vs Expense Breakdown</h3>
                    <p className="text-[11px] text-muted-foreground mb-4">Quarterly ($K)</p>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueExpenseData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}K`} />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="revenue" fill="#0a0a0a" radius={[3, 3, 0, 0]} name="Revenue" />
                          <Bar dataKey="expense" fill="#e4e4e7" radius={[3, 3, 0, 0]} name="Expense" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Model Conclusion */}
              <Card className="border-2 border-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <DollarSign className="w-5 h-5" />
                    <h3 className="text-[15px] font-bold">Model Conclusion</h3>
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold font-mono">18.0</span>
                    <span className="text-lg font-bold text-muted-foreground">MONTHS</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Based on the current parameters (${(investmentSlider / 1000).toFixed(0)}K initial investment, ${cacSlider.toLocaleString()} monthly CAC, {velocitySlider} deals/month), the European expansion reaches break-even at approximately 18 months. The model projects a 33.1% net margin by end of Year 1, with cumulative cash flow turning positive in Month 15.
                  </p>
                </CardContent>
              </Card>

              {/* Year 1 P&L Snapshot */}
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-[14px] font-bold mb-4">Year 1 P&L Snapshot</h3>
                  <table className="w-full">
                    <tbody>
                      {plSnapshot.map((row, i) => (
                        <tr key={row.label} className={cn("border-b last:border-0", i === 2 && "border-t-2 border-foreground/20", i === 4 && "border-t-2 border-foreground/20")}>
                          <td className={cn("py-2.5 text-[13px]", (i === 2 || i === 4 || i === 5) ? "font-bold" : "text-muted-foreground")}>
                            {row.label}
                          </td>
                          <td className={cn("py-2.5 text-right text-[13px] font-mono", (i === 2 || i === 4 || i === 5) ? "font-bold" : "")}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
