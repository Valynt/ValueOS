/*
 * ValueOS Wireframes — Design Annotation Overlay
 * Toggleable labels that explain which agentic UI pattern each element implements.
 * Useful as a stakeholder presentation tool.
 */
import { useState, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, BookOpen, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Context — shared toggle state                                      */
/* ------------------------------------------------------------------ */
interface AnnotationContextValue {
  visible: boolean;
  toggle: () => void;
}

const AnnotationContext = createContext<AnnotationContextValue>({
  visible: false,
  toggle: () => {},
});

export function AnnotationProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <AnnotationContext.Provider value={{ visible, toggle: () => setVisible((v) => !v) }}>
      {children}
    </AnnotationContext.Provider>
  );
}

export function useAnnotations() {
  return useContext(AnnotationContext);
}

/* ------------------------------------------------------------------ */
/*  Toggle Button — fixed position, always visible                     */
/* ------------------------------------------------------------------ */
export function AnnotationToggle() {
  const { visible, toggle } = useAnnotations();

  return (
    <motion.button
      onClick={toggle}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2 px-3.5 py-2 rounded-lg border shadow-lg transition-all ${
        visible
          ? "bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-amber-500/10"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30 shadow-black/20"
      }`}
    >
      {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      <span className="text-[10px] font-mono">
        {visible ? "Hide Annotations" : "Show Annotations"}
      </span>
      <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[8px] font-mono border border-border/50">
        A
      </kbd>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  Annotation Marker — positioned label with description              */
/* ------------------------------------------------------------------ */
export interface AnnotationDef {
  id: string;
  label: string;
  pattern: string;
  description: string;
  source?: string;
}

interface AnnotationMarkerProps {
  annotation: AnnotationDef;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  className?: string;
}

export function AnnotationMarker({ annotation, position = "top-right", className = "" }: AnnotationMarkerProps) {
  const { visible } = useAnnotations();
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  const positionClasses: Record<string, string> = {
    "top-left": "top-1 left-1",
    "top-right": "top-1 right-1",
    "bottom-left": "bottom-1 left-1",
    "bottom-right": "bottom-1 right-1",
    "top-center": "top-1 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-1 left-1/2 -translate-x-1/2",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.2 }}
        className={`absolute ${positionClasses[position]} z-[55] ${className}`}
      >
        {!expanded ? (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(true); }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/25 backdrop-blur-sm hover:bg-amber-500/25 transition-colors group"
          >
            <BookOpen className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-[9px] font-mono text-amber-300 whitespace-nowrap">{annotation.label}</span>
          </button>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-64 rounded-lg bg-card/95 border border-amber-500/25 backdrop-blur-md shadow-xl shadow-black/30 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/15 bg-amber-500/5">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-mono font-semibold text-amber-300">{annotation.label}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3 py-2.5 space-y-1.5">
              <div>
                <span className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-wider">Pattern</span>
                <p className="text-[10px] font-semibold text-primary">{annotation.pattern}</p>
              </div>
              <p className="text-[10px] text-foreground/80 leading-relaxed">{annotation.description}</p>
              {annotation.source && (
                <div className="pt-1 border-t border-border/50">
                  <span className="text-[8px] font-mono text-muted-foreground/50">Inspired by: {annotation.source}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Annotated Section — wraps a UI region with a relative container    */
/* ------------------------------------------------------------------ */
interface AnnotatedSectionProps {
  annotation: AnnotationDef;
  position?: AnnotationMarkerProps["position"];
  children: React.ReactNode;
  className?: string;
  markerClassName?: string;
  highlight?: boolean;
}

export function AnnotatedSection({
  annotation,
  position = "top-right",
  children,
  className = "",
  markerClassName = "",
  highlight = true,
}: AnnotatedSectionProps) {
  const { visible } = useAnnotations();

  return (
    <div className={`relative ${className}`}>
      {visible && highlight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 border border-dashed border-amber-500/25 rounded-lg pointer-events-none z-[54]"
        />
      )}
      {children}
      <AnnotationMarker annotation={annotation} position={position} className={markerClassName} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pre-defined annotations — Value-centric, not CRM-centric          */
/* ------------------------------------------------------------------ */
export const ANNOTATIONS = {
  // Value Command Center
  commandCenter: {
    id: "cmd-center",
    label: "Value Command Center",
    pattern: "Operating Surface",
    description: "Live dashboard of value cases showing where evidence is needed, assumptions are blocked, models need review, or outcomes are drifting. Answers 'where is value uncertain or ready?' — not 'what deals do I have?'",
    source: "Option 1: Value Case OS + Option 3: Production Console",
  },
  caseMaturity: {
    id: "case-maturity",
    label: "Case Maturity",
    pattern: "Decision Readiness Indicator",
    description: "Multi-signal maturity score combining evidence coverage, assumption validation, model defensibility, and stakeholder alignment. Not a deal health score — a decision readiness score.",
    source: "Option 2: Decision Readiness System",
  },
  approvalQueue: {
    id: "approval-queue",
    label: "Approval Queue",
    pattern: "Human-in-the-Loop (HITL)",
    description: "Cases requiring executive review, policy gate clearance, or integrity veto. AI recommends but humans approve. Maintains governance over consequential value decisions.",
    source: "Decision Desk concept",
  },
  autonomyMode: {
    id: "autonomy-mode",
    label: "Autonomy Mode",
    pattern: "Shared Autonomy Controls",
    description: "Three-level autonomy slider: Watch (observe only), Assist (suggest + wait), Autonomous (act within policy bounds). User controls the AI's latitude across all value operations.",
    source: "Devin Autonomy Model",
  },

  // Value Case Workspace
  kernelBuilder: {
    id: "kernel-builder",
    label: "7-Stage Kernel",
    pattern: "Structured Value Construction",
    description: "The Valynt Kernel's 7-stage builder: Discovery & Intake → Baseline & Assumptions → Value Modeling → Feasibility Scoring → Scenario & Sensitivity → Narrative & Output → Lifecycle Monitoring.",
    source: "Valynt Kernel Architecture",
  },
  assumptionLedger: {
    id: "assumption-ledger",
    label: "Assumption Ledger",
    pattern: "Structured State Tracking",
    description: "Every assumption is a first-class object with validation status, evidence links, confidence score, and audit trail. Weak or stale assumptions surface automatically.",
    source: "Option 2: Assumption & Risk Ledger",
  },
  evidencePanel: {
    id: "evidence-panel",
    label: "Evidence Panel",
    pattern: "Numbered Citation System",
    description: "Every claim links to a numbered source — benchmarks, research, customer data. Users can verify any assertion by clicking the citation. Full provenance chain.",
    source: "Perplexity Citation Pattern",
  },
  valueBrief: {
    id: "value-brief",
    label: "Value Brief",
    pattern: "Generative Artifact",
    description: "AI-composed document synthesizing the value thesis, assumptions, evidence, and projected outcomes into a stakeholder-ready business case artifact.",
    source: "Thesys Generative UI Blocks",
  },

  // Decision Canvas
  thinkingSteps: {
    id: "thinking-steps",
    label: "Thinking Steps",
    pattern: "Observable Chain-of-Thought",
    description: "AI shows its reasoning process step-by-step: gathering evidence, validating assumptions, modeling scenarios. Users can see, interrupt, and redirect the process.",
    source: "Devin Thinking Steps",
  },
  liveCanvas: {
    id: "live-canvas",
    label: "Live Canvas",
    pattern: "Generative UI Canvas",
    description: "Dynamic workspace where AI renders interactive blocks (charts, tables, narratives) in real-time. Each block can be edited, approved, or regenerated independently.",
    source: "Thesys Generative UI + Vercel v0",
  },
  conversationPanel: {
    id: "conversation-panel",
    label: "Conversation Panel",
    pattern: "Conversational Steering",
    description: "Natural language interface for directing the AI agent. Users can refine assumptions, challenge evidence, or constrain the model through dialogue.",
    source: "GitHub Copilot Workspace",
  },

  // Value Maturity Board
  maturityBoard: {
    id: "maturity-board",
    label: "Maturity Board",
    pattern: "Decision Readiness Progression",
    description: "Horizontal columns based on decision maturity — not sales stages. Signal Detected → Hypothesis Formed → Evidence In Progress → Model Defensible → Executive Ready → Approved → Realization Active.",
    source: "Option 2: Decision Readiness Board",
  },
  confidenceScore: {
    id: "confidence-score",
    label: "Confidence Score",
    pattern: "Model Defensibility Metric",
    description: "Composite score measuring how defensible the value model is: evidence coverage, assumption validation rate, scenario range, and feasibility score.",
    source: "Valynt Kernel Confidence Engine",
  },
  driftAlert: {
    id: "drift-alert",
    label: "Drift Alert",
    pattern: "Realization Variance Detection",
    description: "Post-approval monitoring that detects when realized outcomes diverge from projected models. Triggers re-evaluation when variance exceeds policy thresholds.",
    source: "Option 1: Realization Tracker",
  },

  // Evidence Graph
  evidenceGraph: {
    id: "evidence-graph",
    label: "Evidence Graph",
    pattern: "Provenance Network",
    description: "Graph-native view showing source provenance, benchmark lineage, linked assumptions, and confidence propagation across the entire evidence chain.",
    source: "Option 3: Evidence Graph",
  },
  benchmarkLineage: {
    id: "benchmark-lineage",
    label: "Benchmark Lineage",
    pattern: "Source Traceability",
    description: "Every benchmark traces back to its original source with freshness dating, methodology notes, and applicability scoring. Stale benchmarks are flagged automatically.",
    source: "Evidence Trail concept",
  },

  // Decision Desk
  decisionDesk: {
    id: "decision-desk",
    label: "Decision Desk",
    pattern: "Governance Queue",
    description: "Dedicated approval surface for HITL gates, policy exceptions, executive signoff, and integrity vetoes. Every approval is logged with rationale and timestamp.",
    source: "Option 1: Decision Desk + Option 2: Approval Desk",
  },
  policyGate: {
    id: "policy-gate",
    label: "Policy Gate",
    pattern: "Automated Compliance Check",
    description: "PolicyEngine evaluates each value case against configured rules (discount limits, confidence thresholds, required evidence). Cases that fail are held for manual review.",
    source: "Valynt PolicyEngine",
  },

  // Policy & Governance
  policyEngine: {
    id: "policy-engine",
    label: "Policy Engine",
    pattern: "Automated Governance Rules",
    description: "Configurable policy rules that act as automated guardrails. Each rule defines a threshold, an action (block, escalate, flag), and logs every trigger.",
    source: "Valynt PolicyEngine",
  },
  hitlApproval: {
    id: "hitl-approval",
    label: "HITL Approval",
    pattern: "Human-in-the-Loop Decision Gate",
    description: "Detailed approval view with full context: summary, impact assessment, policy reference, and supporting evidence. Every decision is logged.",
    source: "HITL Approval Pattern",
  },
  domainPacks: {
    id: "domain-packs",
    label: "Domain Packs",
    pattern: "Smart Specialization Layer",
    description: "Reusable overlays applied at case creation: KPI defaults, assumption templates, benchmarks, narrative language, compliance rules, and risk weighting. Not the product identity — a specialization layer.",
    source: "Option 1: Domain Packs as overlays",
  },
  auditTrail: {
    id: "audit-trail",
    label: "Audit Trail",
    pattern: "Complete Decision History",
    description: "Every change to a value case — assumption edits, evidence additions, model recalculations, approvals — is logged with actor, timestamp, and rationale. Full regulatory-grade audit.",
    source: "Evidence Trail concept",
  },

  // Global
  navRail: {
    id: "nav-rail",
    label: "Nav Rail",
    pattern: "Minimal Navigation Rail",
    description: "Icon-only sidebar navigation inspired by Linear. Maximizes content density while maintaining clear wayfinding. Keyboard shortcuts for power users.",
    source: "Linear Navigation Pattern",
  },
  commandPalette: {
    id: "cmd-palette",
    label: "Command Palette",
    pattern: "Keyboard-First Command Interface",
    description: "Cmd+K overlay with fuzzy search across all actions, value cases, and system commands. Categorized results with keyboard navigation. Power user accelerator.",
    source: "Linear Command Palette",
  },
  redTeamPanel: {
    id: "red-team",
    label: "Red Team / Adversarial Review",
    pattern: "Adversarial Stress Testing",
    description: "AI-powered adversarial analysis that stress-tests value narratives. Identifies weak assumptions, challenges evidence quality, and surfaces counter-arguments before executive presentation.",
    source: "Sprint 15 — Adversarial Review",
  },
  crossCaseLearning: {
    id: "cross-case",
    label: "Cross-Case Learning",
    pattern: "Institutional Memory",
    description: "Institutional memory from previously accepted hypotheses. Shows prior patterns, reusable evidence, and successful value arguments from similar cases.",
    source: "Sprint 17 — Institutional Memory",
  },
  exportControls: {
    id: "export-controls",
    label: "Export Controls",
    pattern: "Artifact Export System",
    description: "PDF, PPTX, and shareable link export with full evidence provenance and assumption audit trail embedded. Executive-ready output artifacts.",
    source: "Sprint 18 — Export & Compliance",
  },
  provenanceDrawer: {
    id: "provenance-drawer",
    label: "Provenance Drawer",
    pattern: "Evidence Lineage Chain",
    description: "Per-node lineage chain showing data_source → tier → formula → agent → confidence. Full traceability from raw data to final value claim.",
    source: "Sprint 16 — Evidence Provenance",
  },
  evidenceTiers: {
    id: "evidence-tiers",
    label: "Evidence Tier Classification",
    pattern: "Tiered Evidence Quality",
    description: "Three-tier evidence quality system: Tier 1 (customer-verified), Tier 2 (third-party benchmarks), Tier 3 (analyst estimates). Color-coded badges with freshness indicators.",
    source: "Sprint 15 — Evidence Quality",
  },
  confidenceBreakdown: {
    id: "confidence-breakdown",
    label: "3-Component Confidence Score",
    pattern: "Transparent Scoring Methodology",
    description: "Weighted confidence calculation from three components: Evidence Quality (40%), Assumption Validation (35%), and Model Robustness (25%). Transparent scoring methodology.",
    source: "Sprint 15 — Confidence Scoring",
  },
  valueLoopAnalytics: {
    id: "valueloop-analytics",
    label: "ValueLoop Analytics",
    pattern: "Pipeline Conversion Metrics",
    description: "Stage-to-stage conversion metrics showing how value cases flow through the maturity pipeline. Identifies bottlenecks and velocity trends across the portfolio.",
    source: "Sprint 17 — ValueLoop Metrics",
  },
  crmIntegration: {
    id: "crm-integration",
    label: "CRM Integration Flow",
    pattern: "Bidirectional CRM Sync",
    description: "Salesforce opportunity search and link during case creation. Bidirectional sync between ValueOS value cases and CRM opportunity records.",
    source: "Sprint 16 — CRM Integration",
  },
  complianceExport: {
    id: "compliance-export",
    label: "Compliance Export",
    pattern: "Audit-Ready Reporting",
    description: "Audit-ready report generation for SOC 2, revenue recognition, and deal desk compliance. Scheduled exports with custom builder for ad-hoc reports.",
    source: "Sprint 18 — Compliance & Audit",
  },
  realizationDashboard: {
    id: "realization-dashboard",
    label: "Value Realization Dashboard",
    pattern: "Post-Sale Proof Surface",
    description: "Post-sale proof surface showing KPIs vs actuals, milestone tracking, and variance analysis. CFO-ready artifacts for QBRs and renewal conversations.",
    source: "Sprint 18 — Realization Tracking",
  },
  onboardingWizard: {
    id: "onboarding-wizard",
    label: "Tenant Onboarding Wizard",
    pattern: "Progressive Context Ingestion",
    description: "Guided first-run experience for enterprise pilots. Progressive context ingestion: company profile, ICP definition, competitor mapping, and Domain Pack selection.",
    source: "Sprint 16 — Tenant Onboarding",
  },
  expansionView: {
    id: "expansion-view",
    label: "Expansion Recommendations",
    pattern: "Land-and-Expand Intelligence",
    description: "Land-and-expand intelligence engine. Cross-sell and upsell opportunities scored by integrity, linked to realization data and stakeholder sentiment.",
    source: "Sprint 17 — Expansion Intelligence",
  },
} as const;