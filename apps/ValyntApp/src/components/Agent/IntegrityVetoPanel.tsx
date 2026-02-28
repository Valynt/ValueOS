/**
 * IntegrityVetoPanel
 *
 * Displays integrity violations with severity indicators, actionable
 * guidance, and a guarded override flow.
 *
 * UX Principles:
 * - Error Prevention > Error Messages: explains how to fix, not just what's wrong
 * - Visual Hierarchy: severity-coded icons and colors
 * - Accessibility: role="alert", keyboard-navigable actions
 */

import { AlertTriangle, ChevronDown, ChevronRight, Info, ShieldAlert, XCircle } from "lucide-react";
import React, { useState } from "react";

import { cn } from "@/lib/utils";

export type ViolationSeverity = "critical" | "high" | "medium" | "low";

export interface Violation {
  id: string;
  message: string;
  severity: ViolationSeverity;
  component?: string;
  suggestion?: string;
}

export interface IntegrityVetoPanelProps {
  /** Simple string array (backward compat) or structured violations */
  violations?: string[] | Violation[];
  title?: string;
  onOverride?: () => void;
  onDismiss?: (violationId: string) => void;
  requireConfirmation?: boolean;
  className?: string;
}

const severityConfig: Record<
  ViolationSeverity,
  { icon: React.FC<{ className?: string }>; color: string; bg: string; border: string; label: string }
> = {
  critical: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    label: "Critical",
  },
  high: {
    icon: ShieldAlert,
    color: "text-destructive",
    bg: "bg-destructive/5",
    border: "border-destructive/20",
    label: "High",
  },
  medium: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    label: "Medium",
  },
  low: {
    icon: Info,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    border: "border-border",
    label: "Low",
  },
};

function normalizeViolations(violations: string[] | Violation[]): Violation[] {
  if (violations.length === 0) return [];
  if (typeof violations[0] === "string") {
    return (violations as string[]).map((msg, i) => ({
      id: `v-${i}`,
      message: msg,
      severity: "high" as ViolationSeverity,
    }));
  }
  return violations as Violation[];
}

export function IntegrityVetoPanel({
  violations = [],
  title = "Integrity Check Failed",
  onOverride,
  onDismiss,
  requireConfirmation = true,
  className,
}: IntegrityVetoPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const items = normalizeViolations(violations);

  if (items.length === 0) return null;

  const hasCritical = items.some((v) => v.severity === "critical");
  const sortedItems = [...items].sort((a, b) => {
    const order: Record<ViolationSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
        <h3 className="text-sm font-semibold text-destructive">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {items.length} violation{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Violation list */}
      <ul className="space-y-2" role="list">
        {sortedItems.map((violation) => {
          const config = severityConfig[violation.severity];
          const Icon = config.icon;
          const isExpanded = expandedIds.has(violation.id);
          const hasSuggestion = !!violation.suggestion;

          return (
            <li
              key={violation.id}
              className={cn(
                "rounded-md border p-3 transition-colors",
                config.bg,
                config.border
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-medium uppercase tracking-wider", config.color)}>
                      {config.label}
                    </span>
                    {violation.component && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {violation.component}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-0.5">{violation.message}</p>

                  {hasSuggestion && (
                    <button
                      onClick={() => toggleExpand(violation.id)}
                      className="flex items-center gap-1 mt-1.5 text-xs text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      How to fix
                    </button>
                  )}
                  {hasSuggestion && isExpanded && (
                    <p className="mt-1.5 text-xs text-muted-foreground bg-background/50 rounded p-2">
                      {violation.suggestion}
                    </p>
                  )}
                </div>
                {onDismiss && violation.severity !== "critical" && (
                  <button
                    onClick={() => onDismiss(violation.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                    aria-label={`Dismiss violation: ${violation.message}`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Override action */}
      {onOverride && (
        <div className="mt-4 pt-3 border-t border-destructive/20">
          {!confirmOpen ? (
            <button
              onClick={() => {
                if (requireConfirmation) setConfirmOpen(true);
                else onOverride();
              }}
              disabled={hasCritical}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                hasCritical
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              )}
              aria-disabled={hasCritical}
              title={hasCritical ? "Cannot override: critical violations must be resolved first" : undefined}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {hasCritical ? "Resolve critical issues first" : "Override and continue"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">
                Are you sure? This bypasses integrity checks.
              </span>
              <button
                onClick={() => { onOverride(); setConfirmOpen(false); }}
                className="px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Confirm Override
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IntegrityVetoPanel;
