/*
 * ValueOS Wireframes — Autonomy Mode Toggle
 * Pattern: Shared Autonomy Controls (Devin-inspired)
 * Three levels: Watch (observe only) → Assist (suggest + wait) → Autonomous (act within policy)
 * Shared context so all screens reflect the current mode.
 */
import { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Lightbulb, Zap, Shield, Info } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Context                                                    */
/* ------------------------------------------------------------------ */
export type AutonomyLevel = "watch" | "assist" | "autonomous";

interface AutonomyContextValue {
  level: AutonomyLevel;
  setLevel: (l: AutonomyLevel) => void;
}

const AutonomyContext = createContext<AutonomyContextValue>({
  level: "assist",
  setLevel: () => {},
});

export function AutonomyProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevel] = useState<AutonomyLevel>("assist");
  return (
    <AutonomyContext.Provider value={{ level, setLevel }}>
      {children}
    </AutonomyContext.Provider>
  );
}

export function useAutonomy() {
  return useContext(AutonomyContext);
}

/* ------------------------------------------------------------------ */
/*  Config per level                                                   */
/* ------------------------------------------------------------------ */
const LEVELS: Record<AutonomyLevel, {
  label: string;
  shortLabel: string;
  icon: typeof Eye;
  color: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
  description: string;
  behaviors: string[];
}> = {
  watch: {
    label: "Watch Mode",
    shortLabel: "Watch",
    icon: Eye,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/25",
    ringColor: "ring-sky-500/30",
    description: "AI observes and learns. No actions taken. Full visibility into what the AI would recommend.",
    behaviors: [
      "Monitors value case activity silently",
      "Builds context from assumptions and evidence",
      "Shows what it would suggest (greyed out)",
      "No notifications sent",
    ],
  },
  assist: {
    label: "Assist Mode",
    shortLabel: "Assist",
    icon: Lightbulb,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/25",
    ringColor: "ring-amber-500/30",
    description: "AI suggests actions and waits for approval. Every recommendation requires explicit human sign-off.",
    behaviors: [
      "Proactive insights in Value Command Center",
      "Draft value briefs and narratives for review",
      "Approval gates on all model changes",
      "Alerts for weak assumptions and evidence gaps",
    ],
  },
  autonomous: {
    label: "Autonomous Mode",
    shortLabel: "Auto",
    icon: Zap,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/25",
    ringColor: "ring-emerald-500/30",
    description: "AI acts within policy bounds. Routine tasks execute automatically. Escalates only when confidence is low.",
    behaviors: [
      "Auto-enriches evidence from connected sources",
      "Runs sensitivity analysis on model changes",
      "Generates & queues value narratives",
      "Escalates low-confidence assumptions for review",
    ],
  },
};

const LEVEL_ORDER: AutonomyLevel[] = ["watch", "assist", "autonomous"];

/* ------------------------------------------------------------------ */
/*  Nav Rail Toggle — compact vertical control                         */
/* ------------------------------------------------------------------ */
export function AutonomyNavToggle() {
  const { level, setLevel } = useAutonomy();
  const [expanded, setExpanded] = useState(false);
  const config = LEVELS[level];
  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${config.bgColor} ${config.borderColor} border ${config.color}`}
        title={`Autonomy: ${config.label}`}
      >
        <Icon className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {expanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setExpanded(false)}
            />

            {/* Popover */}
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-72"
            >
              <div className="rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                {/* Header */}
                <div className={`px-4 py-3 border-b ${config.borderColor} ${config.bgColor}`}>
                  <div className="flex items-center gap-2">
                    <Shield className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className="text-[11px] font-mono font-semibold text-foreground">Autonomy Controls</span>
                  </div>
                </div>

                {/* Level selector */}
                <div className="p-3">
                  {/* Track */}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/50 mb-3">
                    {LEVEL_ORDER.map((l) => {
                      const lConfig = LEVELS[l];
                      const LIcon = lConfig.icon;
                      const isActive = l === level;
                      return (
                        <button
                          key={l}
                          onClick={() => setLevel(l)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-mono transition-all ${
                            isActive
                              ? `${lConfig.bgColor} ${lConfig.color} ${lConfig.borderColor} border shadow-sm`
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <LIcon className="w-3 h-3" />
                          {lConfig.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active level detail */}
                  <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-[12px] font-semibold ${config.color}`}>{config.label}</span>
                    </div>
                    <p className="text-[10px] text-foreground/70 leading-relaxed mb-3">{config.description}</p>
                    <div className="space-y-1.5">
                      {config.behaviors.map((b, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${config.color.replace("text-", "bg-")}`} />
                          <span className="text-[10px] text-foreground/60">{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Policy note */}
                  {level === "autonomous" && (
                    <div className="mt-2 p-2 rounded-md bg-muted/30 border border-border/50 flex items-start gap-2">
                      <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-[9px] text-muted-foreground leading-relaxed">
                        Actions bounded by PolicyEngine rules. Configure limits in Policy & Governance.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Pill — inline indicator for headers                         */
/* ------------------------------------------------------------------ */
export function AutonomyStatusPill() {
  const { level } = useAutonomy();
  const config = LEVELS[level];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${config.bgColor} ${config.borderColor} border`}>
      <Icon className={`w-2.5 h-2.5 ${config.color}`} />
      <span className={`text-[9px] font-mono ${config.color}`}>{config.shortLabel}</span>
    </div>
  );
}
