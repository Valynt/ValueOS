/*
 * VALYNT Dashboard — Situational Awareness
 * Metrics cards, lifecycle table, agent runs, pipeline chart
 */
import { TrendingUp, AlertTriangle, Activity, DollarSign, ArrowUpRight, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { valueCases, formatCurrency } from "@/lib/data";
import { Link } from "wouter";
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
  const totalPipeline = valueCases.reduce((sum, vc) => sum + vc.totalValue, 0);
  const activeCases = valueCases.filter((vc) => vc.status === "running" || vc.status === "draft").length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Good morning, Brian</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Ready to prove some value today?
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Value Pipeline</p>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{formatCurrency(totalPipeline)}</span>
              <span className="flex items-center text-[12px] font-medium text-emerald-600">
                <ArrowUpRight className="w-3 h-3" />
                +12%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Cases</p>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{activeCases}</span>
              <Badge variant="secondary" className="text-[10px] font-medium text-amber-700 bg-amber-50 border-amber-200">
                1 Flagged
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent Success</p>
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

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Integrity Flags</p>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-amber-600">2</span>
              <Link href="/cases" className="text-[12px] font-medium text-foreground hover:underline">
                Review
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Lifecycle Execution - 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold">Recent Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Case</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Stage</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Status</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">Confidence</th>
                    <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-3">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valueCases.map((vc) => (
                    <tr key={vc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <Link href={`/cases/${vc.id}`} className="text-[13px] font-medium text-foreground hover:text-primary transition-colors">
                          {vc.company} — {vc.title}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">{vc.caseNumber}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className={cn("text-[10px] font-semibold uppercase border", getStageColor(vc.currentStage))}>
                          {vc.currentStage}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", getCaseStatusColor(vc.status))} />
                          <span className="text-[13px] capitalize">{vc.status}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Progress value={vc.confidence} className="h-1.5 w-16" />
                          <span className="text-[12px] font-mono text-muted-foreground">{vc.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[13px] font-semibold font-mono">{formatCurrency(vc.totalValue)}</span>
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
              <CardTitle className="text-[15px] font-semibold">Recent Agent Runs</CardTitle>
              <Link href="/agents" className="text-[12px] text-muted-foreground hover:text-foreground font-medium">
                View All
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
                  <p className="text-[13px] font-medium truncate">{run.agentName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {run.status === "success" ? "Completed" : run.status === "failed" ? "Failed" : run.status === "running" ? "Running..." : "Cancelled"}
                    {run.duration > 0 && ` · ${run.duration.toFixed(1)}s`}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{run.startedAt}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold">Value Pipeline Trend</CardTitle>
            <p className="text-[12px] text-muted-foreground">Total opportunity value over time (millions)</p>
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
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}M`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
                    formatter={(value: number) => [`$${value}M`, "Pipeline"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0a0a0a" strokeWidth={2} fill="url(#pipelineGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Agent Cost Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold">Agent Cost (Last 7 Days)</CardTitle>
            <p className="text-[12px] text-muted-foreground">Cost per agent type in USD</p>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentCostData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]}
                  />
                  <Bar dataKey="cost" fill="#0a0a0a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
