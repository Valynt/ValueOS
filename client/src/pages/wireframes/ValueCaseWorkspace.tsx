/*
 * ValueOS Wireframes — Value Case Workspace
 * Decision dossier with 7-stage Kernel Builder
 * Responsive: Desktop = sidebar + content + evidence panel, Tablet = collapsible sidebar, Mobile = tabbed view
 */
import { motion } from "framer-motion";
import {
  Sparkles, FileText,
  CheckCircle2, Lock, ArrowRight,
  ChevronRight, ExternalLink, AlertTriangle,
  TrendingUp, BookOpen, Microscope,
  Download, FileDown, Share2, Menu, X
} from "lucide-react";
import { useState } from "react";
import { AnnotatedSection, ANNOTATIONS } from "@/components/wireframes/AnnotationOverlay";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  7-Stage Kernel                                                     */
/* ------------------------------------------------------------------ */
const kernelStages = [
  { id: "discovery", label: "Discovery & Intake", status: "complete" as const, icon: "1" },
  { id: "baseline", label: "Baseline & Assumptions", status: "complete" as const, icon: "2" },
  { id: "modeling", label: "Value Modeling", status: "active" as const, icon: "3" },
  { id: "feasibility", label: "Feasibility Scoring", status: "locked" as const, icon: "4" },
  { id: "scenario", label: "Scenario & Sensitivity", status: "locked" as const, icon: "5" },
  { id: "narrative", label: "Narrative & Output", status: "locked" as const, icon: "6" },
  { id: "lifecycle", label: "Lifecycle Monitoring", status: "locked" as const, icon: "7" },
];

/* ------------------------------------------------------------------ */
/*  Assumption Ledger Data                                             */
/* ------------------------------------------------------------------ */
const assumptions = [
  { id: "A1", text: "Current infrastructure costs $1.2M/year in maintenance", status: "validated" as const, confidence: 92, evidence: "Customer P&L statement (Q3 2025), IT budget report", source: "[1]" },
  { id: "A2", text: "Migration will reduce downtime by 60%", status: "validated" as const, confidence: 85, evidence: "Gartner benchmark, Contoso case study", source: "[2][3]" },
  { id: "A3", text: "Team productivity improves 25% post-migration", status: "weak" as const, confidence: 41, evidence: "Single internal survey (n=23)", source: "[4]" },
  { id: "A4", text: "Security incident costs reduced by $180K/year", status: "validated" as const, confidence: 78, evidence: "Industry average (IBM Cost of Breach 2025)", source: "[5]" },
  { id: "A5", text: "Licensing consolidation saves $340K/year", status: "unvalidated" as const, confidence: 0, evidence: "No evidence yet", source: "" },
];

const statusConfig = {
  validated: { color: "text-health", bg: "bg-health/10", border: "border-health/20", label: "Validated" },
  weak: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", label: "Weak" },
  unvalidated: { color: "text-risk", bg: "bg-risk/10", border: "border-risk/20", label: "Unvalidated" },
};

/* ------------------------------------------------------------------ */
/*  Evidence Sources                                                   */
/* ------------------------------------------------------------------ */
const evidenceSources = [
  { id: "1", label: "Customer P&L Statement (Q3 2025)", type: "Financial Document", fresh: true },
  { id: "2", label: "Gartner Cloud Migration Benchmark", type: "Industry Report", fresh: true },
  { id: "3", label: "Contoso Case Study — Cloud ROI", type: "Case Study", fresh: true },
  { id: "4", label: "Internal Productivity Survey", type: "Survey Data", fresh: false },
  { id: "5", label: "IBM Cost of a Data Breach 2025", type: "Industry Report", fresh: true },
  { id: "6", label: "CloudCo SOW — Similar Migration", type: "Statement of Work", fresh: true },
];

