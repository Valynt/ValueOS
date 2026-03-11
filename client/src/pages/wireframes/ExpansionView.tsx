/**
 * ValueOS Wireframes — Expansion Recommendations View
 * Sprint 17 KR2/KR4: Expansion agent linked to lifecycle state
 * Shows expansion opportunities linked to prior integrity scores and realization data
 */
import { motion } from "framer-motion";
import {
  Shield, TrendingUp, Target, Sparkles,
  ArrowRight, CheckCircle2, AlertTriangle,
  BarChart3, Zap, RefreshCw, ChevronRight, Link2,
  Brain, GitBranch
} from "lucide-react";
import { useState } from "react";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const expansionOpportunities = [
  {
    id: "exp-1",
    title: "Extend Process Automation to Supply Chain Workflows",
    sourceCaseName: "Initech — Process Automation Value Case",
    sourceCaseId: "vc-001",
    estimatedValue: "$1.2M",
    confidence: 0.82,
    status: "recommended" as const,
    linkedIntegrityScore: 0.91,
    linkedRealizationSummary: {
      committed: "$2.4M",
      realized: "$1.82M",
      rate: 75.8,
      topKPIs: ["47% cycle time reduction", "72% error rate reduction", "$980K cost avoidance"],
    },
    signals: [
      "Cycle time reduction exceeded target by 17.5%",
      "Process owner requested expansion to 3 adjacent workflows",
      "Q2 budget includes automation line item",
    ],
    hypothesis: "If the same automation framework is applied to supply chain workflows (order processing, inventory reconciliation, vendor payment), the organization can achieve an additional $1.2M in annual savings based on similar process complexity and volume metrics.",
    assumptions: [
      { text: "Supply chain processes have similar complexity to automated workflows", validated: true },
      { text: "Existing automation framework can be extended without major re-architecture", validated: true },
      { text: "Supply chain team has capacity for change management", validated: false },
    ],
  },
  {
    id: "exp-2",
    title: "ML-Based Compliance Validation for Regulated Workflows",
    sourceCaseName: "Initech — Process Automation Value Case",
    sourceCaseId: "vc-001",
    estimatedValue: "$800K",
    confidence: 0.68,
    status: "exploring" as const,
    linkedIntegrityScore: 0.91,
    linkedRealizationSummary: {
      committed: "$2.4M",
      realized: "$1.82M",
      rate: 75.8,
      topKPIs: ["72% error rate reduction", "ML validation exceeding projections"],
    },
    signals: [
      "Error rate reduction outperforming across all regions (72% vs 60% target)",
      "Compliance team expressed interest in ML-based validation",
      "Regulatory audit costs increased 15% YoY",
    ],
    hypothesis: "Applying the ML validation model that drove error rate improvements to compliance-critical workflows could reduce regulatory audit preparation time by 40% and compliance-related rework by 60%.",
    assumptions: [
      { text: "ML model accuracy transfers to compliance domain", validated: false },
      { text: "Compliance team willing to adopt AI-assisted validation", validated: false },
      { text: "Regulatory framework permits ML-assisted compliance checks", validated: true },
    ],
  },
  {
    id: "exp-3",
    title: "Cross-Department Rollout: Finance Operations",
    sourceCaseName: "Globex — Operational Efficiency Value Case",
    sourceCaseId: "vc-003",
    estimatedValue: "$650K",
    confidence: 0.55,
    status: "signal" as const,
    linkedIntegrityScore: 0.74,
    linkedRealizationSummary: {
      committed: "$1.8M",
      realized: "$920K",
      rate: 51.1,
      topKPIs: ["28% process improvement", "6 FTEs reallocated"],
    },
    signals: [
      "Finance VP mentioned manual reconciliation pain in QBR",
      "Similar process patterns detected in finance workflows",
    ],
    hypothesis: "Finance operations reconciliation workflows show similar characteristics to successfully automated operational workflows, suggesting $650K in potential savings.",
    assumptions: [
      { text: "Finance reconciliation processes are automatable", validated: false },
      { text: "Finance team has executive sponsorship for automation", validated: false },
      { text: "Data quality in finance systems is sufficient for automation", validated: false },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */
function ConfidenceRing({ value }: { value: number }) {
  const pct = value * 100;
  const color = pct >= 75 ? "text-health" : pct >= 60 ? "text-warning" : "text-muted-foreground";
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <div className="relative w-8 h-8">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" opacity={0.15} />
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${pct * 0.942} 100`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-semibold">{pct.toFixed(0)}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    recommended: "bg-health/15 text-health border-health/20",
    exploring: "bg-primary/15 text-primary border-primary/20",
    signal: "bg-warning/15 text-warning border-warning/20",
  };
  return (
    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${styles[status] || "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function ExpansionView() {
  const [selectedId, setSelectedId] = useState<string>("exp-1");
  const selected = expansionOpportunities.find(e => e.id === selectedId);

  return (
    <ResponsivePageLayout activeHref="/expansion">
      {/* List Panel */}
      <div className="w-full md:w-96 md:border-r border-border flex flex-col shrink-0">
        <header className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0">
          <Zap className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold">Expansion Opportunities</h1>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{expansionOpportunities.length}</span>
        </header>

        {/* Agent context banner */}
        <div className="px-3 py-2 border-b border-border bg-primary/5">
          <div className="flex items-center gap-1.5">
            <Brain className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-medium text-primary">Expansion Agent</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Recommendations generated from realization data and cross-case patterns.
          </p>
        </div>

        {/* Opportunity list */}
        <div className="flex-1 overflow-y-auto">
          {expansionOpportunities.map((opp) => (
            <button
              key={opp.id}
              onClick={() => setSelectedId(opp.id)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                selectedId === opp.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <StatusPill status={opp.status} />
                <span className="text-sm font-semibold text-health">{opp.estimatedValue}</span>
              </div>
              <h3 className="text-[11px] font-medium mt-1 line-clamp-2">{opp.title}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Link2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground truncate">{opp.sourceCaseName}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">Confidence: {(opp.confidence * 100).toFixed(0)}%</span>
                <span className="text-[9px] font-mono text-muted-foreground">Integrity: {(opp.linkedIntegrityScore * 100).toFixed(0)}%</span>
              </div>
            </button>
          ))}
        </div>

        {/* Run agent button */}
        <div className="p-3 border-t border-border">
          <button className="w-full h-8 rounded-md bg-primary/15 text-[11px] text-primary flex items-center justify-center gap-1.5 hover:bg-primary/25 transition-colors">
            <RefreshCw className="w-3 h-3" />
            Run Expansion Agent
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={selected.status} />
                <ConfidenceRing value={selected.confidence} />
              </div>
              <h2 className="text-lg font-semibold mb-1">{selected.title}</h2>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Link2 className="w-3 h-3" />
                <span>Source: {selected.sourceCaseName}</span>
              </div>
            </div>

            {/* Linked Realization Summary */}
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-[11px] font-medium">Linked Realization Data</h3>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-health/10 text-health">
                  Integrity: {(selected.linkedIntegrityScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase">Committed</span>
                  <p className="text-sm font-semibold tabular-nums">{selected.linkedRealizationSummary.committed}</p>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase">Realized</span>
                  <p className="text-sm font-semibold tabular-nums text-health">{selected.linkedRealizationSummary.realized}</p>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase">Rate</span>
                  <p className="text-sm font-semibold tabular-nums">{selected.linkedRealizationSummary.rate}%</p>
                </div>
              </div>
              <div>
                <span className="text-[9px] font-mono text-muted-foreground uppercase">Top Realized KPIs</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selected.linkedRealizationSummary.topKPIs.map((kpi) => (
                    <span key={kpi} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-health/10 text-health">{kpi}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Signals */}
            <div>
              <h3 className="text-[11px] font-medium mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Detected Signals
              </h3>
              <div className="space-y-1.5">
                {selected.signals.map((signal, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/10">
                    <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                    <span className="text-[11px] text-foreground">{signal}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hypothesis */}
            <div>
              <h3 className="text-[11px] font-medium mb-2">Generated Hypothesis</h3>
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-[11px] text-foreground leading-relaxed">{selected.hypothesis}</p>
              </div>
            </div>

            {/* Assumptions */}
            <div>
              <h3 className="text-[11px] font-medium mb-2">Assumptions to Validate</h3>
              <div className="space-y-1.5">
                {selected.assumptions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-md border border-border">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      a.validated ? "bg-health/15 text-health" : "bg-warning/15 text-warning"
                    }`}>
                      {a.validated ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    </div>
                    <span className="text-[11px] flex-1">{a.text}</span>
                    <span className={`text-[9px] font-mono ${a.validated ? "text-health" : "text-warning"}`}>
                      {a.validated ? "validated" : "unvalidated"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
                <Sparkles className="w-3 h-3" />
                Create Value Case
              </button>
              <button className="h-8 px-4 rounded-md bg-muted text-[11px] text-foreground flex items-center gap-1.5 hover:bg-accent transition-colors">
                <BarChart3 className="w-3 h-3" />
                View Source Case
              </button>
            </div>
          </div>
        </div>
      )}
    </ResponsivePageLayout>
  );
}
