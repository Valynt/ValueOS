/**
 * ValueOS Wireframes — Value Realization Dashboard
 * Sprint 18 KR3: Committed KPIs vs actuals, milestone completion, risk register, variance
 * The post-sale proof screen — "we committed $2.4M; we realized $1.8M (75%) at month 6"
 */
import { motion } from "framer-motion";
import {
  Shield, TrendingUp, TrendingDown,
  CheckCircle2, Clock, AlertTriangle, Download, Calendar,
  Target, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
  ChevronRight, Sparkles, Flag, Milestone
} from "lucide-react";
import { useState } from "react";
import { AnnotatedSection } from "@/components/wireframes/AnnotationOverlay";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const caseHeader = {
  name: "Initech — Process Automation Value Case",
  status: "Realization Active",
  approvedDate: "2025-11-15",
  projectedValue: "$2.4M",
  realizedValue: "$1.82M",
  realizationPct: 75.8,
  timeElapsed: "6 of 12 months",
  nextMilestone: "Q2 Productivity Audit",
  nextMilestoneDate: "2026-04-15",
};

const kpis = [
  {
    id: "1",
    name: "Annual Cost Avoidance",
    committed: 1200000,
    actual: 980000,
    unit: "$",
    variance: -18.3,
    trend: "improving" as const,
    status: "on-track" as const,
    notes: "Q1 savings tracking 82% of target. Q2 ramp expected to close gap.",
  },
  {
    id: "2",
    name: "Process Cycle Time Reduction",
    committed: 40,
    actual: 47,
    unit: "%",
    variance: +17.5,
    trend: "exceeding" as const,
    status: "exceeding" as const,
    notes: "Automation delivered 47% reduction vs 40% target. Additional workflows identified.",
  },
  {
    id: "3",
    name: "FTE Reallocation",
    committed: 12,
    actual: 8,
    unit: "FTEs",
    variance: -33.3,
    trend: "at-risk" as const,
    status: "at-risk" as const,
    notes: "4 FTEs pending reallocation blocked by union negotiation timeline.",
  },
  {
    id: "4",
    name: "Error Rate Reduction",
    committed: 60,
    actual: 72,
    unit: "%",
    variance: +20.0,
    trend: "exceeding" as const,
    status: "exceeding" as const,
    notes: "ML-based validation catching more edge cases than projected.",
  },
  {
    id: "5",
    name: "Customer Satisfaction (NPS)",
    committed: 15,
    actual: 11,
    unit: "pts",
    variance: -26.7,
    trend: "improving" as const,
    status: "on-track" as const,
    notes: "NPS up 11 pts from baseline. Lagging indicator — expect convergence by Q3.",
  },
];

const milestones = [
  { id: "m1", name: "Phase 1: Pilot Deployment", date: "2025-12-01", status: "completed" as const, completedDate: "2025-11-28" },
  { id: "m2", name: "Phase 2: Full Rollout", date: "2026-01-15", status: "completed" as const, completedDate: "2026-01-12" },
  { id: "m3", name: "Q1 Value Checkpoint", date: "2026-03-01", status: "completed" as const, completedDate: "2026-03-05" },
  { id: "m4", name: "Q2 Productivity Audit", date: "2026-04-15", status: "upcoming" as const },
  { id: "m5", name: "Mid-Year Executive Review", date: "2026-06-01", status: "upcoming" as const },
  { id: "m6", name: "Annual Realization Report", date: "2026-11-15", status: "upcoming" as const },
];

const risks = [
  { id: "r1", severity: "high" as const, title: "FTE reallocation blocked by union timeline", impact: "May delay $420K in projected savings", mitigation: "Escalate to CHRO; explore contractor bridge", owner: "VP Operations" },
  { id: "r2", severity: "medium" as const, title: "Q2 budget reforecast may shift baseline", impact: "Could change committed cost avoidance denominator", mitigation: "Lock baseline with CFO before reforecast", owner: "Finance Lead" },
  { id: "r3", severity: "low" as const, title: "Vendor contract renewal in Q3", impact: "License cost increase could erode 5% of savings", mitigation: "Begin renewal negotiation early; benchmark alternatives", owner: "Procurement" },
];

