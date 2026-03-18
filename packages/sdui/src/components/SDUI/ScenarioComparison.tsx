import React from "react";

export interface Scenario {
  id: string;
  name: "conservative" | "base" | "upside";
  roi: number;
  npv: number;
  paybackMonths: number;
  evfDecomposition: {
    revenueUplift: number;
    costReduction: number;
    riskMitigation: number;
    efficiencyGain: number;
  };
  isBase: boolean;
}

export interface ScenarioComparisonProps {
  scenarios: Scenario[];
  onSelect?: (id: string) => void;
  className?: string;
}

/**
 * ScenarioComparison - Three-column layout showing financial scenarios.
 * 
 * Shows ROI, NPV, payback, and EVF decomposition per scenario with base emphasized.
 * 
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2.3
 */
export function ScenarioComparison({ scenarios, onSelect, className = "" }: ScenarioComparisonProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-4">Scenario Comparison</h3>
      
      <div className="grid grid-cols-3 gap-4">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => onSelect?.(scenario.id)}
            className={`text-left border rounded-lg p-4 transition-all ${
              scenario.isBase
                ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                : "border-border hover:bg-accent/50"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold capitalize">{scenario.name}</h4>
              {scenario.isBase && (
                <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                  Base
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ROI</span>
                <span className="font-medium">{formatPercent(scenario.roi)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">NPV</span>
                <span className="font-medium">{formatCurrency(scenario.npv)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payback</span>
                <span className="font-medium">{scenario.paybackMonths} months</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Value Decomposition</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-green-600">Revenue</span>
                  <span>{formatCurrency(scenario.evfDecomposition.revenueUplift)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">Cost</span>
                  <span>{formatCurrency(scenario.evfDecomposition.costReduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-600">Risk</span>
                  <span>{formatCurrency(scenario.evfDecomposition.riskMitigation)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-600">Efficiency</span>
                  <span>{formatCurrency(scenario.evfDecomposition.efficiencyGain)}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
