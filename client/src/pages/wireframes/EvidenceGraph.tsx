/*
 * ValueOS Wireframes — Evidence Graph
 * Replaces: Stakeholder Map
 * Core shift: From contacts to proof lineage — graph-native evidence provenance
 * Sprint 15: Evidence Tier Badges + Confidence Breakdown
 * Sprint 16: Provenance Drawer (per-node lineage chain)
 * Layout: Nav rail | Graph visualization (center) | Source detail (right)
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, AlertTriangle, Clock, Search,
  BookOpen, Database, BarChart3, FileCheck,
  Globe, Users, Microscope, ArrowRight, FileText,
  ChevronRight, X, GitBranch, Shield, Bot, Calculator
} from "lucide-react";
import { useState } from "react";
import { AnnotatedSection, ANNOTATIONS } from "@/components/wireframes/AnnotationOverlay";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  Evidence Tier Definitions                                          */
/* ------------------------------------------------------------------ */
const tierConfig = {
  1: { label: "Tier 1", description: "Primary source — direct customer data or verified financials", color: "text-health", bg: "bg-health/15", border: "border-health/20" },
  2: { label: "Tier 2", description: "Validated secondary — analyst reports, peer benchmarks, case studies", color: "text-primary", bg: "bg-primary/15", border: "border-primary/20" },
  3: { label: "Tier 3", description: "Unvalidated — estimates, vendor claims, outdated sources", color: "text-warning", bg: "bg-warning/15", border: "border-warning/20" },
};

/* ------------------------------------------------------------------ */
/*  Evidence Nodes                                                     */
/* ------------------------------------------------------------------ */
interface EvidenceNode {
  id: string;
  label: string;
  type: "benchmark" | "customer-data" | "case-study" | "analyst-report" | "vendor-doc" | "reference";
  tier: 1 | 2 | 3;
  source: string;
  date: string;
  fresh: boolean;
  confidence: number;
  confidenceBreakdown: { sourceReliability: number; recency: number; corroboration: number };
  linkedAssumptions: string[];
  linkedCases: string[];
  provenance: { step: string; detail: string; agent?: string; timestamp: string }[];
}

