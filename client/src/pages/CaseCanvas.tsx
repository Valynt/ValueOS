/*
 * Design: Atelier — Refined Workspace Craft
 * Value Case Canvas: Stage-based, agent-composed cockpit
 * Three panels: SDUI Canvas | Agent Thread | Evidence Drawer
 */
import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Play, Pause, RotateCcw, ChevronRight, Bot, Shield,
  FileText, BarChart3, TreePine, MessageSquare, AlertTriangle,
  CheckCircle2, Clock, Sparkles, Send, ChevronDown, ExternalLink,
  TrendingUp, Target, Zap, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/data";
import { toast } from "sonner";

const stages = [
  { id: "discovery", label: "Discovery", icon: Eye },
  { id: "modeling", label: "Modeling", icon: BarChart3 },
  { id: "validation", label: "Validation", icon: Shield },
  { id: "narrative", label: "Narrative", icon: FileText },
  { id: "realization", label: "Realization", icon: Target },
  { id: "expansion", label: "Expansion", icon: TrendingUp },
];

const agentSteps = [
  { id: 1, name: "ExtractionAgent", status: "completed", duration: "12.4s", output: "Extracted 47 data points from SEC filing" },
  { id: 2, name: "GroundTruthFetcher", status: "completed", duration: "5.3s", output: "Retrieved XBRL data for FY2025" },
  { id: 3, name: "ValueTreeArchitect", status: "running", duration: "—", output: "Building value tree from extracted data..." },
  { id: 4, name: "IntegrityGuard", status: "pending", duration: "—", output: "" },
  { id: 5, name: "NarrativeComposer", status: "pending", duration: "—", output: "" },
];

const evidenceItems = [
  { id: 1, claim: "Cloud infrastructure costs reduced by 40%", tier: 1, source: "EDGAR 10-K Filing", confidence: 95, fresh: true },
  { id: 2, claim: "Average deployment frequency increased 7.5x", tier: 2, source: "Industry Benchmark (Gartner)", confidence: 82, fresh: true },
  { id: 3, claim: "Developer productivity gains of 30%", tier: 3, source: "Internal Survey Data", confidence: 68, fresh: false },
];

const discoveryCards = [
  { title: "Pain Points Identified", value: "6", subtitle: "From discovery interviews", icon: Zap },
  { title: "Stakeholders Mapped", value: "12", subtitle: "Across 4 departments", icon: Target },
  { title: "Data Sources", value: "8", subtitle: "Connected and validated", icon: FileText },
  { title: "Hypotheses", value: "3", subtitle: "Ready for modeling", icon: TrendingUp },
];

