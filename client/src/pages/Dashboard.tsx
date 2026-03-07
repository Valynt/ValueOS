/*
 * VALYNT Home — Unified Situational Awareness + Personal Workspace
 * Refactored to use standardized shared components for scalability.
 * Guides user naturally: Greeting → Resume → Quick Actions → Pipeline → Agent Activity
 */
import { useState } from "react";
import {
  TrendingUp, AlertTriangle, Activity, DollarSign,
  ArrowRight, Clock, Sparkles, Plus, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { valueCases, formatCurrency } from "@/lib/data";
import { Link, useLocation } from "wouter";
import { NewCaseWizard } from "@/components/NewCaseWizard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

/* ── Shared Components ── */
import {
  PageHeader,
  StatCard,
  StatusBadge,
  SectionCard,
  ActivityItem,
  DataTable,
  type Column,
} from "@/components/shared";

/* ── Static Data ── */

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

const caseColumns: Column[] = [
  { key: "case", label: "Case" },
  { key: "stage", label: "Stage" },
  { key: "status", label: "Status" },
  { key: "confidence", label: "Confidence" },
  { key: "value", label: "Value", align: "right" },
];

/* ── Quick Action Card ── */

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-4 border border-border rounded-xl px-5 py-4 bg-card hover:shadow-md hover:border-foreground/10 transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </div>
  );
}

/* ── Main Dashboard ── */

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);

  const totalPipeline = valueCases.reduce((sum, vc) => sum + vc.totalValue, 0);
  const activeCases = valueCases.filter((vc) => vc.status === "running" || vc.status === "draft").length;
  const myCases = valueCases.filter((c) => c.ownerEmail === "brian@me.com");
  const lastEdited = myCases[0];

  return (
    <div className="p-8 space-y-8 max-w-[1400px]">
      {/* ─── Section 1: Greeting ─── */}
      <PageHeader
        title="Good morning, Brian"
        description={`You have ${activeCases} active cases and 2 items needing attention.`}
        action={
          <Button
            className="h-10 px-5 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Value Case
          </Button>
        }
      />

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
                  <StatusBadge type="stage" value={lastEdited.currentStage} />
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
        <QuickAction
          icon={Sparkles}
          title="Start a new analysis"
          description="Build a business case from scratch with AI enrichment"
          onClick={() => setWizardOpen(true)}
        />
        <QuickAction
          icon={Search}
          title="Research a company"
          description="Pull SEC filings, market data, and competitive intel"
          onClick={() => navigate("/company-intel")}
        />
      </div>

      {/* ─── Section 4: Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Value Pipeline"
          value={formatCurrency(totalPipeline)}
          trend="+12%"
          trendDirection="up"
          onClick={() => navigate("/cases")}
        />
        <StatCard
          icon={Activity}
          label="Active Cases"
          value={activeCases}
          badge="1 Flagged"
          badgeVariant="warning"
          onClick={() => navigate("/cases")}
        />
        <StatCard
          icon={TrendingUp}
          label="Agent Success"
          value="94.8%"
          progress={94.8}
          onClick={() => navigate("/agents")}
        />
        <StatCard
          icon={AlertTriangle}
          label="Integrity Flags"
          value="2"
          badge="Review 2 Flags"
          badgeVariant="destructive"
          onClick={() => navigate("/cases")}
        />
      </div>

      {/* ─── Section 5: Cases Table + Agent Runs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Cases - 2 cols */}
        <div className="lg:col-span-2">
          <SectionCard title="Recent Cases" linkText="View All Cases →" linkHref="/cases">
            <DataTable
              columns={caseColumns}
              data={valueCases}
              bordered={false}
              renderRow={(vc) => (
                <DataTable.Row key={vc.id}>
                  <DataTable.Cell>
                    <Link href={`/cases/${vc.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                      {vc.company} — {vc.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{vc.caseNumber}</p>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <StatusBadge type="stage" value={vc.currentStage} />
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <StatusBadge type="status" value={vc.status} dot />
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <div className="flex items-center gap-2">
                      <Progress value={vc.confidence} className="h-1.5 w-16" />
                      <span className="text-xs font-mono text-muted-foreground">{vc.confidence}%</span>
                    </div>
                  </DataTable.Cell>
                  <DataTable.Cell align="right">
                    <span className="text-sm font-semibold font-mono">{formatCurrency(vc.totalValue)}</span>
                  </DataTable.Cell>
                </DataTable.Row>
              )}
            />
          </SectionCard>
        </div>

        {/* Recent Agent Runs - 1 col */}
        <SectionCard title="Agent Activity" linkText="View All Agents →" linkHref="/agents">
          <div className="space-y-1">
            {agentRuns.map((run) => (
              <ActivityItem
                key={run.id}
                status={run.status}
                title={run.agentName}
                subtitle={
                  run.status === "running"
                    ? "Running..."
                    : `${run.status === "success" ? "Completed" : "Failed"}${run.duration > 0 ? ` · ${run.duration.toFixed(1)}s` : ""}`
                }
                timestamp={run.startedAt}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ─── Section 6: Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Value Pipeline Trend" description="Total opportunity value over time (millions)">
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
        </SectionCard>

        <SectionCard title="Agent Cost (Last 7 Days)" description="Cost per agent type in USD">
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
        </SectionCard>
      </div>

      {/* New Case Wizard */}
      <NewCaseWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