const evidenceNodes: EvidenceNode[] = [
  {
    id: "E1", label: "Acme Corp P&L Statement", type: "customer-data", tier: 1,
    source: "Acme Finance Team", date: "Q3 2025", fresh: true, confidence: 95,
    confidenceBreakdown: { sourceReliability: 98, recency: 95, corroboration: 92 },
    linkedAssumptions: ["A1"], linkedCases: ["Cloud Migration ROI"],
    provenance: [
      { step: "Ingested", detail: "PDF uploaded by Sarah Chen (AE)", timestamp: "2025-09-15 14:22" },
      { step: "Extracted", detail: "Financial data extracted by Document Agent", agent: "Document Agent", timestamp: "2025-09-15 14:23" },
      { step: "Validated", detail: "Cross-referenced with SEC 10-K filing (match: 99.2%)", agent: "Validation Agent", timestamp: "2025-09-15 14:25" },
      { step: "Classified", detail: "Tier 1 — primary customer financial data", agent: "Evidence Agent", timestamp: "2025-09-15 14:25" },
      { step: "Linked", detail: "Connected to assumption A1 (Infrastructure costs $1.2M/yr)", agent: "Evidence Agent", timestamp: "2025-09-15 14:26" },
    ],
  },
  {
    id: "E2", label: "Gartner Cloud Migration Benchmark 2024", type: "benchmark", tier: 2,
    source: "Gartner", date: "Nov 2024", fresh: true, confidence: 88,
    confidenceBreakdown: { sourceReliability: 95, recency: 82, corroboration: 87 },
    linkedAssumptions: ["A2"], linkedCases: ["Cloud Migration ROI", "Data Platform Migration"],
    provenance: [
      { step: "Discovered", detail: "Found via Research Agent industry scan", agent: "Research Agent", timestamp: "2025-08-20 09:15" },
      { step: "Ingested", detail: "Report PDF downloaded from Gartner portal", timestamp: "2025-08-20 09:16" },
      { step: "Extracted", detail: "Key metrics: downtime reduction benchmarks (n=342 enterprises)", agent: "Document Agent", timestamp: "2025-08-20 09:18" },
      { step: "Classified", detail: "Tier 2 — validated analyst benchmark with large sample", agent: "Evidence Agent", timestamp: "2025-08-20 09:19" },
    ],
  },
  {
    id: "E3", label: "Contoso Migration Case Study", type: "case-study", tier: 2,
    source: "Internal Library", date: "Jun 2024", fresh: true, confidence: 82,
    confidenceBreakdown: { sourceReliability: 80, recency: 78, corroboration: 88 },
    linkedAssumptions: ["A2"], linkedCases: ["Cloud Migration ROI"],
    provenance: [
      { step: "Ingested", detail: "Imported from internal case study library", timestamp: "2025-07-10 11:00" },
      { step: "Extracted", detail: "Outcome metrics: 58% downtime reduction, 9-month timeline", agent: "Document Agent", timestamp: "2025-07-10 11:02" },
      { step: "Classified", detail: "Tier 2 — internal case study with verified outcomes", agent: "Evidence Agent", timestamp: "2025-07-10 11:03" },
    ],
  },
  {
    id: "E4", label: "Forrester Productivity Report", type: "analyst-report", tier: 3,
    source: "Forrester", date: "Mar 2022", fresh: false, confidence: 41,
    confidenceBreakdown: { sourceReliability: 85, recency: 18, corroboration: 20 },
    linkedAssumptions: ["A3"], linkedCases: ["Cloud Migration ROI"],
    provenance: [
      { step: "Ingested", detail: "Uploaded by Mark Torres (SE)", timestamp: "2025-06-05 16:30" },
      { step: "Extracted", detail: "Productivity gain claim: 25% (n=89 enterprises)", agent: "Document Agent", timestamp: "2025-06-05 16:31" },
      { step: "Flagged", detail: "Report is 3+ years old — recency score degraded", agent: "Validation Agent", timestamp: "2025-06-05 16:32" },
      { step: "Classified", detail: "Tier 3 — outdated, uncorroborated by recent data", agent: "Evidence Agent", timestamp: "2025-06-05 16:32" },
      { step: "Red Team Alert", detail: "Red Team flagged: industry benchmarks now show 15-18%, not 25%", agent: "Red Team Agent", timestamp: "2025-09-20 10:15" },
    ],
  },
  {
    id: "E5", label: "CloudCo Implementation SOW", type: "vendor-doc", tier: 2,
    source: "CloudCo", date: "Jan 2025", fresh: true, confidence: 90,
    confidenceBreakdown: { sourceReliability: 88, recency: 95, corroboration: 87 },
    linkedAssumptions: ["A5"], linkedCases: ["Cloud Migration ROI"],
    provenance: [
      { step: "Ingested", detail: "SOW document uploaded by procurement", timestamp: "2025-01-22 10:00" },
      { step: "Extracted", detail: "Timeline: 6 months, cost: $480K implementation", agent: "Document Agent", timestamp: "2025-01-22 10:02" },
      { step: "Validated", detail: "Timeline cross-referenced with 3 similar CloudCo implementations", agent: "Validation Agent", timestamp: "2025-01-22 10:05" },
      { step: "Classified", detail: "Tier 2 — vendor document validated against reference data", agent: "Evidence Agent", timestamp: "2025-01-22 10:06" },
    ],
  },
  {
    id: "E6", label: "Northwind Traders Timeline", type: "reference", tier: 2,
    source: "Reference Customer", date: "Aug 2024", fresh: true, confidence: 78,
    confidenceBreakdown: { sourceReliability: 82, recency: 75, corroboration: 77 },
    linkedAssumptions: ["A5"], linkedCases: ["Cloud Migration ROI", "Supply Chain Optimization"],
    provenance: [
      { step: "Ingested", detail: "Reference call notes transcribed", timestamp: "2024-08-15 14:00" },
      { step: "Extracted", detail: "Implementation: 7 months (1 month over estimate)", agent: "Document Agent", timestamp: "2024-08-15 14:05" },
      { step: "Classified", detail: "Tier 2 — reference customer with verified outcomes", agent: "Evidence Agent", timestamp: "2024-08-15 14:06" },
    ],
  },
  {
    id: "E7", label: "McKinsey Digital Transformation Index", type: "benchmark", tier: 1,
    source: "McKinsey", date: "Sep 2025", fresh: true, confidence: 91,
    confidenceBreakdown: { sourceReliability: 96, recency: 92, corroboration: 85 },
    linkedAssumptions: [], linkedCases: ["Platform Consolidation", "Security Modernization"],
    provenance: [
      { step: "Discovered", detail: "Auto-discovered via Research Agent industry scan", agent: "Research Agent", timestamp: "2025-09-28 08:00" },
      { step: "Ingested", detail: "Report downloaded from McKinsey Insights", timestamp: "2025-09-28 08:01" },
      { step: "Classified", detail: "Tier 1 — premier analyst with large sample (n=1200)", agent: "Evidence Agent", timestamp: "2025-09-28 08:03" },
    ],
  },
  {
    id: "E8", label: "Wayne Enterprises 90-Day Review", type: "customer-data", tier: 1,
    source: "Wayne Enterprises", date: "Feb 2026", fresh: true, confidence: 96,
    confidenceBreakdown: { sourceReliability: 98, recency: 98, corroboration: 92 },
    linkedAssumptions: [], linkedCases: ["Security Modernization"],
    provenance: [
      { step: "Ingested", detail: "QBR deck uploaded by CS team", timestamp: "2026-02-10 09:00" },
      { step: "Extracted", detail: "Realized value: $1.82M (75.8% of committed $2.4M)", agent: "Document Agent", timestamp: "2026-02-10 09:02" },
      { step: "Validated", detail: "KPIs cross-referenced with CRM opportunity data", agent: "Validation Agent", timestamp: "2026-02-10 09:05" },
      { step: "Classified", detail: "Tier 1 — primary customer data with verified realization", agent: "Evidence Agent", timestamp: "2026-02-10 09:06" },
    ],
  },
];