export default function CaseCanvas() {
  const [activeStage, setActiveStage] = useState("discovery");
  const [rightPanel, setRightPanel] = useState<"agent" | "evidence">("agent");
  const [agentInput, setAgentInput] = useState("");

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="px-6 py-3 border-b bg-card flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/opportunities">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold truncate">Cloud TCO Analysis</h1>
            <p className="text-[11px] text-muted-foreground">Cloud Migration ROI</p>
          </div>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold uppercase ml-2">
            Running
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Confidence meter */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <span className="text-[11px] font-medium text-muted-foreground">Confidence</span>
            <Progress value={88} className="h-1.5 w-20" />
            <span className="text-[12px] font-mono font-semibold">88%</span>
          </div>

          <Button onClick={() => toast("Running stage...")} className="gap-2 h-9">
            <Play className="w-3.5 h-3.5" />
            Run Stage
          </Button>
        </div>
      </div>

      {/* Stage Selector */}
      <div className="px-6 py-2 border-b bg-card flex items-center gap-1 overflow-x-auto flex-shrink-0">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center">
            <button
              onClick={() => setActiveStage(stage.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap",
                activeStage === stage.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <stage.icon className="w-3.5 h-3.5" />
              {stage.label}
            </button>
            {i < stages.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 mx-0.5" />}
          </div>
        ))}
      </div>

      {/* Main Three-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: SDUI Canvas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stage Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold capitalize">{activeStage} Stage</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {activeStage === "discovery" && "Mapping pain points, stakeholders, and data sources."}
                {activeStage === "modeling" && "Building the value tree and financial projections."}
                {activeStage === "validation" && "Verifying claims against ground truth sources."}
                {activeStage === "narrative" && "Composing the executive business narrative."}
                {activeStage === "realization" && "Tracking actual value delivery against projections."}
                {activeStage === "expansion" && "Identifying expansion opportunities and next steps."}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">Last updated 2h ago</Badge>
          </div>

          {/* SDUI Components */}
          {/* Discovery Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {discoveryCards.map((card) => (
              <Card key={card.title}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <card.icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  <p className="text-[12px] font-medium text-foreground mt-0.5">{card.title}</p>
                  <p className="text-[11px] text-muted-foreground">{card.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Value Tree Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
                  <TreePine className="w-4 h-4 text-primary" />
                  Value Tree
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[12px]" onClick={() => toast("Edit value tree coming soon")}>Edit</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Root */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold">Total Value Impact</span>
                    <span className="text-[15px] font-bold font-mono">{formatCurrency(1200000)}</span>
                  </div>
                </div>
                {/* Branches */}
                <div className="ml-6 space-y-2 border-l-2 border-muted pl-4">
                  <div className="p-3 rounded-lg bg-card border">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">Infrastructure Cost Reduction</span>
                      <span className="text-[13px] font-semibold font-mono">{formatCurrency(720000)}</span>
                    </div>
                    <Progress value={60} className="h-1 mt-2" />
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">Operational Efficiency</span>
                      <span className="text-[13px] font-semibold font-mono">{formatCurrency(320000)}</span>
                    </div>
                    <Progress value={27} className="h-1 mt-2" />
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">Developer Productivity</span>
                      <span className="text-[13px] font-semibold font-mono">{formatCurrency(160000)}</span>
                    </div>
                    <Progress value={13} className="h-1 mt-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Key Performance Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-2">KPI</th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-2">Category</th>
                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-2">Baseline</th>
                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-2">Target</th>
                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-2">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2.5 text-[13px] font-medium">Infra Cost Reduction</td>
                      <td className="py-2.5"><Badge variant="secondary" className="text-[10px]">Cost</Badge></td>
                      <td className="py-2.5 text-right text-[13px] font-mono text-muted-foreground">$2.4M</td>
                      <td className="py-2.5 text-right text-[13px] font-mono font-medium">$1.44M</td>
                      <td className="py-2.5 text-right text-[13px] font-mono text-emerald-600 font-semibold">-40%</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 text-[13px] font-medium">Deploy Frequency</td>
                      <td className="py-2.5"><Badge variant="secondary" className="text-[10px]">Velocity</Badge></td>
                      <td className="py-2.5 text-right text-[13px] font-mono text-muted-foreground">4/mo</td>
                      <td className="py-2.5 text-right text-[13px] font-mono font-medium">30/mo</td>
                      <td className="py-2.5 text-right text-[13px] font-mono text-emerald-600 font-semibold">+650%</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-[13px] font-medium">Time to Market</td>
                      <td className="py-2.5"><Badge variant="secondary" className="text-[10px]">Velocity</Badge></td>
                      <td className="py-2.5 text-right text-[13px] font-mono text-muted-foreground">90 days</td>
                      <td className="py-2.5 text-right text-[13px] font-mono font-medium">21 days</td>
                      <td className="py-2.5 text-right text-[13px] font-mono text-emerald-600 font-semibold">-77%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Agent Thread / Evidence */}
        <div className="hidden lg:flex w-[380px] border-l flex-col bg-card">
          {/* Panel tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setRightPanel("agent")}
              className={cn(
                "flex-1 px-4 py-3 text-[12px] font-medium transition-colors border-b-2",
                rightPanel === "agent"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Bot className="w-3.5 h-3.5 inline mr-1.5" />
              Agent Thread
            </button>
            <button
              onClick={() => setRightPanel("evidence")}
              className={cn(
                "flex-1 px-4 py-3 text-[12px] font-medium transition-colors border-b-2",
                rightPanel === "evidence"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className="w-3.5 h-3.5 inline mr-1.5" />
              Evidence
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {rightPanel === "agent" ? (
              <div className="p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow Steps</p>
                {agentSteps.map((step) => (
                  <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      step.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                      step.status === "running" ? "bg-indigo-100 text-indigo-600" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {step.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                       step.status === "running" ? <Sparkles className="w-3.5 h-3.5 animate-pulse" /> :
                       <Clock className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold">{step.name}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">{step.duration}</span>
                      </div>
                      {step.output && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{step.output}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Human Checkpoint */}
                <div className="p-3 rounded-lg border-2 border-amber-300 bg-amber-50">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <p className="text-[12px] font-semibold text-amber-800">Human Checkpoint</p>
                  </div>
                  <p className="text-[11px] text-amber-700">Review value tree before proceeding to Validation stage.</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="h-7 text-[11px]" onClick={() => toast("Approved!")}>Approve</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => toast("Requesting changes...")}>Request Changes</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence & Provenance</p>
                {evidenceItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-medium text-foreground leading-snug">{item.claim}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[9px] font-bold shrink-0",
                          item.tier === 1 ? "bg-emerald-50 text-emerald-700" :
                          item.tier === 2 ? "bg-amber-50 text-amber-700" :
                          "bg-red-50 text-red-700"
                        )}
                      >
                        Tier {item.tier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground">{item.source}</span>
                      <div className="flex items-center gap-1">
                        <Progress value={item.confidence} className="h-1 w-10" />
                        <span className="text-[10px] font-mono">{item.confidence}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="text-[10px] text-primary hover:underline">View Source</button>
                      <button className="text-[10px] text-muted-foreground hover:underline">Challenge</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent input */}
          <div className="p-3 border-t">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
              <input
                type="text"
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                placeholder="Ask the agent about this stage..."
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => { setAgentInput(""); toast("Agent query sent"); }}
                className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
