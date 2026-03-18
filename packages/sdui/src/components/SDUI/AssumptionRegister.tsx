import React, { useState } from "react";

export interface Assumption {
  id: string;
  name: string;
  value: number;
  unit: string;
  source: string;
  confidenceScore: number;
  benchmarkReference?: string;
  unsupported: boolean;
  plausibility: "plausible" | "aggressive" | "weakly-supported";
}

export interface AssumptionRegisterProps {
  assumptions: Assumption[];
  onEdit?: (id: string, value: number) => void;
  onSort?: (key: string) => void;
  filterBySource?: string;
  className?: string;
}

/**
 * AssumptionRegister - Sortable table with assumption data.
 *
 * Shows: name, value, unit, source, confidence, benchmark reference, unsupported flags.
 *
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2.2
 */
export function AssumptionRegister({
  assumptions,
  onEdit,
  onSort,
  filterBySource,
  className = "",
}: AssumptionRegisterProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const filteredAssumptions = filterBySource
    ? assumptions.filter((a) => a.source === filterBySource)
    : assumptions;

  const getPlausibilityColor = (p: Assumption["plausibility"]) => {
    switch (p) {
      case "plausible":
        return "text-green-600";
      case "aggressive":
        return "text-yellow-600";
      case "weakly-supported":
        return "text-red-600";
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-3">Assumption Register</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                <button onClick={() => onSort?.("name")} className="hover:text-foreground">Name ↕</button>
              </th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                <button onClick={() => onSort?.("value")} className="hover:text-foreground">Value ↕</button>
              </th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Source</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Confidence</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssumptions.map((assumption) => (
              <tr
                key={assumption.id}
                className={`border-b border-border last:border-0 ${assumption.unsupported ? "bg-red-50/50" : ""}`}
              >
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    {assumption.unsupported && (
                      <span className="text-red-500" title="Unsupported assumption">⚠</span>
                    )}
                    <span className="font-medium">{assumption.name}</span>
                  </div>
                </td>
                <td className="py-2 px-2">
                  {editingId === assumption.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 px-2 py-1 text-sm border border-border rounded"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          const parsed = parseFloat(editValue);
                          if (!isNaN(parsed)) {
                            onEdit?.(assumption.id, parsed);
                            setEditingId(null);
                          }
                        }}
                        className="text-green-600 hover:text-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(assumption.id);
                        setEditValue(String(assumption.value));
                      }}
                      className="hover:bg-accent/50 px-2 py-1 rounded -mx-2"
                    >
                      {assumption.value.toLocaleString()} {assumption.unit}
                    </button>
                  )}
                </td>
                <td className="py-2 px-2 text-muted-foreground">{assumption.source}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${assumption.confidenceScore * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{(assumption.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="py-2 px-2">
                  <div className="flex flex-col gap-1">
                    <span className={`text-xs ${getPlausibilityColor(assumption.plausibility)}`}>
                      {assumption.plausibility}
                    </span>
                    {assumption.benchmarkReference && (
                      <span className="text-xs text-muted-foreground">↳ {assumption.benchmarkReference}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAssumptions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No assumptions found.</p>
      )}
    </div>
  );
}
