/*
 * VALYNT Home — Unified Situational Awareness + Personal Workspace
 * Guides user naturally: Greeting → Resume → Quick Actions → Pipeline → Agent Activity
 * Replaces separate Dashboard + My Work pages
 */
import { useState } from "react";
import {
  TrendingUp, AlertTriangle, Activity, DollarSign, ArrowUpRight,
  Clock, CheckCircle2, XCircle, Loader2, ArrowRight, Sparkles,
  Plus, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { valueCases, formatCurrency } from "@/lib/data";
import { Link, useLocation } from "wouter";
import { NewCaseWizard } from "@/components/NewCaseWizard";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

const pipelineData = [
  { month: "Sep", value: 2.1 },
  { month: "Oct", value: 2.8 },
  { month: "Nov", value: 3.1 },
  { month: "Dec", value: 3.4 },
  { month: "Jan", value: 3.7 },
  { month: "Feb", value: 4.0 },
  { month: "Mar", value: 4.2 },
];

const agentCostData = [
  { name: "Extraction", cost: 12.4, runs: 156 },
  { name: "Modeling", cost: 28.6, runs: 42 },
  { name: "Narrative", cost: 8.2, runs: 38 },
  { name: "Integrity", cost: 5.8, runs: 210 },
  { name: "Red Team", cost: 15.9, runs: 28 },
  { name: "Ground Truth", cost: 3.4, runs: 89 },
];

interface AgentRun {
  id: string;
  agentName: string;
  status: "success" | "failed" | "running" | "cancelled";
  duration: number;
  startedAt: string;
}

const agentRuns: AgentRun[] = [
  { id: "r1", agentName: "Opportunity Agent", status: "success", duration: 2.1, startedAt: "2m ago" },
  { id: "r2", agentName: "Integrity Agent", status: "success", duration: 0.5, startedAt: "5m ago" },
  { id: "r3", agentName: "Research Agent", status: "success", duration: 3.2, startedAt: "8m ago" },
  { id: "r4", agentName: "Target Agent", status: "running", duration: 0, startedAt: "Just now" },
  { id: "r5", agentName: "Red Team Agent", status: "failed", duration: 1.8, startedAt: "1h ago" },
];

function getStageColor(stage: string): string {
  switch (stage) {
    case "hypothesis": return "bg-blue-50 text-blue-700 border-blue-200";
    case "modeling": return "bg-purple-50 text-purple-700 border-purple-200";
    case "integrity": return "bg-amber-50 text-amber-700 border-amber-200";
    case "narrative": return "bg-pink-50 text-pink-700 border-pink-200";
    case "realization": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default: return "bg-muted text-muted-foreground";
  }
}

function getCaseStatusColor(status: string): string {
  switch (status) {
    case "running": return "bg-emerald-500";
    case "committed": return "bg-emerald-500";
    case "completed": return "bg-blue-500";
    case "draft": return "bg-amber-500";
    case "paused": return "bg-zinc-400";
    default: return "bg-zinc-300";
  }
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);

  const totalPipeline = valueCases.reduce((sum, vc) => sum + vc.totalValue, 0);
  const activeCases = valueCases.filter((vc) => vc.status === "running" || vc.status === "draft").length;
  const myCases = valueCases.filter((c) => c.ownerEmail === "brian@me.com");
  const lastEdited = myCases[0]; // Most recently edited

  return (
    <div className="p-8 space-y-8 max-w-[1400px]">
      {/* ─── Section 1: Greeting + Resume ─── */}
      <div className="flex items-start justify-between gap-8">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Good morning, Brian
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            You have {activeCases} active cases and 2 items needing attention.
          </p>
        </div>
        <Button
          className="h-10 px-5 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90"
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Value Case
        </Button>
      </div>

      {/* ─── Section 2: Resume Where You Left Off ─── */}
      {lastEdited && (
        <Link href={`/cases/${lastEdited.id}`}>
          <div className="group border border-border rounded-xl p-5 bg-card hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Continue where you left off
              </span>
              <span className="text-xs text-muted-foreground">
                · Edited {lastEdited.lastUpdated}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {lastEdited.company} — {lastEdited.title}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <Badge variant="secondary" className={cn("text-xs font-semibold uppercase border", getStageColor(lastEdited.currentStage))}>
                    {lastEdited.currentStage}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {lastEdited.confidence}% confidence · {formatCurrency(lastEdited.totalValue)}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </Link>
      )}

      {/* ─── Section 3: Quick Actions ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className="group flex items-center gap-4 border border-border rounded-xl px-5 py-4 bg-card hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer"
          onClick={() => setWizardOpen(true)}
        >
          <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
            <Sparkles className="w-5 h-5 text-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Start a new analysis</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Build a business case from scratch with AI enrichment
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>

        <div
          className="group flex items-center gap-4 border border-border rounded-xl px-5 py-4 bg-card hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer"
          onClick={() => navigate("/company-intel")}
        >
          <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
            <Search className="w-5 h-5 text-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Research a company</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pull SEC filings, market data, and competitive intel
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* ─── Section 4: Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/cases">
          <Card className="group hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value Pipeline</p>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight">{formatCurrency(totalPipeline)}</span>
                <span className="flex items-center text-xs font-medium text-emerald-600">
                  <ArrowUpRight className="w-3 h-3" />
                  +12%
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cases">
          <Card className="group hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Cases</p>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight">{activeCases}</span>
                <Badge variant="secondary" className="text-xs font-medium text-amber-700 bg-amber-50 border-amber-200">
                  1 Flagged
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agents">
          <Card className="group hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Success</p>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight">94.8%</span>
              </div>
              <div className="mt-2">
                <Progress value={94.8} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cases">
          <Card className="group hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Integrity Flags</p>
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-amber-600">2</span>
                <span className="text-xs font-medium text-foreground group-hover:underline">
                  Review 2 Flags
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ─── Section 5: Cases Table + Agent Runs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Cases - 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Cases</CardTitle>
              <Link href="/cases" className="text-xs text-muted-foreground hover:text-foreground font-medium">
                View All Cases →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Case</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Stage</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Status</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Confidence</th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-3">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valueCases.map((vc) => (
                    <tr key={vc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <Link href={`/cases/${vc.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                          {vc.company} — {vc.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{vc.caseNumber}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className={cn("text-xs font-semibold uppercase border", getStageColor(vc.currentStage))}>
                          {vc.currentStage}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", getCaseStatusColor(vc.status))} />
                          <span className="text-sm capitalize">{vc.status}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Progress value={vc.confidence} className="h-1.5 w-16" />
                          <span className="text-xs font-mono text-muted-foreground">{vc.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-sm font-semibold font-mono">{formatCurrency(vc.totalValue)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Agent Runs - 1 col */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Agent Activity</CardTitle>
              <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground font-medium">
                View All Agents →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentRuns.map((run) => (
              <div key={run.id} className="flex items-start gap-3 py-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  run.status === "success" ? "bg-emerald-50 text-emerald-600" :
                  run.status === "failed" ? "bg-red-50 text-red-600" :
                  run.status === "running" ? "bg-blue-50 text-blue-600" :
                  "bg-muted text-muted-foreground"
                )}>
                  {run.status === "success" ? <CheckCircle2 className="w-4 h-4" /> :
                   run.status === "failed" ? <XCircle className="w-4 h-4" /> :
                   run.status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{run.agentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.status === "success" ? "Completed" : run.status === "failed" ? "Failed" : run.status === "running" ? "Running..." : "Cancelled"}
                    {run.duration > 0 && ` · ${run.duration.toFixed(1)}s`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{run.startedAt}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Section 6: Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Value Pipeline Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Total opportunity value over time (millions)</p>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pipelineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pipelineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0a0a0a" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#0a0a0a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}M`} />
                  <Tooltip
                    contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e4e4e7" }}
                    formatter={(value: number) => [`$${value}M`, "Pipeline"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0a0a0a" strokeWidth={2} fill="url(#pipelineGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Agent Cost (Last 7 Days)</CardTitle>
            <p className="text-xs text-muted-foreground">Cost per agent type in USD</p>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentCostData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e4e4e7" }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]}
                  />
                  <Bar dataKey="cost" fill="#0a0a0a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Case Wizard */}
      <NewCaseWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
