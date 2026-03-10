/**
 * ValueOS Wireframes — Decision Canvas
 * Evolves: Business Case Generator
 * Core shift: Explicitly about defensible value narrative with observable reasoning
 * Layout: Nav rail | Conversation panel (left) | Live Canvas (right)
 * Sprint 15: Red Team Panel, Sprint 17: Cross-Case Learning, Sprint 18: Export Controls
 * Responsive: Conversation collapses to tab on tablet, full-screen tabs on mobile
 */
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Sparkles, Settings, FileText,
  Send, Home, Layers, Scale, FlaskConical,
  CheckCircle2, Circle, Loader2, BarChart3,
  Table, FileOutput, AlertTriangle, BookOpen,
  RefreshCw, ThumbsUp, ThumbsDown, Pencil,
  Shield, Swords, Brain, Download, Eye,
  ChevronRight, X, GitBranch, MessageSquare, PanelLeft
} from "lucide-react";
import { useState } from "react";
import { AnnotatedSection, ANNOTATIONS } from "@/components/wireframes/AnnotationOverlay";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";

/* ------------------------------------------------------------------ */
/*  Thinking Steps                                                     */
/* ------------------------------------------------------------------ */
const thinkingSteps = [
  { id: 1, label: "Gathering evidence from 6 linked sources", status: "complete" as const, duration: "1.2s" },
  { id: 2, label: "Validating 5 assumptions against evidence", status: "complete" as const, duration: "2.8s" },
  { id: 3, label: "Running value model with validated inputs", status: "complete" as const, duration: "0.9s" },
  { id: 4, label: "Generating sensitivity analysis (4 scenarios)", status: "complete" as const, duration: "3.1s" },
  { id: 5, label: "Red Team adversarial review", status: "active" as const, duration: "..." },
  { id: 6, label: "Composing executive narrative", status: "pending" as const, duration: "" },
];

/* ------------------------------------------------------------------ */
/*  Canvas Blocks                                                      */
/* ------------------------------------------------------------------ */
const canvasBlocks = [
  {
    id: "value-summary",
    type: "metric" as const,
    title: "Value Summary",
    content: {
      metrics: [
        { label: "Total Projected Value", value: "$4.2M", subtext: "over 3 years" },
        { label: "Year 1 Impact", value: "$1.4M", subtext: "cost avoidance + productivity" },
        { label: "Payback Period", value: "8 months", subtext: "from implementation start" },
        { label: "Confidence", value: "72%", subtext: "3/5 assumptions validated" },
      ],
    },
    status: "final" as string,
  },
  {
    id: "assumption-table",
    type: "table" as const,
    title: "Assumption Validation Matrix",
    content: {
      headers: ["ID", "Assumption", "Status", "Confidence", "Evidence"],
      rows: [
        ["A1", "Infrastructure costs $1.2M/yr", "Validated", "92%", "[1]"],
        ["A2", "60% downtime reduction", "Validated", "78%", "[2][3]"],
        ["A3", "25% productivity gain", "Weak", "41%", "[4]"],
        ["A4", "Security savings $180K/yr", "Unvalidated", "—", "—"],
        ["A5", "6-month implementation", "Validated", "85%", "[5][6]"],
      ],
    },
    status: "final" as string,
  },
  {
    id: "sensitivity",
    type: "chart" as const,
    title: "Sensitivity Analysis",
    content: {
      scenarios: [
        { name: "Conservative", value: "$2.8M", probability: "25%" },
        { name: "Base Case", value: "$4.2M", probability: "45%" },
        { name: "Optimistic", value: "$5.1M", probability: "20%" },
        { name: "Aggressive", value: "$6.3M", probability: "10%" },
      ],
    },
    status: "final" as string,
  },
];

