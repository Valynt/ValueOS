/**
 * DiscoveryCard
 *
 * Displays a discovered opportunity/insight with status, confidence, and actions.
 *
 * UX Principles:
 * - Immediate Feedback: skeleton loading state while data loads
 * - Accessibility: focus ring, keyboard-accessible Explore/Dismiss, aria roles
 * - Visual Hierarchy: status badge + confidence meter in F-pattern scan zone
 */

import React from "react";
import { Search, Tag, X } from "lucide-react";
import { ConfidenceDisplay } from "../Agent/ConfidenceDisplay";
import { cn } from "@/lib/utils";

export interface DiscoveryCardProps {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  confidence?: number;
  status?: "new" | "in_progress" | "validated" | "rejected";
  loading?: boolean;
  onExplore?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const statusConfig: Record<
  NonNullable<DiscoveryCardProps["status"]>,
  { label: string; color: string }
> = {
  new: { label: "New", color: "bg-primary/10 text-primary border-primary/20" },
  in_progress: { label: "In Progress", color: "bg-warning/10 text-warning border-warning/20" },
  validated: { label: "Validated", color: "bg-success/10 text-success border-success/20" },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function DiscoveryCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4 animate-pulse", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
          <div className="h-5 w-3/4 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
        </div>
        <div className="h-6 w-12 rounded bg-muted" />
      </div>
      <div className="flex gap-1.5 mt-3">
        <div className="h-5 w-14 rounded bg-muted" />
        <div className="h-5 w-18 rounded bg-muted" />
      </div>
    </div>
  );
}

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  title,
  description,
  category,
  tags,
  confidence,
  status,
  loading = false,
  onExplore,
  onDismiss,
  className = "",
}) => {
  if (loading) return <DiscoveryCardSkeleton className={className} />;

  const statusInfo = status ? statusConfig[status] : null;
  const isInteractive = !!onExplore;

  return (
    <article
      className={cn(
        "bg-card border border-border rounded-lg p-4 transition-all duration-200",
        isInteractive && "hover:border-primary/30 hover:shadow-sm",
        className
      )}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onExplore : undefined}
      onKeyDown={isInteractive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExplore?.(); } } : undefined}
      aria-label={`${title}${status ? ` — ${statusConfig[status].label}` : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {category && (
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {category}
              </span>
            )}
            {statusInfo && (
              <span
                className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", statusInfo.color)}
              >
                {statusInfo.label}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground truncate">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>
        {confidence !== undefined && (
          <ConfidenceDisplay
            value={confidence}
            size="sm"
            showLabel={false}
          />
        )}
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {(onExplore || onDismiss) && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
          {onExplore && (
            <button
              onClick={(e) => { e.stopPropagation(); onExplore(); }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Search className="w-3.5 h-3.5" />
              Explore
            </button>
          )}
          {onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                "text-muted-foreground hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <X className="w-3.5 h-3.5" />
              Dismiss
            </button>
          )}
        </div>
      )}
    </article>
  );
};
DiscoveryCard.displayName = "DiscoveryCard";

export default DiscoveryCard;
