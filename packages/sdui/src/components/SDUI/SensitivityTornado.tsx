import React from "react";

export interface SensitivityItem {
  assumptionId: string;
  assumptionName: string;
  impactPositive: number;
  impactNegative: number;
  leverage: number;
}

export interface SensitivityTornadoProps {
  items: SensitivityItem[];
  onItemClick?: (assumptionId: string) => void;
  className?: string;
}

/**
 * SensitivityTornado - Horizontal bar chart showing assumption impact.
 * 
 * Shows positive and negative impact of varying assumptions by ±20%.
 * Clickable bars navigate to assumption details.
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2.4
 */
export function SensitivityTornado({ items, onItemClick, className = "" }: SensitivityTornadoProps) {
  // Sort by absolute leverage (highest first)
  const sortedItems = [...items].sort((a, b) => b.leverage - a.leverage);
  
  // Find max value for scaling
  const maxValue = Math.max(
    ...sortedItems.map((i) => Math.max(Math.abs(i.impactPositive), Math.abs(i.impactNegative)))
  );

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-4">Sensitivity Analysis (Tornado Chart)</h3>
      
      <div className="space-y-3">
        {sortedItems.map((item) => {
          const positiveWidth = (item.impactPositive / maxValue) * 50;
          const negativeWidth = (Math.abs(item.impactNegative) / maxValue) * 50;
          
          return (
            <div key={item.assumptionId} className="flex items-center gap-3">
              {/* Negative bar */}
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => onItemClick?.(item.assumptionId)}
                  className="h-6 bg-red-400 hover:bg-red-500 rounded-l transition-colors relative group"
                  style={{ width: `${negativeWidth}%`, minWidth: item.impactNegative !== 0 ? "40px" : "0" }}
                >
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-white font-medium opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    -20%: {formatCurrency(item.impactNegative)}
                  </span>
                </button>
              </div>
              
              {/* Label */}
              <div className="w-32 text-center">
                <p className="text-xs font-medium truncate" title={item.assumptionName}>
                  {item.assumptionName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Leverage: {(item.leverage * 100).toFixed(0)}%
                </p>
              </div>
              
              {/* Positive bar */}
              <div className="flex-1">
                <button
                  onClick={() => onItemClick?.(item.assumptionId)}
                  className="h-6 bg-green-400 hover:bg-green-500 rounded-r transition-colors relative group"
                  style={{ width: `${positiveWidth}%`, minWidth: item.impactPositive !== 0 ? "40px" : "0" }}
                >
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-white font-medium opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    +20%: {formatCurrency(item.impactPositive)}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-400 rounded" />
          <span>Negative Impact (-20%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-400 rounded" />
          <span>Positive Impact (+20%)</span>
        </div>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No sensitivity data available.</p>
      )}
    </div>
  );
}
