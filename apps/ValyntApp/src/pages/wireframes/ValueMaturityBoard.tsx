/*
 * ValueOS Wireframes — Value Maturity Board
 * Replaces: Pipeline Board
 * Core shift: From sales stages to decision-readiness columns
 * Columns: Signal → Hypothesis → Evidence → Defensible → Executive Ready → Approved → Realization
 * Features: Drag-and-drop with policy gate validation, skip-stage rejection animations
 * Responsive: Desktop = horizontal Kanban, Tablet = scrollable, Mobile = vertical stacked accordion
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, TrendingUp, Clock, ChevronDown, ShieldAlert,
  CheckCircle2, XCircle, ArrowRight, GripVertical, Zap
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

import { useMaturityCards } from "./useWireframeData";

import { AnnotatedSection, ANNOTATIONS } from "@/components/wireframes/AnnotationOverlay";
import { ResponsivePageLayout } from "@/components/wireframes/ResponsiveNav";


/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ValueCase {
  id: string;
  name: string;
  company: string;
  projectedValue: string;
  confidence: number;
  daysInStage: number;
  domainPack: string;
  alert?: string;
  drift?: string;
}

interface MaturityColumn {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  cases: ValueCase[];
}

/* ------------------------------------------------------------------ */
/*  Policy Gate Rules                                                  */
/* ------------------------------------------------------------------ */
const COLUMN_ORDER = ["signal", "hypothesis", "evidence", "defensible", "executive", "approved", "realization"];

interface PolicyResult {
  allowed: boolean;
  reason: string;
  ruleId?: string;
  severity?: "error" | "warning";
}

function evaluatePolicyGate(
  caseItem: ValueCase,
  fromColId: string,
  toColId: string
): PolicyResult {
  const fromIdx = COLUMN_ORDER.indexOf(fromColId);
  const toIdx = COLUMN_ORDER.indexOf(toColId);

  // Cannot move backward
  if (toIdx < fromIdx) {
    return {
      allowed: false,
      reason: `Regression not permitted. Cases cannot move from ${fromColId} back to ${toColId}. File a reversion request through the Decision Desk.`,
      ruleId: "POLICY-001",
      severity: "error",
    };
  }

  // Cannot skip more than 1 stage
  if (toIdx - fromIdx > 1) {
    return {
      allowed: false,
      reason: `Stage skip detected (${toIdx - fromIdx} stages). Policy requires sequential progression. Each stage gate must be satisfied before advancement.`,
      ruleId: "POLICY-002",
      severity: "error",
    };
  }

  // Confidence threshold gates
  if (toColId === "defensible" && caseItem.confidence < 40) {
    return {
      allowed: false,
      reason: `Confidence score ${caseItem.confidence}% is below the 40% minimum required for "Defensible" status. Gather more evidence to increase confidence.`,
      ruleId: "POLICY-003",
      severity: "error",
    };
  }

  if (toColId === "executive" && caseItem.confidence < 65) {
    return {
      allowed: false,
      reason: `Confidence score ${caseItem.confidence}% is below the 65% minimum required for "Executive Ready". The value model needs stronger evidence backing.`,
      ruleId: "POLICY-004",
      severity: "error",
    };
  }

  if (toColId === "approved" && caseItem.confidence < 85) {
    return {
      allowed: false,
      reason: `Confidence score ${caseItem.confidence}% is below the 85% minimum required for "Approved". All assumptions must be validated before final approval.`,
      ruleId: "POLICY-005",
      severity: "error",
    };
  }

  // Alert-based blocks
  if (caseItem.alert && caseItem.alert.includes("Discount exceeds policy") && toColId === "executive") {
    return {
      allowed: false,
      reason: `Policy exception required: "${caseItem.alert}". Submit an override request through the Decision Desk before advancing.`,
      ruleId: "POLICY-006",
      severity: "error",
    };
  }

  if (caseItem.alert && caseItem.alert.includes("assumptions unvalidated") && toColId === "defensible") {
    return {
      allowed: false,
      reason: `${caseItem.alert}. All critical assumptions must be validated before the model can be marked as defensible.`,
      ruleId: "POLICY-007",
      severity: "error",
    };
  }

  // Allowed — with optional warning
  if (toColId === "realization" && caseItem.confidence < 92) {
    return {
      allowed: true,
      reason: `Advancing to Realization. Note: confidence is ${caseItem.confidence}%, which is below the recommended 92% threshold. Monitor closely.`,
      severity: "warning",
    };
  }

  return { allowed: true, reason: "All policy gates satisfied. Case advanced successfully." };
}

