/**
 * EmptyState
 *
 * Shown when a list/view has no data. Provides recognition-over-recall
 * by suggesting next actions instead of leaving the user guessing.
 *
 * UX Principles:
 * - Recognition over Recall: suggested actions tell the user what to do next
 * - 5-Second Rule: icon + title + description immediately convey state
 * - Accessibility: role="status", focusable action buttons
 */

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "default" | "secondary" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  /** Primary action (backward compat) */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Multiple suggested actions */
  actions?: EmptyStateAction[];
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actions = [],
  className = "",
}: EmptyStateProps) {
  // Merge single action into actions array for unified rendering
  const allActions: EmptyStateAction[] = [
    ...(action ? [{ label: action.label, onClick: action.onClick, icon: action.icon }] : []),
    ...actions,
  ];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>
      {allActions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {allActions.map((act, i) => {
            const ActionIcon = act.icon;
            return (
              <Button
                key={act.label}
                onClick={act.onClick}
                variant={act.variant ?? (i === 0 ? "default" : "outline")}
                size="default"
              >
                {ActionIcon && (
                  <ActionIcon className="h-4 w-4 mr-1.5" aria-hidden="true" />
                )}
                {act.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EmptySearchState({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="status"
    >
      <p className="text-foreground mb-2">No results found for &ldquo;{query}&rdquo;</p>
      <p className="text-sm text-muted-foreground mb-4">
        Try adjusting your search or filters
      </p>
      <button
        onClick={onClear}
        className={cn(
          "text-sm text-primary hover:underline transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        )}
      >
        Clear search
      </button>
    </div>
  );
}

export default EmptyState;