/* ------------------------------------------------------------------ */
/*  Red Team Challenges                                                */
/* ------------------------------------------------------------------ */
const redTeamChallenges = [
  {
    id: "rt-1",
    severity: "high" as const,
    title: "Productivity gain assumption lacks recent evidence",
    detail: "A3 (25% productivity gain) cites a 2022 Gartner report. Industry benchmarks from 2025 show cloud migration productivity gains averaging 15-18%, not 25%. This assumption may be overstated by 30-40%.",
    impact: "If adjusted to 18%, total value drops from $4.2M to $3.6M — still positive but materially different.",
    recommendation: "Request customer-specific productivity data or reduce to industry median (18%).",
    status: "unresolved" as const,
  },
  {
    id: "rt-2",
    severity: "medium" as const,
    title: "Implementation timeline assumes no regulatory review",
    detail: "A5 (6-month implementation) does not account for Acme Corp's SOC 2 compliance requirements. Similar enterprises in regulated industries averaged 8.5 months.",
    impact: "Extended timeline delays payback period from 8 to 10.5 months and increases implementation cost by ~$120K.",
    recommendation: "Add a compliance review phase to the timeline and adjust cost model accordingly.",
    status: "unresolved" as const,
  },
  {
    id: "rt-3",
    severity: "low" as const,
    title: "Security savings estimate is unvalidated",
    detail: "A4 ($180K/yr security savings) has no supporting evidence. However, this represents only 4.3% of total value and does not materially affect the business case.",
    impact: "Removing A4 entirely reduces total value by $540K (3yr) — case remains strongly positive.",
    recommendation: "Flag as 'projected' in the narrative rather than 'committed'. Seek validation in Phase 2.",
    status: "accepted" as const,
  },
];

/* ------------------------------------------------------------------ */
/*  Cross-Case Patterns (Sprint 17)                                    */
/* ------------------------------------------------------------------ */
const crossCasePatterns = [
  {
    id: "cc-1",
    title: "Cloud migration cost avoidance typically realized at 85% of projection",
    sourceCount: 12,
    avgConfidence: 0.78,
    relevance: "high" as const,
    detail: "Across 12 accepted cloud migration value cases, cost avoidance assumptions were realized at a median of 85% of the projected value. Your current projection aligns with this pattern.",
  },
  {
    id: "cc-2",
    title: "Productivity gains in regulated industries trend 15-20% lower than projections",
    sourceCount: 8,
    avgConfidence: 0.72,
    relevance: "high" as const,
    detail: "8 value cases in regulated industries (healthcare, financial services) showed productivity gains 15-20% below initial projections due to compliance overhead.",
  },
  {
    id: "cc-3",
    title: "Implementation timelines in enterprises >5000 employees average 1.4x projected",
    sourceCount: 15,
    avgConfidence: 0.85,
    relevance: "medium" as const,
    detail: "Large enterprise implementations consistently exceed projected timelines. The median overrun is 1.4x, primarily driven by change management and integration complexity.",
  },
];

/* ------------------------------------------------------------------ */
/*  Conversation Messages                                              */
/* ------------------------------------------------------------------ */
const messages = [
  {
    role: "user" as const,
    text: "Generate a defensible value case for Acme Corp's cloud migration. Focus on cost avoidance and productivity gains. Challenge any weak assumptions.",
  },
  {
    role: "assistant" as const,
    text: "I'll build the value case using the Valynt Kernel. I found 5 assumptions in the ledger — let me validate each against the linked evidence before modeling.\n\n**Warning:** Assumption A3 (25% productivity gain) relies on a single 2022 analyst report. I recommend finding fresher evidence or adjusting the confidence weighting.",
  },
  {
    role: "user" as const,
    text: "Good catch. Reduce A3's weight to 50% in the model and flag it for the CFO review.",
  },
  {
    role: "assistant" as const,
    text: "Done. A3 is now weighted at 50% and flagged for CFO attention in the narrative. This reduces the base case from $4.6M to $4.2M. Running sensitivity analysis and Red Team review now...",
  },
];