const typeConfig = {
  "benchmark": { icon: BarChart3, color: "text-primary", bg: "bg-primary/10", label: "Benchmark" },
  "customer-data": { icon: Database, color: "text-health", bg: "bg-health/10", label: "Customer Data" },
  "case-study": { icon: BookOpen, color: "text-violet-400", bg: "bg-violet-500/10", label: "Case Study" },
  "analyst-report": { icon: FileCheck, color: "text-amber-400", bg: "bg-amber-500/10", label: "Analyst Report" },
  "vendor-doc": { icon: FileText, color: "text-sky-400", bg: "bg-sky-500/10", label: "Vendor Document" },
  "reference": { icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Reference" },
};

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  Graph Visualization (Simplified SVG)                               */
/* ------------------------------------------------------------------ */
function GraphView({ nodes, selectedId, onSelect }: { nodes: EvidenceNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const positions: Record<string, { x: number; y: number }> = {
    E1: { x: 120, y: 100 }, E2: { x: 320, y: 80 }, E3: { x: 320, y: 200 },
    E4: { x: 520, y: 140 }, E5: { x: 140, y: 280 }, E6: { x: 340, y: 340 },
    E7: { x: 540, y: 280 }, E8: { x: 540, y: 400 },
  };

  const edges = [
    { from: "E1", to: "E2" }, { from: "E2", to: "E3" }, { from: "E2", to: "E4" },
    { from: "E5", to: "E6" }, { from: "E2", to: "E7" }, { from: "E7", to: "E8" },
    { from: "E3", to: "E6" },
  ];

  return (
    <svg className="w-full h-full" viewBox="0 0 680 480">
      {edges.map((edge, i) => {
        const from = positions[edge.from]; const to = positions[edge.to];
        if (!from || !to) return null;
        return (
          <motion.line key={i} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.2 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeWidth="1" className="text-border" />
        );
      })}
      {nodes.map((node, i) => {
        const pos = positions[node.id]; if (!pos) return null;
        const isSelected = selectedId === node.id;
        const isStale = !node.fresh;
        const tierColor = node.tier === 1 ? "text-health" : node.tier === 2 ? "text-primary" : "text-warning";

        return (
          <motion.g key={node.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.3 }} onClick={() => onSelect(node.id)} className="cursor-pointer">
            {isSelected && <circle cx={pos.x} cy={pos.y} r="28" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" opacity="0.4" />}
            {isStale && <circle cx={pos.x} cy={pos.y} r="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" className="text-warning" opacity="0.6" />}
            <circle cx={pos.x} cy={pos.y} r="22" fill="currentColor" className={isSelected ? "text-primary/20" : "text-card"} stroke="currentColor" strokeWidth="1" />
            <circle cx={pos.x} cy={pos.y} r="22" fill="none" stroke="currentColor" strokeWidth="2"
              className={node.confidence >= 75 ? "text-health" : node.confidence >= 40 ? "text-warning" : "text-risk"}
              strokeDasharray={`${(node.confidence / 100) * 138.2} 138.2`}
              transform={`rotate(-90 ${pos.x} ${pos.y})`} strokeLinecap="round" />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[10px] font-mono font-semibold">{node.id}</text>
            {/* Tier badge */}
            <rect x={pos.x + 14} y={pos.y - 26} width="16" height="12" rx="3" fill="currentColor" className={tierColor.replace("text-", "text-") + "/20"} />
            <text x={pos.x + 22} y={pos.y - 18} textAnchor="middle" dominantBaseline="middle" className={`fill-current ${tierColor} text-[7px] font-mono font-bold`}>T{node.tier}</text>
            <text x={pos.x} y={pos.y + 38} textAnchor="middle" className="fill-muted-foreground text-[8px]">
              {node.label.length > 28 ? node.label.slice(0, 28) + "..." : node.label}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Provenance Drawer                                                  */
/* ------------------------------------------------------------------ */
function ProvenanceDrawer({ node, onClose }: { node: EvidenceNode; onClose: () => void }) {
  const cfg = typeConfig[node.type];
  const tier = tierConfig[node.tier];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed top-0 right-0 h-full w-full sm:w-[440px] bg-card border-l border-border z-50 shadow-2xl overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center gap-3 z-10">
        <GitBranch className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Provenance Chain</h3>
        <button onClick={onClose} className="ml-auto w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Source Identity */}
        <div className="p-3 rounded-lg border border-border bg-background">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 rounded-md ${cfg.bg} flex items-center justify-center`}>
              <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
            </div>
            <div>
              <p className="text-[12px] font-semibold">{node.label}</p>
              <p className="text-[10px] text-muted-foreground">{node.source} · {node.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${tier.bg} ${tier.color} ${tier.border} border`}>{tier.label}</span>
            <span className="text-[9px] text-muted-foreground">{tier.description}</span>
          </div>
        </div>

        {/* 3-Component Confidence Breakdown */}
        <div>
          <h4 className="text-[11px] font-medium mb-2 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-primary" />
            Confidence Breakdown
          </h4>
          <div className="p-3 rounded-lg border border-border bg-background space-y-3">
            {[
              { label: "Source Reliability", value: node.confidenceBreakdown.sourceReliability, weight: "40%", desc: "Authority and track record of the source" },
              { label: "Recency", value: node.confidenceBreakdown.recency, weight: "35%", desc: "How current the data is relative to decision date" },
              { label: "Corroboration", value: node.confidenceBreakdown.corroboration, weight: "25%", desc: "Number of independent sources confirming this data" },
            ].map((comp) => (
              <div key={comp.label}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-[10px] font-medium">{comp.label}</span>
                    <span className="text-[8px] font-mono text-muted-foreground ml-1.5">({comp.weight})</span>
                  </div>
                  <span className={`text-[10px] font-mono font-semibold ${
                    comp.value >= 75 ? "text-health" : comp.value >= 50 ? "text-warning" : "text-risk"
                  }`}>{comp.value}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${comp.value}%` }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className={`h-full rounded-full ${
                      comp.value >= 75 ? "bg-health" : comp.value >= 50 ? "bg-warning" : "bg-risk"
                    }`}
                  />
                </div>
                <p className="text-[8px] text-muted-foreground mt-0.5">{comp.desc}</p>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-[10px] font-semibold">Weighted Composite</span>
              <span className={`text-[12px] font-mono font-bold ${
                node.confidence >= 75 ? "text-health" : node.confidence >= 50 ? "text-warning" : "text-risk"
              }`}>{node.confidence}%</span>
            </div>
            <p className="text-[8px] text-muted-foreground">
              Formula: (Source × 0.40) + (Recency × 0.35) + (Corroboration × 0.25)
            </p>
          </div>
        </div>

        {/* Provenance Timeline */}
        <div>
          <h4 className="text-[11px] font-medium mb-3 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-primary" />
            Lineage Chain
          </h4>
          <div className="relative pl-5">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            {node.provenance.map((step, i) => {
              const isLast = i === node.provenance.length - 1;
              const isAlert = step.step === "Flagged" || step.step === "Red Team Alert";
              return (
                <div key={i} className="relative mb-4 last:mb-0">
                  {/* Dot */}
                  <div className={`absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                    isAlert ? "bg-risk/20 border-risk" :
                    isLast ? "bg-primary/20 border-primary" :
                    "bg-health/20 border-health"
                  }`} />

                  <div className={`p-2.5 rounded-lg border ${
                    isAlert ? "border-risk/20 bg-risk/5" : "border-border bg-background"
                  }`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] font-mono font-semibold uppercase tracking-wider ${
                        isAlert ? "text-risk" : "text-foreground"
                      }`}>{step.step}</span>
                      <span className="text-[8px] font-mono text-muted-foreground ml-auto">{step.timestamp}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{step.detail}</p>
                    {step.agent && (
                      <div className="flex items-center gap-1 mt-1">
                        <Bot className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[9px] font-mono text-primary">{step.agent}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function EvidenceGraph() {
  const [selectedId, setSelectedId] = useState<string | null>("E2");
  const [showProvenance, setShowProvenance] = useState(false);
  const selected = evidenceNodes.find(n => n.id === selectedId);

  return (
    <ResponsivePageLayout activeHref="/evidence">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center px-3 md:px-5 shrink-0 gap-2 md:gap-3">
          <h1 className="text-sm font-semibold">Evidence Graph</h1>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">8 sources · 1 stale</span>

          {/* Tier legend */}
          <div className="hidden sm:flex items-center gap-2 ml-3">
            {([1, 2, 3] as const).map((t) => {
              const tc = tierConfig[t];
              return (
                <span key={t} className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${tc.bg} ${tc.color} border ${tc.border}`}>
                  {tc.label}
                </span>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="h-7 px-2.5 rounded-md bg-muted text-[11px] text-muted-foreground flex items-center gap-1.5 hover:bg-accent transition-colors">
              <Search className="w-3 h-3" />
              Search Sources
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Graph Area */}
          <AnnotatedSection annotation={ANNOTATIONS.evidenceGraph} position="top-left" className="flex-1">
          <div className="flex-1 overflow-hidden p-4">
            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 px-2">
              {Object.entries(typeConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${cfg.bg} border ${cfg.color.replace("text-", "border-")}`} />
                  <span className="text-[8px] font-mono text-muted-foreground">{cfg.label}</span>
                </div>
              ))}
            </div>

            {/* Graph */}
            <div className="w-full h-[calc(100%-2rem)] rounded-lg bg-card/30 border border-border">
              <GraphView nodes={evidenceNodes} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
          </AnnotatedSection>

          {/* Source Detail Panel */}
          {selected && (
            <AnnotatedSection annotation={ANNOTATIONS.benchmarkLineage} position="top-left" className="hidden md:block w-80 shrink-0">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-80 border-l border-border overflow-y-auto"
            >
              <div className="p-5">
                {/* Source Header */}
                <div className="mb-4">
                  {(() => {
                    const cfg = typeConfig[selected.type];
                    const Icon = cfg.icon;
                    const tier = tierConfig[selected.tier];
                    return (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-6 h-6 rounded-md ${cfg.bg} flex items-center justify-center`}>
                            <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                          </div>
                          <span className={`text-[9px] font-mono uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                          {!selected.fresh && (
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">Stale</span>
                          )}
                        </div>
                        {/* Tier Badge */}
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${tier.bg} border ${tier.border} mb-2`}>
                          <Shield className={`w-3 h-3 ${tier.color}`} />
                          <span className={`text-[9px] font-mono font-semibold ${tier.color}`}>{tier.label}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <h2 className="text-[14px] font-semibold mb-1">{selected.label}</h2>
                  <p className="text-[11px] text-muted-foreground">{selected.source}</p>
                </div>

                {/* Metadata */}
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-mono">{selected.date}</span>
                  </div>

                  {/* 3-Component Confidence */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className={`font-mono font-semibold ${
                        selected.confidence >= 75 ? "text-health" : selected.confidence >= 40 ? "text-warning" : "text-risk"
                      }`}>{selected.confidence}%</span>
                    </div>
                    <div className="space-y-1">
                      {[
                        { label: "Source", value: selected.confidenceBreakdown.sourceReliability },
                        { label: "Recency", value: selected.confidenceBreakdown.recency },
                        { label: "Corroboration", value: selected.confidenceBreakdown.corroboration },
                      ].map((c) => (
                        <div key={c.label} className="flex items-center gap-2">
                          <span className="text-[8px] font-mono text-muted-foreground w-16">{c.label}</span>
                          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${c.value >= 75 ? "bg-health" : c.value >= 50 ? "bg-warning" : "bg-risk"}`}
                              style={{ width: `${c.value}%` }} />
                          </div>
                          <span className="text-[8px] font-mono w-6 text-right">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Freshness</span>
                    <span className={`font-mono ${selected.fresh ? "text-health" : "text-warning"}`}>
                      {selected.fresh ? "Current" : "Stale — needs refresh"}
                    </span>
                  </div>
                </div>

                {/* Linked Assumptions */}
                {selected.linkedAssumptions.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Linked Assumptions</h3>
                    <div className="space-y-1.5">
                      {selected.linkedAssumptions.map((a) => (
                        <div key={a} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card border border-border">
                          <span className="text-[10px] font-mono text-primary">{a}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-foreground/70">Validates this assumption</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Cases */}
                <div className="mb-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Used In Cases</h3>
                  <div className="space-y-1.5">
                    {selected.linkedCases.map((c) => (
                      <div key={c} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card border border-border hover:border-primary/20 transition-colors cursor-pointer">
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium">{c}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <button
                    onClick={() => setShowProvenance(true)}
                    className="w-full text-left px-3 py-2 rounded-md bg-primary/10 border border-primary/20 hover:border-primary/40 transition-colors flex items-center justify-between group text-[11px] text-primary"
                  >
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-3 h-3" />
                      View Provenance Chain
                    </span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-md bg-card border border-border hover:border-primary/30 transition-colors flex items-center justify-between group text-[11px]">
                    <span>View Full Source</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                  {!selected.fresh && (
                    <button className="w-full text-left px-3 py-2 rounded-md bg-warning/10 border border-warning/20 hover:border-warning/40 transition-colors flex items-center justify-between group text-[11px] text-warning">
                      <span>Find Updated Version</span>
                      <Microscope className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
            </AnnotatedSection>
          )}
        </div>
      </div>

      {/* Provenance Drawer */}
      <AnimatePresence>
        {showProvenance && selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowProvenance(false)}
            />
            <ProvenanceDrawer node={selected} onClose={() => setShowProvenance(false)} />
          </>
        )}
      </AnimatePresence>
    </ResponsivePageLayout>
  );
}
