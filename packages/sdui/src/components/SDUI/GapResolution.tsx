import React, { useState } from "react";

export interface GapItem {
  id: string;
  field: string;
  description: string;
  required: boolean;
  resolved: boolean;
  value?: string | number | boolean;
}

export interface GapResolutionProps {
  gaps: GapItem[];
  onSubmit?: (gapId: string, value: string | number | boolean) => void;
  onResolve?: (gapId: string) => void;
  className?: string;
}

/**
 * GapResolution - List of missing data items with inline input fields.
 * 
 * Shows missing data items with inline input fields, submit action, and resolved state.
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.1.2
 */
export function GapResolution({ gaps, onSubmit, onResolve, className = "" }: GapResolutionProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const unresolvedGaps = gaps.filter((g) => !g.resolved);
  const resolvedGaps = gaps.filter((g) => g.resolved);

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-3">Gap Resolution</h3>
      
      {unresolvedGaps.length === 0 && resolvedGaps.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No data gaps identified.</p>
      )}

      {/* Unresolved Gaps */}
      {unresolvedGaps.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Missing Data ({unresolvedGaps.length})
          </p>
          {unresolvedGaps.map((gap) => (
            <div key={gap.id} className="border border-border rounded-md p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{gap.field}</p>
                  <p className="text-xs text-muted-foreground">{gap.description}</p>
                  {gap.required && (
                    <span className="text-xs text-red-500 font-medium">Required</span>
                  )}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={inputValues[gap.id] || ""}
                  onChange={(e) => setInputValues((v) => ({ ...v, [gap.id]: e.target.value }))}
                  placeholder="Enter value..."
                  className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background"
                />
                <button
                  onClick={() => {
                    onSubmit?.(gap.id, inputValues[gap.id] || "");
                    onResolve?.(gap.id);
                  }}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Submit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved Gaps */}
      {resolvedGaps.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Resolved ({resolvedGaps.length})
          </p>
          {resolvedGaps.map((gap) => (
            <div key={gap.id} className="border border-border rounded-md p-3 bg-accent/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm line-through">{gap.field}</p>
                  <p className="text-xs text-muted-foreground">Value: {String(gap.value)}</p>
                </div>
                <span className="text-green-500 text-sm">✓</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