/* ------------------------------------------------------------------ */
/*  Export Modal                                                       */
/* ------------------------------------------------------------------ */
function ExportModal({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<"pdf" | "pptx" | "docx">("pdf");
  const [sections, setSections] = useState({
    summary: true,
    assumptions: true,
    sensitivity: true,
    redTeam: true,
    narrative: true,
    evidence: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[480px] rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Export Value Case</h3>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Output Format</label>
            <div className="grid grid-cols-3 gap-2">
              {([["pdf", "PDF Report"], ["pptx", "PowerPoint"], ["docx", "Word Doc"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={`h-10 rounded-md border text-[11px] font-medium transition-colors ${
                    format === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">Include Sections</label>
            <div className="space-y-2">
              {Object.entries(sections).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() => setSections({ ...sections, [key]: !val })}
                    className="w-3.5 h-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-[11px] capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={onClose} className="flex-1 h-9 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
              <Download className="w-3 h-3" />
              Generate Export
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function DecisionCanvas() {
  const [inputValue, setInputValue] = useState("");
  const [showRedTeam, setShowRedTeam] = useState(false);
  const [showCrossCase, setShowCrossCase] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [mobileTab, setMobileTab] = useState<"conversation" | "canvas">("canvas");
  const [showConversation, setShowConversation] = useState(true);

  /* Conversation Panel */
  const conversationPanel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-semibold">Decision Canvas</h1>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary ml-auto">The Strategist</span>
      </div>

      {/* Thinking Steps */}
      <AnnotatedSection annotation={ANNOTATIONS.thinkingSteps} position="top-right">
        <div className="px-4 py-3 border-b border-border bg-card/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Reasoning Chain</span>
          </div>
          <div className="space-y-1.5">
            {thinkingSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                {step.status === "complete" ? (
                  <CheckCircle2 className="w-3 h-3 text-health shrink-0" />
                ) : step.status === "active" ? (
                  <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`text-[10px] ${step.status === "pending" ? "text-muted-foreground/40" : "text-foreground/70"}`}>
                  {step.label}
                </span>
                {step.duration && (
                  <span className="text-[8px] font-mono text-muted-foreground ml-auto">{step.duration}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </AnnotatedSection>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.25 }}
            className={`${msg.role === "user" ? "ml-8" : "mr-4"}`}
          >
            <div className={`p-3 rounded-lg text-[12px] leading-relaxed ${
              msg.role === "user"
                ? "bg-primary/10 border border-primary/20"
                : "bg-card border border-border"
            }`}>
              {msg.text.split("\n\n").map((p, j) => (
                <p key={j} className={j > 0 ? "mt-2" : ""}>
                  {p.split("**").map((part, k) =>
                    k % 2 === 1 ? <strong key={k} className="font-semibold text-foreground">{part}</strong> : part
                  )}
                </p>
              ))}
            </div>
            {msg.role === "assistant" && (
              <div className="flex items-center gap-1 mt-1 ml-1">
                <button className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-health transition-colors">
                  <ThumbsUp className="w-2.5 h-2.5" />
                </button>
                <button className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-risk transition-colors">
                  <ThumbsDown className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border focus-within:border-primary/30 transition-colors">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Challenge an assumption, refine the model..."
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/50"
          />
          <button className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors">
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );

  /* Canvas Blocks Content */
  const canvasContent = (
    <div className="p-3 sm:p-5 space-y-4">
      {canvasBlocks.map((block, i) => (
        <motion.div
          key={block.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: block.status === "pending" ? 0.3 : 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
          className={`rounded-lg border ${
            block.status === "generating" ? "border-primary/30 bg-primary/5" :
            block.status === "pending" ? "border-border/50 bg-card/30" :
            "border-border bg-card"
          }`}
        >
          {/* Block Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/50">
            <div className="flex items-center gap-2">
              {block.type === "metric" && <BarChart3 className="w-3.5 h-3.5 text-primary" />}
              {block.type === "table" && <Table className="w-3.5 h-3.5 text-primary" />}
              {block.type === "chart" && <BarChart3 className="w-3.5 h-3.5 text-primary" />}
              <span className="text-[12px] font-semibold">{block.title}</span>
              {block.status === "generating" && (
                <Loader2 className="w-3 h-3 text-primary animate-spin" />
              )}
            </div>
            {block.status === "final" && (
              <div className="flex items-center gap-1">
                <button className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
                <button className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-health hover:bg-health/10 transition-colors">
                  <ThumbsUp className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Block Content */}
          <div className="p-3 sm:p-4">
            {block.type === "metric" && block.content.metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {block.content.metrics.map((m) => (
                  <div key={m.label}>
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">{m.label}</span>
                    <span className="text-base sm:text-lg font-semibold tabular-nums block">{m.value}</span>
                    <span className="text-[9px] text-muted-foreground">{m.subtext}</span>
                  </div>
                ))}
              </div>
            )}

            {block.type === "table" && block.content.headers && block.content.rows && (
              <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border">
                      {block.content.headers.map((h) => (
                        <th key={h} className="text-left py-2 px-2 font-mono text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.content.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-border/50">
                        {row.map((cell, ci) => (
                          <td key={ci} className={`py-2 px-2 whitespace-nowrap ${
                            cell === "Validated" ? "text-health font-medium" :
                            cell === "Weak" ? "text-warning font-medium" :
                            cell === "Unvalidated" ? "text-risk font-medium" :
                            ci === 0 ? "font-mono text-muted-foreground" :
                            ""
                          }`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {block.type === "chart" && block.content.scenarios && (
              <div className="space-y-3">
                {block.content.scenarios.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-[10px] w-20 sm:w-24 text-muted-foreground shrink-0">{s.name}</span>
                    <div className="flex-1 h-6 rounded bg-muted overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(parseFloat(s.value.replace(/[$M]/g, "")) / 7) * 100}%` }}
                        transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded ${
                          s.name === "Base Case" ? "bg-primary" : "bg-primary/40"
                        }`}
                      />
                      <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-mono">{s.value}</span>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground w-8 shrink-0">{s.probability}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ))}

      {/* Executive Narrative Block (pending) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 0.3, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="rounded-lg border border-border/50 bg-card/30"
      >
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <FileOutput className="w-3.5 h-3.5 text-primary" />
            <span className="text-[12px] font-semibold">Executive Value Narrative</span>
          </div>
        </div>
        <div className="p-4 flex items-center gap-3 justify-center py-6">
          <Circle className="w-4 h-4 text-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground/50">Waiting for Red Team review to complete...</span>
        </div>
      </motion.div>
    </div>
  );

  return (
    <ResponsivePageLayout activeHref="/canvas">
      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex border-b border-border shrink-0">
        <button
          onClick={() => setMobileTab("conversation")}
          className={`flex-1 h-10 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === "conversation" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Conversation
        </button>
        <button
          onClick={() => setMobileTab("canvas")}
          className={`flex-1 h-10 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === "canvas" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Canvas
        </button>
      </div>

      {/* Desktop / Tablet Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Conversation Panel — collapsible on tablet */}
        <AnimatePresence>
          {showConversation && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 border-r border-border overflow-hidden"
            >
              <AnnotatedSection annotation={ANNOTATIONS.conversationPanel} position="top-right" className="w-80 lg:w-96 h-full">
                <div className="w-80 lg:w-96 h-full">
                  {conversationPanel}
                </div>
              </AnnotatedSection>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas Area */}
        <AnnotatedSection annotation={ANNOTATIONS.liveCanvas} position="top-left" className="flex-1">
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Canvas Header */}
            <div className="h-12 border-b border-border flex items-center px-3 lg:px-5 gap-2 lg:gap-3 shrink-0">
              {/* Toggle conversation panel */}
              <button
                onClick={() => setShowConversation(!showConversation)}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors lg:hidden ${
                  showConversation ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
              <h2 className="text-xs lg:text-sm font-semibold truncate">Acme Corp — Cloud Migration Value Case</h2>
              <div className="ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">
                <button
                  onClick={() => { setShowCrossCase(!showCrossCase); setShowRedTeam(false); }}
                  className={`h-7 px-2 lg:px-2.5 rounded-md text-[10px] lg:text-[11px] flex items-center gap-1 lg:gap-1.5 transition-colors ${
                    showCrossCase ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Brain className="w-3 h-3" />
                  <span className="hidden lg:inline">Prior Patterns</span>
                </button>
                <button
                  onClick={() => { setShowRedTeam(!showRedTeam); setShowCrossCase(false); }}
                  className={`h-7 px-2 lg:px-2.5 rounded-md text-[10px] lg:text-[11px] flex items-center gap-1 lg:gap-1.5 transition-colors ${
                    showRedTeam ? "bg-risk/15 text-risk" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Swords className="w-3 h-3" />
                  <span className="hidden lg:inline">Red Team</span>
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-risk/20 text-risk">3</span>
                </button>
                <button className="hidden lg:flex h-7 px-2.5 rounded-md bg-muted text-[11px] text-muted-foreground items-center gap-1.5 hover:bg-accent transition-colors">
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
                <button
                  onClick={() => setShowExport(true)}
                  className="h-7 px-2 lg:px-2.5 rounded-md bg-primary text-primary-foreground text-[10px] lg:text-[11px] font-medium flex items-center gap-1 lg:gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>
            </div>

            {/* Canvas Content + Side Panels */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {canvasContent}
              </div>

              {/* Red Team Side Panel */}
              <AnimatePresence>
                {showRedTeam && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-l border-border overflow-hidden shrink-0 hidden lg:block"
                  >
                    <div className="w-[340px] h-full overflow-y-auto">
                      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-risk/5">
                        <Swords className="w-4 h-4 text-risk" />
                        <h3 className="text-[12px] font-semibold text-risk">Red Team Analysis</h3>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-risk/15 text-risk ml-auto">
                          {redTeamChallenges.filter(c => c.status === "unresolved").length} unresolved
                        </span>
                        <button onClick={() => setShowRedTeam(false)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="p-3 space-y-3">
                        {redTeamChallenges.map((challenge) => (
                          <div key={challenge.id} className={`rounded-lg border p-3 ${
                            challenge.severity === "high" ? "border-risk/30 bg-risk/5" :
                            challenge.severity === "medium" ? "border-warning/30 bg-warning/5" :
                            "border-border bg-card"
                          }`}>
                            <div className="flex items-start gap-2 mb-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                challenge.severity === "high" ? "bg-risk/15 text-risk" :
                                challenge.severity === "medium" ? "bg-warning/15 text-warning" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {challenge.severity === "high" || challenge.severity === "medium"
                                  ? <AlertTriangle className="w-3 h-3" />
                                  : <Shield className="w-3 h-3" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded uppercase ${
                                    challenge.severity === "high" ? "bg-risk/15 text-risk" :
                                    challenge.severity === "medium" ? "bg-warning/15 text-warning" :
                                    "bg-muted text-muted-foreground"
                                  }`}>{challenge.severity}</span>
                                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                                    challenge.status === "accepted" ? "bg-health/15 text-health" : "bg-muted text-muted-foreground"
                                  }`}>{challenge.status}</span>
                                </div>
                                <h4 className="text-[11px] font-medium mt-1">{challenge.title}</h4>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{challenge.detail}</p>
                            <div className="p-2 rounded bg-background/50 border border-border/50 mb-2">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-0.5">Impact</span>
                              <p className="text-[10px] text-foreground">{challenge.impact}</p>
                            </div>
                            <div className="p-2 rounded bg-primary/5 border border-primary/10">
                              <span className="text-[9px] font-mono text-primary uppercase tracking-wider block mb-0.5">Recommendation</span>
                              <p className="text-[10px] text-foreground">{challenge.recommendation}</p>
                            </div>
                            {challenge.status === "unresolved" && (
                              <div className="flex items-center gap-2 mt-2">
                                <button className="h-6 px-2 rounded text-[9px] bg-health/15 text-health hover:bg-health/25 transition-colors">Accept</button>
                                <button className="h-6 px-2 rounded text-[9px] bg-muted text-muted-foreground hover:bg-accent transition-colors">Dismiss</button>
                                <button className="h-6 px-2 rounded text-[9px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Adjust Model</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cross-Case Learning Panel */}
              <AnimatePresence>
                {showCrossCase && !showRedTeam && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-l border-border overflow-hidden shrink-0 hidden lg:block"
                  >
                    <div className="w-[340px] h-full overflow-y-auto">
                      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-primary/5">
                        <Brain className="w-4 h-4 text-primary" />
                        <h3 className="text-[12px] font-semibold">Prior Patterns</h3>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary ml-auto">
                          {crossCasePatterns.length} patterns
                        </span>
                        <button onClick={() => setShowCrossCase(false)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="p-3 space-y-3">
                        {crossCasePatterns.map((pattern) => (
                          <div key={pattern.id} className="rounded-lg border border-border bg-card p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                                pattern.relevance === "high" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                              }`}>{pattern.relevance} relevance</span>
                              <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                                {pattern.sourceCount} cases · {(pattern.avgConfidence * 100).toFixed(0)}% conf
                              </span>
                            </div>
                            <h4 className="text-[11px] font-medium mb-2">{pattern.title}</h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{pattern.detail}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <button className="h-6 px-2 rounded text-[9px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors flex items-center gap-1">
                                <GitBranch className="w-2.5 h-2.5" />
                                Apply to Model
                              </button>
                              <button className="h-6 px-2 rounded text-[9px] bg-muted text-muted-foreground hover:bg-accent transition-colors">
                                View Sources
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </AnnotatedSection>
      </div>

      {/* Mobile Layout — tabbed */}
      <div className="md:hidden flex-1 overflow-hidden">
        {mobileTab === "conversation" ? (
          <AnnotatedSection annotation={ANNOTATIONS.conversationPanel} position="top-right" className="h-full">
            {conversationPanel}
          </AnnotatedSection>
        ) : (
          <div className="h-full overflow-y-auto">
            {/* Mobile Canvas Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border px-3 py-2 flex items-center gap-2">
              <h2 className="text-xs font-semibold truncate flex-1">Acme Corp — Cloud Migration</h2>
              <button
                onClick={() => { setShowRedTeam(!showRedTeam); setShowCrossCase(false); }}
                className={`h-7 px-2 rounded-md text-[10px] flex items-center gap-1 transition-colors ${
                  showRedTeam ? "bg-risk/15 text-risk" : "bg-muted text-muted-foreground"
                }`}
              >
                <Swords className="w-3 h-3" />
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-risk/20 text-risk">3</span>
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[10px] font-medium flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>

            {/* Mobile Red Team (inline) */}
            {showRedTeam && (
              <div className="border-b border-border bg-risk/5 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-risk" />
                  <h3 className="text-[12px] font-semibold text-risk">Red Team Analysis</h3>
                  <button onClick={() => setShowRedTeam(false)} className="ml-auto w-5 h-5 rounded flex items-center justify-center text-muted-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {redTeamChallenges.map((c) => (
                  <div key={c.id} className={`rounded-lg border p-3 ${
                    c.severity === "high" ? "border-risk/30 bg-risk/5" :
                    c.severity === "medium" ? "border-warning/30 bg-warning/5" :
                    "border-border bg-card"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded uppercase ${
                        c.severity === "high" ? "bg-risk/15 text-risk" :
                        c.severity === "medium" ? "bg-warning/15 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>{c.severity}</span>
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                        c.status === "accepted" ? "bg-health/15 text-health" : "bg-muted text-muted-foreground"
                      }`}>{c.status}</span>
                    </div>
                    <h4 className="text-[11px] font-medium">{c.title}</h4>
                    <p className="text-[10px] text-muted-foreground mt-1">{c.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {canvasContent}
          </div>
        )}
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      </AnimatePresence>
    </ResponsivePageLayout>
  );
}
