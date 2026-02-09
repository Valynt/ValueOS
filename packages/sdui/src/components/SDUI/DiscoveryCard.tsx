import React from "react";
import { Search, X, Tag } from "lucide-react";
import { ConfidenceDisplay } from "../Agent/ConfidenceDisplay";

export interface DiscoveryCardProps {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  confidence?: number;
  status?: "new" | "in_progress" | "validated" | "rejected";
  onExplore?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const statusConfig: Record<
  NonNullable<DiscoveryCardProps["status"]>,
  { label: string; color: string }
> = {
  new: { label: "New", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  in_progress: { label: "In Progress", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  validated: { label: "Validated", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  title,
  description,
  category,
  tags,
  confidence,
  status,
  onExplore,
  onDismiss,
  className = "",
}) => {
  const statusInfo = status ? statusConfig[status] : null;

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
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
                className={`text-xs px-2 py-0.5 rounded-full border ${statusInfo.color}`}
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
            data={{ score: confidence }}
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
              onClick={onExplore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Explore
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};
DiscoveryCard.displayName = "DiscoveryCard";

export default DiscoveryCard;
