/*
 * ValueOS — Command Palette (Cmd+K)
 * Pattern: Linear's keyboard-driven command interface
 * Features: fuzzy search, categorized actions, keyboard nav, recent items, breadcrumb scoping
 */
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, LayoutDashboard, Sparkles, FileText,
  ArrowRight, CornerDownLeft, ChevronRight, Clock, Zap,
  Settings, Home, AlertTriangle,
  Shield, Globe, FlaskConical, Scale, Layers,
  Command, Star, BookOpen, Activity, Package,
  TrendingUp, BarChart3, Users, Microscope,
  Rocket, Target
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: string;
  keywords: string[];
  action: () => void;
  shortcut?: string;
  badge?: string;
  badgeColor?: string;
}

/* ------------------------------------------------------------------ */
/*  Hook: useCommandPalette                                            */
/* ------------------------------------------------------------------ */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

/* ------------------------------------------------------------------ */
/*  Fuzzy match helper                                                 */
/* ------------------------------------------------------------------ */
function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return { match: true, score: 0 };
  if (t.includes(q)) return { match: true, score: 100 - t.indexOf(q) };

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2;
    } else {
      consecutive = 0;
    }
  }
  return { match: qi === q.length, score };
}

function matchItem(query: string, item: CommandItem): number {
  const targets = [item.label, item.description ?? "", item.category, ...item.keywords];
  let best = 0;
  for (const t of targets) {
    const { match, score } = fuzzyMatch(query, t);
    if (match && score > best) best = score;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [scope, setScope] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const [recentIds] = useState<string[]>(["nav-cmd-center", "nav-workspace", "action-compose"]);

  /* ---- Build command list ---- */
  const allItems: CommandItem[] = useMemo(() => {
    const go = (path: string) => () => { navigate(path); onClose(); };
    return [
      // Navigation
      { id: "nav-home", label: "Go to Home", icon: Home, category: "Navigation", keywords: ["home", "index", "wireframes"], action: go("/wireframes") },
      { id: "nav-cmd-center", label: "Go to Value Command Center", icon: LayoutDashboard, category: "Navigation", keywords: ["command", "center", "dashboard", "portfolio"], action: go("/wireframes/command-center"), shortcut: "G C" },
      { id: "nav-workspace", label: "Go to Value Case Workspace", icon: FileText, category: "Navigation", keywords: ["workspace", "case", "kernel", "acme"], action: go("/wireframes/workspace/acme-cloud"), shortcut: "G W" },
      { id: "nav-canvas", label: "Go to Decision Canvas", icon: Sparkles, category: "Navigation", keywords: ["canvas", "decision", "ai", "compose"], action: go("/wireframes/canvas"), shortcut: "G D" },
      { id: "nav-maturity", label: "Go to Value Maturity Board", icon: Layers, category: "Navigation", keywords: ["maturity", "board", "kanban", "readiness"], action: go("/wireframes/maturity"), shortcut: "G M" },
      { id: "nav-evidence", label: "Go to Evidence Graph", icon: FlaskConical, category: "Navigation", keywords: ["evidence", "graph", "proof", "sources"], action: go("/wireframes/evidence"), shortcut: "G E" },
      { id: "nav-decisions", label: "Go to Decision Desk", icon: Scale, category: "Navigation", keywords: ["decisions", "desk", "approval", "queue"], action: go("/wireframes/decisions"), shortcut: "G A" },
      { id: "nav-governance", label: "Go to Policy & Governance", icon: Shield, category: "Navigation", keywords: ["governance", "policy", "settings", "rules"], action: go("/wireframes/governance"), shortcut: "G G" },
      { id: "nav-realization", label: "Go to Realization Dashboard", icon: BarChart3, category: "Navigation", keywords: ["realization", "dashboard", "post-sale", "kpi", "qbr"], action: go("/wireframes/realization"), shortcut: "G R" },
      { id: "nav-onboarding", label: "Go to Onboarding Wizard", icon: Rocket, category: "Navigation", keywords: ["onboarding", "wizard", "setup", "tenant", "pilot"], action: go("/wireframes/onboarding"), shortcut: "G O" },
      { id: "nav-expansion", label: "Go to Expansion Recommendations", icon: Target, category: "Navigation", keywords: ["expansion", "cross-sell", "upsell", "growth", "land"], action: go("/wireframes/expansion"), shortcut: "G X" },

      // Actions
      { id: "action-compose", label: "Compose Value Narrative", description: "AI-assisted value case composition", icon: Sparkles, category: "Actions", keywords: ["compose", "narrative", "value", "brief", "ai"], action: go("/wireframes/canvas"), badge: "AI", badgeColor: "text-primary bg-primary/10" },
      { id: "action-validate", label: "Validate Assumptions", description: "Run assumption validation across active cases", icon: Microscope, category: "Actions", keywords: ["validate", "assumptions", "check", "verify"], action: () => onClose(), badge: "Agent", badgeColor: "text-violet-400 bg-violet-500/10" },
      { id: "action-refresh-evidence", label: "Refresh Evidence", description: "Check for stale sources and update benchmarks", icon: FlaskConical, category: "Actions", keywords: ["refresh", "evidence", "stale", "benchmarks", "update"], action: () => onClose() },
      { id: "action-risk-review", label: "Run Maturity Review", description: "Assess decision readiness across portfolio", icon: AlertTriangle, category: "Actions", keywords: ["risk", "review", "maturity", "readiness"], action: () => onClose(), badge: "Agent", badgeColor: "text-warning bg-warning/10" },
      { id: "action-scenario", label: "Run Scenario Analysis", description: "Model best/worst/expected outcomes", icon: BarChart3, category: "Actions", keywords: ["scenario", "sensitivity", "analysis", "model"], action: () => onClose() },

      // Value Cases
      { id: "case-acme", label: "Acme Corp — Cloud Migration", description: "Evidence In Progress · 62% confidence", icon: FileText, category: "Value Cases", keywords: ["acme", "cloud", "migration", "enterprise"], action: go("/wireframes/workspace/acme-cloud"), badge: "62%", badgeColor: "text-warning bg-warning/10" },
      { id: "case-initech", label: "Initech — Platform Consolidation", description: "Executive Ready · 88% confidence", icon: FileText, category: "Value Cases", keywords: ["initech", "platform", "consolidation"], action: go("/wireframes/workspace/initech"), badge: "88%", badgeColor: "text-health bg-health/10" },
      { id: "case-stark", label: "Stark Industries — Security Overhaul", description: "Hypothesis Formed · 34% confidence", icon: FileText, category: "Value Cases", keywords: ["stark", "security", "overhaul"], action: go("/wireframes/workspace/stark"), badge: "34%", badgeColor: "text-risk bg-risk/10" },
      { id: "case-wayne", label: "Wayne Enterprises — Digital Transformation", description: "Realization Active · 91% confidence", icon: FileText, category: "Value Cases", keywords: ["wayne", "digital", "transformation"], action: go("/wireframes/workspace/wayne"), badge: "91%", badgeColor: "text-health bg-health/10" },

      // Agents
      { id: "agent-strategist", label: "The Strategist", description: "Value case composition & narrative", icon: Sparkles, category: "Agents", keywords: ["strategist", "value", "narrative", "compose"], action: () => onClose() },
      { id: "agent-analyst", label: "The Analyst", description: "Evidence validation & benchmark research", icon: Microscope, category: "Agents", keywords: ["analyst", "evidence", "benchmark", "research"], action: () => onClose() },
      { id: "agent-modeler", label: "The Modeler", description: "Value modeling & scenario analysis", icon: TrendingUp, category: "Agents", keywords: ["modeler", "value", "model", "scenario"], action: () => onClose() },
      { id: "agent-monitor", label: "The Monitor", description: "Realization tracking & drift detection", icon: Activity, category: "Agents", keywords: ["monitor", "realization", "drift", "tracking"], action: () => onClose() },

      // Governance
      { id: "gov-policies", label: "Policy Rules", description: "Configure automated guardrails", icon: Shield, category: "Governance", keywords: ["policies", "rules", "guardrails", "thresholds"], action: go("/wireframes/governance") },
      { id: "gov-domains", label: "Domain Packs", description: "Industry-specific assumptions & benchmarks", icon: Package, category: "Governance", keywords: ["domain", "packs", "industry", "templates"], action: go("/wireframes/governance") },
      { id: "gov-agents", label: "Agent Permissions", description: "Control agent autonomy & capabilities", icon: Users, category: "Governance", keywords: ["agent", "permissions", "autonomy", "capabilities"], action: go("/wireframes/governance") },
      { id: "gov-audit", label: "Audit Trail", description: "View complete decision history", icon: BookOpen, category: "Governance", keywords: ["audit", "trail", "history", "log"], action: go("/wireframes/governance") },
      { id: "gov-compliance", label: "Compliance Export", description: "Generate audit-ready compliance reports", icon: BarChart3, category: "Governance", keywords: ["compliance", "export", "soc2", "report", "audit"], action: go("/wireframes/governance") },
    ];
  }, [navigate, onClose]);

  /* ---- Filter & group ---- */
  const scopedItems = scope ? allItems.filter((i) => i.category === scope) : allItems;

  const filtered = useMemo(() => {
    if (!query.trim()) {
      const recents = recentIds.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as CommandItem[];
      const rest = scopedItems.filter((i) => !recentIds.includes(i.id));
      return { recents, items: rest };
    }
    const scored = scopedItems
      .map((item) => ({ item, score: matchItem(query, item) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return { recents: [], items: scored.map((s) => s.item) };
  }, [query, scopedItems, allItems, recentIds, scope]);

  const flatList = [...filtered.recents, ...filtered.items];

  /* ---- Keyboard navigation ---- */
  useEffect(() => { setActiveIndex(0); }, [query, scope]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatList[activeIndex]) {
        e.preventDefault();
        flatList[activeIndex].action();
      } else if (e.key === "Backspace" && !query && scope) {
        e.preventDefault();
        setScope(null);
      }
    },
    [flatList, activeIndex, query, scope],
  );

  /* ---- Scroll active into view ---- */
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  /* ---- Focus input on open ---- */
  useEffect(() => {
    if (open) {
      setQuery("");
      setScope(null);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  /* ---- Group items by category ---- */
  function groupByCategory(items: CommandItem[]) {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of items) {
      (groups[item.category] ??= []).push(item);
    }
    return groups;
  }

  /* ---- Render ---- */
  if (!open) return null;

  let runningIndex = filtered.recents.length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-[560px] max-h-[480px] rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              {scope && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono shrink-0">
                  {scope}
                  <ChevronRight className="w-2.5 h-2.5" />
                </div>
              )}
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={scope ? `Search ${scope}...` : "Search commands, cases, agents..."}
                className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
              <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-[9px] font-mono text-muted-foreground border border-border/50">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-1">
              {flatList.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[12px] text-muted-foreground">No results for "{query}"</p>
                </div>
              )}

              {/* Recent Items */}
              {filtered.recents.length > 0 && (
                <div>
                  <div className="px-4 py-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Recent
                    </span>
                  </div>
                  {filtered.recents.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        data-index={i}
                        onClick={item.action}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          activeIndex === i ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-medium truncate block">{item.label}</span>
                          {item.description && <span className="text-[10px] text-muted-foreground/70 truncate block">{item.description}</span>}
                        </div>
                        {item.badge && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${item.badgeColor}`}>{item.badge}</span>
                        )}
                        {item.shortcut && (
                          <span className="text-[9px] font-mono text-muted-foreground/40">{item.shortcut}</span>
                        )}
                        {activeIndex === i && <CornerDownLeft className="w-3 h-3 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Grouped Items */}
              {Object.entries(groupByCategory(filtered.items)).map(([category, items]) => {
                const startIdx = runningIndex;
                runningIndex += items.length;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between px-4 py-1.5 mt-1">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">{category}</span>
                      {!scope && (
                        <button
                          onClick={() => { setScope(category); setQuery(""); }}
                          className="text-[9px] font-mono text-primary/60 hover:text-primary flex items-center gap-0.5 transition-colors"
                        >
                          View all <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    {items.map((item, i) => {
                      const idx = startIdx + i;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          data-index={idx}
                          onClick={item.action}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                            activeIndex === idx ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[12px] font-medium truncate block">{item.label}</span>
                            {item.description && <span className="text-[10px] text-muted-foreground/70 truncate block">{item.description}</span>}
                          </div>
                          {item.badge && (
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${item.badgeColor}`}>{item.badge}</span>
                          )}
                          {item.shortcut && (
                            <span className="text-[9px] font-mono text-muted-foreground/40">{item.shortcut}</span>
                          )}
                          {activeIndex === idx && <CornerDownLeft className="w-3 h-3 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20">
              <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/50">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/50 text-[8px]">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/50 text-[8px]">↵</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/50 text-[8px]">esc</kbd> close
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/30">
                <Command className="w-2.5 h-2.5" />
                <Star className="w-2.5 h-2.5" />
                ValueOS
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