/* ------------------------------------------------------------------ */
/*  Mobile Tab View                                                    */
/* ------------------------------------------------------------------ */
type MobileTab = "stages" | "content" | "evidence";

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function ValueCaseWorkspace() {
  const [activeStage, setActiveStage] = useState("modeling");
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("content");

  return (
    <ResponsivePageLayout activeHref="/workspace/acme-cloud">
      {/* Stage Header */}
      <header className="h-12 border-b border-border flex items-center px-3 md:px-5 shrink-0 gap-2 md:gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-mono text-muted-foreground hidden sm:inline">Stage 3 of 7</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground hidden sm:block" />
          <h1 className="text-sm font-semibold truncate">Value Modeling</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setEvidenceOpen(!evidenceOpen); setMobileTab("evidence"); }}
            className={`h-7 px-2.5 rounded-md text-[11px] items-center gap-1.5 transition-colors hidden md:flex ${
              evidenceOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Evidence
          </button>
          <button className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">AI Assist</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-b border-border">
        {(["stages", "content", "evidence"] as MobileTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-[11px] font-medium capitalize transition-colors ${
              mobileTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Kernel Stage Sidebar — Desktop */}
        <AnnotatedSection annotation={ANNOTATIONS.kernelBuilder} position="top-right" className="hidden md:block shrink-0">
          <div className="w-56 border-r border-border flex flex-col h-full">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/10 text-warning">Evidence In Progress</span>
              </div>
              <h2 className="text-sm font-semibold mb-0.5">Acme Corp</h2>
              <p className="text-[11px] text-muted-foreground">Cloud Migration Value Case</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">Projected:</span>
                <span className="text-[12px] font-mono font-semibold">$4.2M</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <div className="px-3 mb-2">
                <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Valynt Kernel</span>
              </div>
              {kernelStages.map((stage) => {
                const isActive = stage.id === activeStage;
                const isComplete = stage.status === "complete";
                const isLocked = stage.status === "locked";
                return (
                  <button key={stage.id} onClick={() => !isLocked && setActiveStage(stage.id)} disabled={isLocked}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                      isActive ? "bg-primary/10 border-r-2 border-primary" : isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono shrink-0 ${
                      isComplete ? "bg-health/15 text-health" : isActive ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                    }`}>
                      {isComplete ? <CheckCircle2 className="w-3 h-3" /> : isLocked ? <Lock className="w-2.5 h-2.5" /> : stage.icon}
                    </div>
                    <span className={`text-[11px] truncate ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stage.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono text-muted-foreground">Case Maturity</span>
                <span className="text-[12px] font-mono font-semibold text-warning">42%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-warning transition-all" style={{ width: "42%" }} />
              </div>
            </div>
          </div>
        </AnnotatedSection>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} className="relative w-64 bg-background border-r border-border flex flex-col h-full">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <span className="text-[11px] font-semibold">Kernel Stages</span>
                <button onClick={() => setSidebarOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-3 border-b border-border">
                <h2 className="text-sm font-semibold mb-0.5">Acme Corp</h2>
                <p className="text-[11px] text-muted-foreground">Cloud Migration Value Case</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">Projected:</span>
                  <span className="text-[12px] font-mono font-semibold">$4.2M</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {kernelStages.map((stage) => {
                  const isActive = stage.id === activeStage;
                  const isComplete = stage.status === "complete";
                  const isLocked = stage.status === "locked";
                  return (
                    <button key={stage.id} onClick={() => { if (!isLocked) { setActiveStage(stage.id); setSidebarOpen(false); setMobileTab("content"); } }} disabled={isLocked}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                        isActive ? "bg-primary/10 border-r-2 border-primary" : isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono shrink-0 ${
                        isComplete ? "bg-health/15 text-health" : isActive ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                      }`}>
                        {isComplete ? <CheckCircle2 className="w-3 h-3" /> : isLocked ? <Lock className="w-2.5 h-2.5" /> : stage.icon}
                      </div>
                      <span className={`text-[11px] truncate ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stage.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        {/* Mobile Stages Tab */}
        <div className={`md:hidden w-full overflow-y-auto ${mobileTab === "stages" ? "block" : "hidden"}`}>
          <div className="p-3 border-b border-border">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/10 text-warning">Evidence In Progress</span>
            <h2 className="text-sm font-semibold mt-1">Acme Corp — Cloud Migration</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">Projected:</span>
              <span className="text-[12px] font-mono font-semibold">$4.2M</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-2">Maturity:</span>
              <span className="text-[12px] font-mono font-semibold text-warning">42%</span>
            </div>
          </div>
          <div className="py-2">
            {kernelStages.map((stage) => {
              const isActive = stage.id === activeStage;
              const isComplete = stage.status === "complete";
              const isLocked = stage.status === "locked";
              return (
                <button key={stage.id} onClick={() => { if (!isLocked) { setActiveStage(stage.id); setMobileTab("content"); } }} disabled={isLocked}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                    isActive ? "bg-primary/10 border-l-2 border-primary" : isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                    isComplete ? "bg-health/15 text-health" : isActive ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                  }`}>
                    {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : isLocked ? <Lock className="w-3 h-3" /> : stage.icon}
                  </div>
                  <span className={`text-[12px] ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stage.label}</span>
                  {isActive && <ArrowRight className="w-3 h-3 text-primary ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content — Assumption Ledger (desktop always, mobile on "content" tab) */}
        <div className={`flex-1 overflow-y-auto p-3 md:p-5 ${mobileTab === "content" ? "block" : "hidden md:block"}`}>
          <AnnotatedSection annotation={ANNOTATIONS.assumptionLedger} position="top-right">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-[13px] font-semibold">Assumption Ledger</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-health/10 text-health">3 validated</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/10 text-warning">1 weak</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-risk/10 text-risk">1 unvalidated</span>
                </div>
              </div>
              <div className="space-y-2">
                {assumptions.map((a, i) => {
                  const cfg = statusConfig[a.status];
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.2 }}
                      className={`p-3 rounded-lg border ${cfg.border} ${cfg.bg} bg-opacity-5`}
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <span className="text-[10px] font-mono text-muted-foreground mt-0.5 shrink-0">{a.id}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium leading-snug mb-1.5">{a.text}</p>
                          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                            {a.confidence > 0 && (
                              <span className="text-[9px] font-mono text-muted-foreground">
                                Confidence: <span className={`font-semibold ${a.confidence >= 70 ? "text-health" : a.confidence >= 40 ? "text-warning" : "text-risk"}`}>{a.confidence}%</span>
                              </span>
                            )}
                            <span className="text-[9px] text-muted-foreground hidden sm:inline">{a.evidence}</span>
                            <span className="text-[9px] font-mono text-primary">{a.source}</span>
                          </div>
                        </div>
                        {a.status === "weak" && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
                        {a.status === "unvalidated" && (
                          <button className="shrink-0 text-[9px] font-mono px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            Find Evidence
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </AnnotatedSection>

          {/* Value Model Summary */}
          <div className="p-4 rounded-lg bg-card border border-border mb-4">
            <h3 className="text-[12px] font-semibold mb-3">Value Model Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Total Projected Value</span>
                <span className="text-xl font-semibold tabular-nums">$4.2M</span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Confidence Range</span>
                <span className="text-sm font-mono">$2.8M — $5.1M</span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Time to Value</span>
                <span className="text-sm font-mono">6 — 9 months</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
              <Microscope className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">3 of 5 assumptions validated · Evidence coverage: 72%</span>
            </div>
          </div>

          {/* Export Controls */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-primary" />
                <h3 className="text-[12px] font-semibold">Export Value Case</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="flex flex-col items-center gap-1.5 p-2 md:p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors">
                <Download className="w-4 h-4 text-primary" />
                <span className="text-[9px] md:text-[10px] font-medium">PDF Report</span>
                <span className="text-[8px] text-muted-foreground hidden sm:block">Executive-ready</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-2 md:p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-[9px] md:text-[10px] font-medium">Slide Deck</span>
                <span className="text-[8px] text-muted-foreground hidden sm:block">PPTX format</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-2 md:p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors">
                <Share2 className="w-4 h-4 text-primary" />
                <span className="text-[9px] md:text-[10px] font-medium">Share Link</span>
                <span className="text-[8px] text-muted-foreground hidden sm:block">View-only URL</span>
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground mt-2 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Exports include full evidence provenance and assumption audit trail
            </p>
          </div>
        </div>

        {/* Evidence Panel — Desktop sidebar */}
        {evidenceOpen && (
          <AnnotatedSection annotation={ANNOTATIONS.evidencePanel} position="top-left" className="hidden md:block w-72 shrink-0">
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="w-72 border-l border-border overflow-y-auto h-full">
              <div className="p-4 border-b border-border">
                <h3 className="text-[12px] font-semibold mb-1">Evidence Sources</h3>
                <p className="text-[10px] text-muted-foreground">6 sources linked · 1 stale</p>
              </div>
              <div className="p-3 space-y-2">
                {evidenceSources.map((src, i) => (
                  <motion.div key={src.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}
                    className="p-2.5 rounded-lg bg-card border border-border hover:border-primary/20 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-mono text-primary shrink-0">[{src.id}]</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium leading-snug mb-1">{src.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-muted-foreground">{src.type}</span>
                          {!src.fresh && <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-warning/10 text-warning">Stale</span>}
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="p-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-mono text-muted-foreground">Evidence Coverage</span>
                  <span className="text-[11px] font-mono font-semibold text-warning">72%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-warning" style={{ width: "72%" }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">1 assumption has no evidence. 1 source is stale.</p>
              </div>
            </motion.div>
          </AnnotatedSection>
        )}

        {/* Mobile Evidence Tab */}
        <div className={`md:hidden w-full overflow-y-auto ${mobileTab === "evidence" ? "block" : "hidden"}`}>
          <div className="p-3 border-b border-border">
            <h3 className="text-[12px] font-semibold mb-1">Evidence Sources</h3>
            <p className="text-[10px] text-muted-foreground">6 sources linked · 1 stale</p>
          </div>
          <div className="p-3 space-y-2">
            {evidenceSources.map((src, i) => (
              <motion.div key={src.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}
                className="p-2.5 rounded-lg bg-card border border-border"
              >
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-primary shrink-0">[{src.id}]</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium leading-snug mb-1">{src.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground">{src.type}</span>
                      {!src.fresh && <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-warning/10 text-warning">Stale</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="p-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-muted-foreground">Evidence Coverage</span>
              <span className="text-[11px] font-mono font-semibold text-warning">72%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-warning" style={{ width: "72%" }} />
            </div>
          </div>
        </div>
      </div>
    </ResponsivePageLayout>
  );
}