/* ------------------------------------------------------------------ */
/*  Toast / Notification overlay                                       */
/* ------------------------------------------------------------------ */
interface GateToast {
  id: string;
  result: PolicyResult;
  caseName: string;
  fromCol: string;
  toCol: string;
}

function GateToastOverlay({ toasts, onDismiss }: { toasts: GateToast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`rounded-lg border p-3 shadow-xl backdrop-blur-sm ${
              !t.result.allowed
                ? "bg-risk/15 border-risk/30"
                : t.result.severity === "warning"
                ? "bg-warning/15 border-warning/30"
                : "bg-health/15 border-health/30"
            }`}
          >
            <div className="flex items-start gap-2">
              {!t.result.allowed ? (
                <XCircle className="w-4 h-4 text-risk shrink-0 mt-0.5" />
              ) : t.result.severity === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-health shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold truncate">{t.caseName}</span>
                  {t.result.ruleId && (
                    <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {t.result.ruleId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[9px] font-mono text-muted-foreground">{t.fromCol}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[9px] font-mono text-muted-foreground">{t.toCol}</span>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{t.result.reason}</p>
              </div>
              <button
                onClick={() => onDismiss(t.id)}
                className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
              >
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Bar                                                        */
/* ------------------------------------------------------------------ */
function SummaryBar({ cols }: { cols: MaturityColumn[] }) {
  const totalCases = cols.reduce((acc, col) => acc + col.cases.length, 0);
  const blocked = cols.reduce((acc, col) => acc + col.cases.filter((c) => c.alert).length, 0);
  const stats = [
    { label: "Active Cases", value: String(totalCases) },
    { label: "Portfolio Value", value: "$25.0M" },
    { label: "Avg Confidence", value: "52%" },
    { label: "Blocked", value: String(blocked), alert: blocked > 0 },
  ];

  return (
    <div className="px-4 py-3 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label}>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block">{s.label}</span>
          <span className={`text-lg font-semibold tabular-nums ${s.alert ? "text-risk" : ""}`}>{s.value}</span>
        </div>
      ))}
      {/* Maturity Distribution Bar — desktop only */}
      <div className="hidden md:block col-span-4 mt-1">
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Maturity Distribution</span>
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {cols.map((col) => (
            <div
              key={col.id}
              className={`${col.bgColor} ${col.borderColor} border transition-all duration-500`}
              style={{ flex: Math.max(col.cases.length, 0.2) }}
              title={`${col.shortLabel}: ${col.cases.length}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Draggable Case Card                                                */
/* ------------------------------------------------------------------ */
function DraggableCaseCard({
  c,
  col,
  delay,
  onDragStart,
  isDragging,
}: {
  c: ValueCase;
  col: MaturityColumn;
  delay: number;
  onDragStart: (caseItem: ValueCase, colId: string) => void;
  isDragging: boolean;
}) {
  return (
    <motion.div
      layout
      layoutId={c.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: isDragging ? 0.4 : 1,
        scale: isDragging ? 0.95 : 1,
      }}
      transition={{ delay: delay, duration: 0.2 }}
      draggable
      onDragStart={() => onDragStart(c, col.id)}
      className={`p-3 rounded-lg bg-card border ${col.borderColor} hover:border-primary/30 transition-colors cursor-grab active:cursor-grabbing group select-none touch-none`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
        <span className="text-[9px] font-mono text-muted-foreground flex-1">{c.company}</span>
        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">{c.domainPack}</span>
      </div>
      <h4 className="text-[11px] font-medium leading-snug mb-2 pl-4">{c.name}</h4>

      <div className="flex items-center justify-between mb-2 pl-4">
        <span className="text-[11px] font-mono font-semibold">{c.projectedValue}</span>
        {c.confidence > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  c.confidence >= 75 ? "bg-health" : c.confidence >= 40 ? "bg-warning" : "bg-risk"
                }`}
                style={{ width: `${c.confidence}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">{c.confidence}%</span>
          </div>
        )}
      </div>

      {c.alert && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-warning/10 border border-warning/15 mb-1.5 ml-4">
          <AlertTriangle className="w-2.5 h-2.5 text-warning shrink-0" />
          <span className="text-[9px] text-warning">{c.alert}</span>
        </div>
      )}

      {c.drift && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 border border-primary/15 mb-1.5 ml-4">
          <TrendingUp className="w-2.5 h-2.5 text-primary shrink-0" />
          <span className="text-[9px] text-primary">{c.drift}</span>
        </div>
      )}

      <div className="flex items-center gap-1 mt-2 pl-4">
        <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
        <span className="text-[8px] font-mono text-muted-foreground/50">{c.daysInStage}d in stage</span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drop Zone Column (Desktop)                                         */
/* ------------------------------------------------------------------ */
function DropColumn({
  col,
  colIndex,
  draggedCase,
  draggedFromCol,
  onDragStart,
  onDrop,
  dropFeedback,
}: {
  col: MaturityColumn;
  colIndex: number;
  draggedCase: ValueCase | null;
  draggedFromCol: string | null;
  onDragStart: (c: ValueCase, colId: string) => void;
  onDrop: (colId: string) => void;
  dropFeedback: "accept" | "reject" | "warning" | null;
}) {
  const [isOver, setIsOver] = useState(false);
  const isSource = draggedFromCol === col.id;

  // Determine if this is a valid drop target while dragging
  let dropHint: "valid" | "invalid" | "skip" | null = null;
  if (draggedCase && draggedFromCol && !isSource) {
    const fromIdx = COLUMN_ORDER.indexOf(draggedFromCol);
    const toIdx = COLUMN_ORDER.indexOf(col.id);
    if (toIdx < fromIdx) dropHint = "invalid";
    else if (toIdx - fromIdx > 1) dropHint = "skip";
    else dropHint = "valid";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: colIndex * 0.05, duration: 0.25 }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDrop(col.id);
      }}
      className={`flex flex-col w-52 border-r border-border last:border-r-0 shrink-0 transition-all duration-200 ${
        dropFeedback === "reject"
          ? "bg-risk/5"
          : dropFeedback === "accept"
          ? "bg-health/5"
          : dropFeedback === "warning"
          ? "bg-warning/5"
          : ""
      }`}
    >
      {/* Column Header */}
      <div className={`px-3 py-2.5 border-b ${col.borderColor} ${col.bgColor} transition-colors duration-200 ${
        isOver && dropHint === "valid" ? "ring-1 ring-health/50" :
        isOver && dropHint === "skip" ? "ring-1 ring-risk/50" :
        isOver && dropHint === "invalid" ? "ring-1 ring-risk/50" : ""
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-mono font-semibold ${col.color}`}>{col.shortLabel}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{col.cases.length}</span>
        </div>
        {/* Drop hint indicator */}
        <AnimatePresence>
          {isOver && draggedCase && !isSource && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1.5"
            >
              {dropHint === "valid" ? (
                <div className="flex items-center gap-1 text-health">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span className="text-[8px] font-mono">Drop to advance</span>
                </div>
              ) : dropHint === "skip" ? (
                <div className="flex items-center gap-1 text-risk">
                  <ShieldAlert className="w-2.5 h-2.5" />
                  <span className="text-[8px] font-mono">Stage skip blocked</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-risk">
                  <XCircle className="w-2.5 h-2.5" />
                  <span className="text-[8px] font-mono">Regression blocked</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {col.cases.map((c, i) => (
          <DraggableCaseCard
            key={c.id}
            c={c}
            col={col}
            delay={0}
            onDragStart={onDragStart}
            isDragging={draggedCase?.id === c.id}
          />
        ))}

        {/* Empty drop zone indicator */}
        <AnimatePresence>
          {isOver && draggedCase && !isSource && dropHint === "valid" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 60 }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg border-2 border-dashed border-health/30 bg-health/5 flex items-center justify-center"
            >
              <span className="text-[9px] font-mono text-health/60">Drop here</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rejection flash overlay */}
      <AnimatePresence>
        {dropFeedback === "reject" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-risk/10 pointer-events-none rounded"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Accordion Column                                            */
/* ------------------------------------------------------------------ */
function MobileColumn({ col, defaultOpen }: { col: MaturityColumn; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border-b ${col.borderColor}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 flex items-center justify-between ${col.bgColor}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono font-semibold ${col.color}`}>{col.shortLabel}</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{col.cases.length}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {col.cases.map((c, i) => (
                <DraggableCaseCard
                  key={c.id}
                  c={c}
                  col={col}
                  delay={i * 0.04}
                  onDragStart={() => {}}
                  isDragging={false}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Policy Gate Legend                                                  */
/* ------------------------------------------------------------------ */
function PolicyGateLegend() {
  const gates = [
    { label: "Defensible", rule: "Confidence >= 40%", ruleId: "POLICY-003" },
    { label: "Exec Ready", rule: "Confidence >= 65%", ruleId: "POLICY-004" },
    { label: "Approved", rule: "Confidence >= 85%", ruleId: "POLICY-005" },
    { label: "All stages", rule: "Sequential only (no skipping)", ruleId: "POLICY-002" },
    { label: "All stages", rule: "No backward regression", ruleId: "POLICY-001" },
  ];

  return (
    <div className="px-4 py-2 border-t border-border bg-card/50 hidden md:block">
      <div className="flex items-center gap-2 mb-1.5">
        <ShieldAlert className="w-3 h-3 text-muted-foreground" />
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Policy Gates</span>
        <Zap className="w-3 h-3 text-warning ml-auto" />
        <span className="text-[9px] font-mono text-muted-foreground">Drag cards between columns to test gate enforcement</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {gates.map((g) => (
          <div key={g.ruleId} className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">{g.ruleId}</span>
            <span className="text-[8px] text-muted-foreground">{g.label}: {g.rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
const initialColumns: MaturityColumn[] = [
  {
    id: "signal", label: "Signal Detected", shortLabel: "Signal",
    color: "text-sky-400", bgColor: "bg-sky-500/10", borderColor: "border-sky-500/20",
    cases: [
      { id: "c1", name: "Operational Efficiency Play", company: "Globex Industries", projectedValue: "TBD", confidence: 0, daysInStage: 2, domainPack: "Manufacturing" },
      { id: "c2", name: "Security Compliance Gap", company: "Oscorp", projectedValue: "TBD", confidence: 0, daysInStage: 5, domainPack: "Enterprise IT" },
    ],
  },
  {
    id: "hypothesis", label: "Hypothesis Formed", shortLabel: "Hypothesis",
    color: "text-violet-400", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/20",
    cases: [
      { id: "c3", name: "Revenue Acceleration", company: "Umbrella Corp", projectedValue: "$800K", confidence: 18, daysInStage: 8, domainPack: "SaaS" },
    ],
  },
  {
    id: "evidence", label: "Evidence In Progress", shortLabel: "Evidence",
    color: "text-warning", bgColor: "bg-warning/10", borderColor: "border-warning/20",
    cases: [
      { id: "c4", name: "Cloud Migration ROI", company: "Acme Corp", projectedValue: "$4.2M", confidence: 42, daysInStage: 14, domainPack: "Enterprise IT", alert: "3 assumptions unvalidated" },
      { id: "c5", name: "Supply Chain Optimization", company: "LexCorp", projectedValue: "$2.1M", confidence: 55, daysInStage: 7, domainPack: "Manufacturing" },
    ],
  },
  {
    id: "defensible", label: "Model Defensible", shortLabel: "Defensible",
    color: "text-amber-300", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20",
    cases: [
      { id: "c6", name: "Platform Consolidation", company: "Stark Industries", projectedValue: "$3.8M", confidence: 68, daysInStage: 4, domainPack: "Enterprise IT", alert: "Discount exceeds policy" },
    ],
  },
  {
    id: "executive", label: "Executive Ready", shortLabel: "Exec Ready",
    color: "text-health", bgColor: "bg-health/10", borderColor: "border-health/20",
    cases: [
      { id: "c7", name: "Process Automation", company: "Initech", projectedValue: "$2.4M", confidence: 88, daysInStage: 2, domainPack: "SaaS" },
    ],
  },
  {
    id: "approved", label: "Approved", shortLabel: "Approved",
    color: "text-emerald-300", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20",
    cases: [
      { id: "c8", name: "Data Platform Migration", company: "Cyberdyne", projectedValue: "$5.6M", confidence: 94, daysInStage: 12, domainPack: "Enterprise IT" },
    ],
  },
  {
    id: "realization", label: "Realization Active", shortLabel: "Realizing",
    color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/20",
    cases: [
      { id: "c9", name: "Security Modernization", company: "Wayne Enterprises", projectedValue: "$6.1M", confidence: 95, daysInStage: 90, domainPack: "Enterprise IT", drift: "+18% above model" },
    ],
  },
];

export default function ValueMaturityBoard() {
  const { data: liveCards } = useMaturityCards();

  // Merge live cards into the static column structure.
  // Live cards replace mock cases in their respective columns when available.
  const mergedInitial: MaturityColumn[] = initialColumns.map((col) => {
    const live = liveCards[col.id];
    if (!live || live.length === 0) return col;
    return {
      ...col,
      cases: live.map((c) => ({
        id: c.id,
        name: c.title,
        company: c.company,
        projectedValue: c.value,
        confidence: c.confidence,
        daysInStage: c.daysInStage,
        domainPack: "Enterprise IT",
        alert: c.blocked ? "Blocked" : undefined,
      })),
    };
  });

  const [cols, setCols] = useState<MaturityColumn[]>(mergedInitial);
  // Track columns the user has modified via drag-and-drop so live data
  // updates don't overwrite their local reordering.
  const userModifiedCols = useRef<Set<string>>(new Set());

  // Sync live data into cols whenever the API response arrives or updates.
  // Columns the user has already dragged cards into/out of are left untouched.
  useEffect(() => {
    setCols((prev) =>
      prev.map((col) => {
        if (userModifiedCols.current.has(col.id)) return col;
        const live = liveCards[col.id];
        if (!live || live.length === 0) return col;
        return {
          ...col,
          cases: live.map((c) => ({
            id: c.id,
            name: c.title,
            company: c.company,
            projectedValue: c.value,
            confidence: c.confidence,
            daysInStage: c.daysInStage,
            domainPack: "Enterprise IT",
            alert: c.blocked ? "Blocked" : undefined,
          })),
        };
      })
    );
  }, [liveCards]);

  const [draggedCase, setDraggedCase] = useState<ValueCase | null>(null);
  const [draggedFromCol, setDraggedFromCol] = useState<string | null>(null);
  const [toasts, setToasts] = useState<GateToast[]>([]);
  const [dropFeedback, setDropFeedback] = useState<Record<string, "accept" | "reject" | "warning" | null>>({});
  const toastCounter = useRef(0);

  const handleDragStart = useCallback((c: ValueCase, colId: string) => {
    setDraggedCase(c);
    setDraggedFromCol(colId);
  }, []);

  const addToast = useCallback((result: PolicyResult, caseName: string, fromCol: string, toCol: string) => {
    const id = `toast-${++toastCounter.current}`;
    const fromLabel = cols.find((c) => c.id === fromCol)?.shortLabel || fromCol;
    const toLabel = cols.find((c) => c.id === toCol)?.shortLabel || toCol;
    setToasts((prev) => [...prev.slice(-4), { id, result, caseName, fromCol: fromLabel, toCol: toLabel }]);
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, [cols]);

  const handleDrop = useCallback(
    (targetColId: string) => {
      if (!draggedCase || !draggedFromCol || targetColId === draggedFromCol) {
        setDraggedCase(null);
        setDraggedFromCol(null);
        return;
      }

      const result = evaluatePolicyGate(draggedCase, draggedFromCol, targetColId);

      if (result.allowed) {
        // Mark both affected columns as user-modified so live data won't overwrite them.
        userModifiedCols.current.add(draggedFromCol);
        userModifiedCols.current.add(targetColId);

        // Move the card
        setCols((prev) =>
          prev.map((col) => {
            if (col.id === draggedFromCol) {
              return { ...col, cases: col.cases.filter((c) => c.id !== draggedCase!.id) };
            }
            if (col.id === targetColId) {
              return { ...col, cases: [...col.cases, { ...draggedCase!, daysInStage: 0 }] };
            }
            return col;
          })
        );

        // Flash feedback
        const feedbackType = result.severity === "warning" ? "warning" : "accept";
        setDropFeedback((prev) => ({ ...prev, [targetColId]: feedbackType }));
        setTimeout(() => setDropFeedback((prev) => ({ ...prev, [targetColId]: null })), 800);
      } else {
        // Rejection animation — flash the target column red
        setDropFeedback((prev) => ({ ...prev, [targetColId]: "reject" }));
        setTimeout(() => setDropFeedback((prev) => ({ ...prev, [targetColId]: null })), 800);
      }

      addToast(result, draggedCase.name, draggedFromCol, targetColId);
      setDraggedCase(null);
      setDraggedFromCol(null);
    },
    [draggedCase, draggedFromCol, addToast]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ResponsivePageLayout activeHref="/maturity">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0">
        <h1 className="text-sm font-semibold">Value Maturity Board</h1>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-3 hidden sm:inline">Decision Readiness View</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground hidden md:inline">Drag cards to test policy gates</span>
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 hidden md:block" />
        </div>
      </header>

      {/* Summary */}
      <AnnotatedSection annotation={ANNOTATIONS.maturityBoard} position="top-right">
        <SummaryBar cols={cols} />
      </AnnotatedSection>

      {/* Desktop Kanban — horizontal scroll with drag-and-drop */}
      <div className="hidden md:flex flex-1 overflow-x-auto overflow-y-hidden relative">
        <div className="flex h-full min-w-max">
          {cols.map((col, ci) => (
            <DropColumn
              key={col.id}
              col={col}
              colIndex={ci}
              draggedCase={draggedCase}
              draggedFromCol={draggedFromCol}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dropFeedback={dropFeedback[col.id] || null}
            />
          ))}
        </div>
      </div>

      {/* Mobile Accordion — vertical stacked (no drag-and-drop) */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {cols.map((col, ci) => (
          <MobileColumn key={col.id} col={col} defaultOpen={ci < 3} />
        ))}
      </div>

      {/* Policy Gate Legend */}
      <PolicyGateLegend />

      {/* Toast overlay */}
      <GateToastOverlay toasts={toasts} onDismiss={dismissToast} />
    </ResponsivePageLayout>
  );
}
