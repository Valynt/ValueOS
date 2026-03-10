/**
 * ValueOS Wireframes — Value Command Center
 * Replaces: Decision Feed
 * Core shift: From "what deals do I have?" to "where is value uncertain, blocked, or ready?"
 * Layout: Responsive — Nav rail (desktop) | Bottom bar (mobile) | Feed + sidebar
 */
import { motion } from "framer-motion";
import {
  Sparkles, Search,
  AlertTriangle, CheckCircle2, Clock, Zap,
  Filter, Command,
  ArrowRight, TrendingUp,
  Activity, GitBranch, RefreshCw, Plus, ExternalLink
} from "lucide-react";
import { useState } from "react";
import { AnnotatedSection, ANNOTATIONS } from "@/components/wireframes/AnnotationOverlay";
import { AutonomyStatusPill } from "@/components/wireframes/AutonomyMode";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  Mock data — Value Cases, not deals                                 */
/* ------------------------------------------------------------------ */
const valueCases = [
  {
    id: "1", type: "evidence-gap" as const, priority: "high",
    title: "Cloud Migration ROI — 3 assumptions unvalidated",
    summary: "The cost-avoidance assumption ($1.2M/yr) relies on a 2023 Gartner benchmark that may be stale. Two customer-specific assumptions lack evidence links entirely.",
    caseName: "Acme Corp — Cloud Migration Value Case",
    projectedValue: "$4.2M", maturity: 42, stage: "Evidence In Progress",
    agent: "The Strategist", timestamp: "12 min ago",
    actions: ["Review Assumptions", "Find Evidence"],
  },
  {
    id: "2", type: "signal" as const, priority: "medium",
    title: "New hypothesis: Globex operational efficiency play",
    summary: "Q4 earnings call mentions 'operational efficiency' 7 times. VP RevOps job posting detected. Combined signals suggest readiness for value conversation around process automation.",
    caseName: "Globex — Hypothesis (New)",
    projectedValue: "TBD", maturity: 12, stage: "Signal Detected",
    agent: "The Scout", timestamp: "34 min ago",
    actions: ["Form Hypothesis", "Assign Domain Pack"],
  },
  {
    id: "3", type: "ready" as const, priority: "high",
    title: "Value case ready for executive review",
    summary: "All 8 assumptions validated. Evidence coverage at 94%. Sensitivity analysis shows value range $1.8M-$3.1M across 4 scenarios. Narrative generated and awaiting CFO approval.",
    caseName: "Initech — Process Automation Value Case",
    projectedValue: "$2.4M", maturity: 88, stage: "Executive Ready",
    agent: "The Strategist", timestamp: "1 hr ago",
    actions: ["Review Narrative", "Submit for Approval"],
  },
  {
    id: "4", type: "drift" as const, priority: "medium",
    title: "Realization variance: Wayne Enterprises drifting +18%",
    summary: "Realized savings are tracking 18% above projected model after 90 days. Time-to-value was 40% faster than baseline. Consider updating the benchmark for future cases.",
    caseName: "Wayne Enterprises — Security Modernization",
    projectedValue: "$6.1M", maturity: 95, stage: "Realization Active",
    agent: "The Clerk", timestamp: "2 hr ago",
    actions: ["View Variance", "Update Benchmark"],
  },
  {
    id: "5", type: "blocked" as const, priority: "high",
    title: "Policy gate: Discount exceeds 22% threshold",
    summary: "The proposed 28% discount on Stark Industries requires VP-level approval per PolicyRule #7. The value case shows strong ROI but the discount precedent needs governance review.",
    caseName: "Stark Industries — AI Platform Value Case",
    projectedValue: "$3.8M", maturity: 65, stage: "Blocked — Policy Gate",
    agent: "The Auditor", timestamp: "3 hr ago",
    actions: ["Review Policy", "Request Override"],
  },
];

const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  "evidence-gap": { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "Evidence Gap" },
  signal: { icon: Zap, color: "text-primary", bg: "bg-primary/10", label: "Signal" },
  ready: { icon: CheckCircle2, color: "text-health", bg: "bg-health/10", label: "Ready" },
  drift: { icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", label: "Drift" },
  blocked: { icon: Clock, color: "text-risk", bg: "bg-risk/10", label: "Blocked" },
};

function MaturityBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-health" : value >= 40 ? "bg-warning" : value < 20 ? "bg-muted-foreground" : "bg-risk";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-mono text-muted-foreground">{value}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Portfolio Summary Bar                                              */
/* ------------------------------------------------------------------ */
function PortfolioSummary() {
  const stats = [
    { label: "Active Cases", value: "24", trend: "+3" },
    { label: "Evidence Coverage", value: "71%", trend: "+4%" },
    { label: "Awaiting Approval", value: "5", trend: null },
    { label: "Realization Drift", value: "2", trend: null, alert: true },
  ];

  return (
    <div className="px-4 py-3 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col">
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{s.label}</span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-lg font-semibold tabular-nums ${s.alert ? "text-risk" : ""}`}>{s.value}</span>
            {s.trend && (
              <span className="text-[10px] font-mono text-health">{s.trend}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ValueLoop Analytics                                                */
/* ------------------------------------------------------------------ */
function ValueLoopAnalytics() {
  const loops = [
    { stage: "Signal → Hypothesis", count: 14, avgDays: 2.1, conversion: "82%", trend: "up" },
    { stage: "Hypothesis → Evidence", count: 11, avgDays: 5.4, conversion: "79%", trend: "up" },
    { stage: "Evidence → Defensible", count: 8, avgDays: 8.2, conversion: "73%", trend: "down" },
    { stage: "Defensible → Exec Ready", count: 6, avgDays: 3.1, conversion: "75%", trend: "up" },
    { stage: "Exec Ready → Approved", count: 4, avgDays: 4.8, conversion: "67%", trend: "flat" },
    { stage: "Approved → Realization", count: 3, avgDays: 12.5, conversion: "100%", trend: "up" },
  ];

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-semibold">ValueLoop Analytics</span>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">Last 30 days</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {loops.map((l) => (
          <div key={l.stage} className="p-2 rounded-md bg-card border border-border">
            <div className="flex items-center gap-1 mb-1">
              <GitBranch className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-[8px] font-mono text-muted-foreground truncate">{l.stage}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] font-semibold tabular-nums">{l.count}</span>
              <span className="text-[9px] font-mono text-muted-foreground">{l.avgDays}d avg</span>
              <span className={`text-[9px] font-mono ml-auto ${
                l.trend === "up" ? "text-health" : l.trend === "down" ? "text-risk" : "text-muted-foreground"
              }`}>{l.conversion}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CRM Integration Panel                                              */
/* ------------------------------------------------------------------ */
function CRMIntegrationPanel() {
  const [expanded, setExpanded] = useState(false);
  const opportunities = [
    { id: "OPP-001", name: "Acme Corp — Cloud Migration", stage: "Negotiation", amount: "$4.2M", owner: "Sarah K." },
    { id: "OPP-002", name: "Acme Corp — Security Upgrade", stage: "Discovery", amount: "$1.1M", owner: "Mike R." },
  ];

  return (
    <div className="mt-3 p-3 rounded-lg bg-card border border-border">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold">CRM Integration</span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">Salesforce</span>
        </div>
        <RefreshCw className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text" placeholder="Search Salesforce opportunities..."
              className="w-full h-7 pl-7 pr-2 rounded-md bg-background border border-border text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            {opportunities.map((opp) => (
              <button key={opp.id} className="w-full text-left px-2.5 py-2 rounded-md bg-background border border-border hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium">{opp.name}</p>
                    <p className="text-[8px] font-mono text-muted-foreground">{opp.id} · {opp.stage} · {opp.owner}</p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold">{opp.amount}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function ValueCommandCenter() {
  const [selectedItem, setSelectedItem] = useState<string | null>("1");
  const [showSidebar, setShowSidebar] = useState(false);
  const selected = valueCases.find(f => f.id === selectedItem);

  const handleSelectItem = (id: string) => {
    setSelectedItem(id);
    setShowSidebar(true);
  };

  return (
    <ResponsivePageLayout activeHref="/command-center">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0 gap-2 md:gap-3">
        <h1 className="text-sm font-semibold truncate">Value Command Center</h1>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-risk/10 text-risk hidden sm:inline">2 blocked</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-health/10 text-health hidden sm:inline">1 ready</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="h-7 px-2.5 rounded-md bg-muted text-[11px] text-muted-foreground flex items-center gap-1.5 hover:bg-accent transition-colors">
            <Filter className="w-3 h-3" />
            <span className="hidden sm:inline">Filter</span>
          </button>
          <button className="h-7 px-2.5 rounded-md bg-muted text-[11px] text-muted-foreground flex items-center gap-1.5 hover:bg-accent transition-colors">
            <Command className="w-3 h-3" />
            K
          </button>
        </div>
      </header>

      {/* Portfolio Summary */}
      <AnnotatedSection annotation={ANNOTATIONS.commandCenter} position="top-right">
        <PortfolioSummary />
      </AnnotatedSection>

      {/* ValueLoop Analytics — hidden on mobile to save space */}
      <div className="hidden md:block">
        <ValueLoopAnalytics />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Feed List */}
        <div className={`w-full md:max-w-xl md:border-r border-border overflow-y-auto ${showSidebar ? 'hidden md:block' : ''}`}>
          {/* Autonomy Mode Status */}
          <AnnotatedSection annotation={ANNOTATIONS.autonomyMode} position="top-right">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Agent Mode:</span>
                <AutonomyStatusPill />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground hidden md:inline">Change in nav rail</span>
            </div>
          </AnnotatedSection>

          {valueCases.map((item, i) => {
            const config = typeConfig[item.type];
            const isSelected = selectedItem === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                onClick={() => handleSelectItem(item.id)}
                className={`px-4 py-3.5 border-b border-border cursor-pointer transition-colors ${isSelected ? 'bg-card' : 'hover:bg-card/40'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-md ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <config.icon className={`w-3 h-3 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-mono uppercase tracking-wider ${config.color}`}>{config.label}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">{item.timestamp}</span>
                    </div>
                    <h3 className="text-[13px] font-medium leading-snug mb-1 truncate">{item.title}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="truncate">{item.caseName}</span>
                      <span className="font-mono shrink-0">{item.projectedValue}</span>
                      <span className="hidden sm:flex"><MaturityBar value={item.maturity} /></span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Context Sidebar — full screen on mobile when visible */}
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={`flex-1 overflow-y-auto ${showSidebar ? 'block' : 'hidden md:block'}`}
          >
            <div className="p-4 md:p-5">
              {/* Mobile back button */}
              <button
                onClick={() => setShowSidebar(false)}
                className="md:hidden flex items-center gap-1.5 text-[11px] text-muted-foreground mb-4 hover:text-foreground transition-colors"
              >
                <ArrowRight className="w-3 h-3 rotate-180" />
                Back to feed
              </button>

              {/* Case Header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {(() => { const cfg = typeConfig[selected.type]; return <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>; })()}
                  <span className="text-[9px] font-mono text-muted-foreground">{selected.stage}</span>
                </div>
                <h2 className="text-base font-semibold mb-1">{selected.title}</h2>
                <p className="text-xs text-muted-foreground">{selected.caseName}</p>
              </div>

              {/* Maturity Ring */}
              <AnnotatedSection annotation={ANNOTATIONS.caseMaturity} position="top-right">
                <div className="flex items-center gap-4 md:gap-6 mb-6 p-4 rounded-lg bg-card border border-border">
                  <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="5"
                        className={selected.maturity >= 75 ? "text-health" : selected.maturity >= 40 ? "text-warning" : "text-risk"}
                        strokeDasharray={`${(selected.maturity / 100) * 213.6} 213.6`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg md:text-xl font-semibold tabular-nums">{selected.maturity}</span>
                      <span className="text-[8px] font-mono text-muted-foreground">maturity</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Projected Value</span>
                      <span className="font-mono font-semibold">{selected.projectedValue}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Stage</span>
                      <span className="font-mono">{selected.stage}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Agent</span>
                      <span className="font-mono">{selected.agent}</span>
                    </div>
                  </div>
                </div>
              </AnnotatedSection>

              {/* Summary */}
              <div className="mb-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Analysis</h3>
                <p className="text-[12px] text-foreground/80 leading-relaxed">{selected.summary}</p>
              </div>

              {/* Actions */}
              <AnnotatedSection annotation={ANNOTATIONS.approvalQueue} position="top-right">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actions</h3>
                  {selected.actions.map((action) => (
                    <button key={action} className="w-full text-left px-3 py-2 rounded-md bg-card border border-border hover:border-primary/30 transition-colors flex items-center justify-between group">
                      <span className="text-[11px] font-medium">{action}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                  <CRMIntegrationPanel />
                </div>
              </AnnotatedSection>

              {/* Agent Attribution */}
              <div className="mt-5 pt-4 border-t border-border flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  Surfaced by <span className="text-foreground font-medium">{selected.agent}</span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </ResponsivePageLayout>
  );
}
