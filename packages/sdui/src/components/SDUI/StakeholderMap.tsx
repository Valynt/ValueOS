import React from "react";

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  priority: "high" | "medium" | "low";
  source: "CRM-derived" | "call-derived" | "inferred";
}

export interface StakeholderMapProps {
  stakeholders: Stakeholder[];
  onSelect?: (stakeholder: Stakeholder) => void;
  className?: string;
}

/**
 * StakeholderMap - Grid showing stakeholders with role, priority, and source badge.
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.1.1
 */
export function StakeholderMap({ stakeholders, onSelect, className = "" }: StakeholderMapProps) {
  const priorityColors = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-green-100 text-green-800 border-green-200",
  };

  const sourceIcons = {
    "CRM-derived": "💼",
    "call-derived": "📞",
    inferred: "🔮",
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-3">Stakeholder Map</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stakeholders.map((stakeholder) => (
          <button
            key={stakeholder.id}
            onClick={() => onSelect?.(stakeholder)}
            className="text-left border border-border rounded-md p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{stakeholder.name}</p>
                <p className="text-xs text-muted-foreground">{stakeholder.role}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border ${priorityColors[stakeholder.priority]}`}>
                {stakeholder.priority}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <span>{sourceIcons[stakeholder.source]}</span>
              <span>{stakeholder.source}</span>
            </div>
          </button>
        ))}
      </div>
      {stakeholders.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No stakeholders identified yet.</p>
      )}
    </div>
  );
}