const expansionSignals = [
  { id: "e1", signal: "47% cycle time reduction exceeds target", recommendation: "Extend automation to 3 adjacent workflows", estimatedValue: "$800K", confidence: 0.78 },
  { id: "e2", signal: "Error rate reduction outperforming across all regions", recommendation: "Propose ML validation for compliance workflows", estimatedValue: "$1.1M", confidence: 0.65 },
];

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */
function VarianceIndicator({ variance, trend }: { variance: number; trend: string }) {
  const isPositive = variance >= 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-mono ${
      trend === "exceeding" ? "text-health" :
      trend === "at-risk" ? "text-risk" :
      "text-warning"
    }`}>
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {isPositive ? "+" : ""}{variance.toFixed(1)}%
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "exceeding": "bg-health/15 text-health border-health/20",
    "on-track": "bg-info/15 text-info border-info/20",
    "at-risk": "bg-risk/15 text-risk border-risk/20",
    "completed": "bg-health/15 text-health border-health/20",
    "upcoming": "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${colors[status] || colors["upcoming"]}`}>
      {status.replace("-", " ")}
    </span>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Realization Summary Header                                         */
/* ------------------------------------------------------------------ */
function RealizationHeader() {
  return (
    <div className="px-6 py-4 border-b border-border">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold">{caseHeader.name}</h2>
            <StatusBadge status="on-track" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Approved {caseHeader.approvedDate} · {caseHeader.timeElapsed} elapsed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-7 px-3 rounded-md bg-muted text-[11px] text-muted-foreground flex items-center gap-1.5 hover:bg-accent transition-colors">
            <Download className="w-3 h-3" />
            Export PDF
          </button>
          <button className="h-7 px-3 rounded-md bg-primary/15 text-[11px] text-primary flex items-center gap-1.5 hover:bg-primary/25 transition-colors">
            <Calendar className="w-3 h-3" />
            Schedule QBR
          </button>
        </div>
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-4 gap-6">
        <div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Committed Value</span>
          <p className="text-2xl font-semibold tabular-nums mt-0.5">{caseHeader.projectedValue}</p>
        </div>
        <div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Realized to Date</span>
          <p className="text-2xl font-semibold tabular-nums text-health mt-0.5">{caseHeader.realizedValue}</p>
        </div>
        <div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Realization Rate</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <p className="text-2xl font-semibold tabular-nums">{caseHeader.realizationPct}%</p>
            <span className="text-[10px] font-mono text-health">on pace</span>
          </div>
        </div>
        <div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Next Milestone</span>
          <p className="text-sm font-medium mt-1">{caseHeader.nextMilestone}</p>
          <p className="text-[10px] text-muted-foreground">{caseHeader.nextMilestoneDate}</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono text-muted-foreground">Overall Realization Progress</span>
          <span className="text-[9px] font-mono text-muted-foreground">{caseHeader.realizationPct}% of committed</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-health" style={{ width: `${caseHeader.realizationPct}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] font-mono text-muted-foreground/60">Approved</span>
          <span className="text-[8px] font-mono text-muted-foreground/60">Target: 12 months</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function RealizationDashboard() {
  const [activeTab, setActiveTab] = useState<"kpis" | "milestones" | "risks" | "expansion">("kpis");

  return (
    <ResponsivePageLayout activeHref="/realization">

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center px-3 md:px-4 shrink-0 gap-2 md:gap-3">
          <Target className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold">Value Realization Dashboard</h1>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-health/10 text-health">3 of 5 KPIs on track</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">Last updated: 2 hours ago</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Realization Summary */}
          <RealizationHeader />

          {/* Tab Navigation */}
          <div className="px-6 pt-4 border-b border-border">
            <div className="flex gap-4">
              {[
                { key: "kpis" as const, label: "KPIs vs Actuals", count: kpis.length },
                { key: "milestones" as const, label: "Milestones", count: milestones.length },
                { key: "risks" as const, label: "Risk Register", count: risks.length },
                { key: "expansion" as const, label: "Expansion Signals", count: expansionSignals.length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-3 text-[11px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "kpis" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {kpis.map((kpi) => (
                  <div key={kpi.id} className="p-4 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">{kpi.name}</h3>
                        <StatusBadge status={kpi.status} />
                      </div>
                      <VarianceIndicator variance={kpi.variance} trend={kpi.trend} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Committed</span>
                        <p className="text-lg font-semibold tabular-nums">
                          {kpi.unit === "$" ? `$${(kpi.committed / 1000000).toFixed(1)}M` : `${kpi.committed}${kpi.unit}`}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Actual</span>
                        <p className={`text-lg font-semibold tabular-nums ${
                          kpi.status === "exceeding" ? "text-health" : kpi.status === "at-risk" ? "text-risk" : "text-foreground"
                        }`}>
                          {kpi.unit === "$" ? `$${(kpi.actual / 1000000).toFixed(1)}M` : `${kpi.actual}${kpi.unit}`}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Progress</span>
                        <div className="mt-1.5">
                          <MiniBar
                            value={kpi.actual}
                            max={kpi.committed}
                            color={kpi.status === "exceeding" ? "bg-health" : kpi.status === "at-risk" ? "bg-risk" : "bg-info"}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{kpi.notes}</p>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === "milestones" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                {milestones.map((ms, i) => (
                  <div key={ms.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-card transition-colors">
                    <div className="flex flex-col items-center w-6">
                      <div className={`w-3 h-3 rounded-full border-2 ${
                        ms.status === "completed" ? "bg-health border-health" : "bg-transparent border-muted-foreground/30"
                      }`}>
                        {ms.status === "completed" && <CheckCircle2 className="w-3 h-3 text-background" />}
                      </div>
                      {i < milestones.length - 1 && (
                        <div className={`w-px h-8 mt-1 ${ms.status === "completed" ? "bg-health/30" : "bg-border"}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{ms.name}</span>
                        <StatusBadge status={ms.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground">Target: {ms.date}</span>
                        {ms.completedDate && (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] font-mono text-health">Completed: {ms.completedDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {ms.status === "upcoming" && (
                      <button className="h-6 px-2 rounded bg-muted text-[10px] text-muted-foreground hover:bg-accent transition-colors">
                        Track
                      </button>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === "risks" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {risks.map((risk) => (
                  <div key={risk.id} className={`p-4 rounded-lg border bg-card ${
                    risk.severity === "high" ? "border-risk/30" : risk.severity === "medium" ? "border-warning/30" : "border-border"
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Flag className={`w-3.5 h-3.5 ${
                          risk.severity === "high" ? "text-risk" : risk.severity === "medium" ? "text-warning" : "text-muted-foreground"
                        }`} />
                        <h3 className="text-sm font-medium">{risk.title}</h3>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        risk.severity === "high" ? "bg-risk/15 text-risk" : risk.severity === "medium" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                      }`}>
                        {risk.severity}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-[11px]">
                      <div>
                        <span className="text-muted-foreground/60 text-[9px] font-mono uppercase">Impact</span>
                        <p className="text-muted-foreground mt-0.5">{risk.impact}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/60 text-[9px] font-mono uppercase">Mitigation</span>
                        <p className="text-muted-foreground mt-0.5">{risk.mitigation}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/60 text-[9px] font-mono uppercase">Owner</span>
                        <p className="text-foreground mt-0.5">{risk.owner}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === "expansion" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-medium text-primary">Expansion Agent</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Based on realization data from this case, the Expansion Agent has identified opportunities
                    linked to prior integrity scores and realization outcomes.
                  </p>
                </div>
                {expansionSignals.map((exp) => (
                  <div key={exp.id} className="p-4 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[10px] font-mono text-health mb-1">Signal: {exp.signal}</p>
                        <h3 className="text-sm font-medium">{exp.recommendation}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-health">{exp.estimatedValue}</p>
                        <p className="text-[9px] font-mono text-muted-foreground">{(exp.confidence * 100).toFixed(0)}% confidence</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button className="h-6 px-2.5 rounded bg-primary/15 text-[10px] text-primary hover:bg-primary/25 transition-colors">
                        Create Value Case
                      </button>
                      <button className="h-6 px-2.5 rounded bg-muted text-[10px] text-muted-foreground hover:bg-accent transition-colors">
                        View Evidence
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </ResponsivePageLayout>
  );
}
