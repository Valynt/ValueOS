/**
 * ScenarioComparison Widget
 *
 * Three-column layout showing ROI, NPV, payback, EVF decomposition per scenario with base emphasized.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2
 */

import { Clock, DollarSign, PieChart, TrendingUp } from "lucide-react";
import React from "react";

import { WidgetProps } from "../CanvasHost";

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

export interface ScenarioComparisonData {
  scenarios: Scenario[];
}

export function ScenarioComparison({ data }: WidgetProps) {
  const widgetData = data as unknown as ScenarioComparisonData;
  const scenarios = widgetData.scenarios ?? [];

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  const formatPercent = (value: number) => `${value.toFixed(0)}%`;

  const scenarioOrder: Scenario["name"][] = ["conservative", "base", "upside"];
  const orderedScenarios = scenarioOrder
    .map((name) => scenarios.find((s) => s.name === name))
    .filter(Boolean) as Scenario[];

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <PieChart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Scenario Comparison</h3>
          <p className="text-sm text-muted-foreground">Financial scenarios side-by-side</p>
        </div>
      </div>

      {orderedScenarios.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No scenarios available</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {orderedScenarios.map((scenario) => (
            <div
              key={scenario.id}
              role="button"
              tabIndex={0}
              aria-label={`${scenario.name} scenario`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                }
              }}
              className={`rounded-lg border p-4 ${scenario.isBase
                ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                : "bg-card border-border"
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">{scenario.name.charAt(0).toUpperCase() + scenario.name.slice(1)}</h4>
                {scenario.isBase && (
                  <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">
                    Base
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className="font-semibold">{formatPercent(scenario.roi)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">NPV</p>
                    <p className="font-semibold">{formatCurrency(scenario.npv)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Payback</p>
                    <p className="font-semibold">{scenario.paybackMonths} months</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">EVF Decomposition</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Revenue Uplift</span>
                    <span className="font-medium">{formatCurrency(scenario.evfDecomposition.revenueUplift)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost Reduction</span>
                    <span className="font-medium">{formatCurrency(scenario.evfDecomposition.costReduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Risk Mitigation</span>
                    <span className="font-medium">{formatCurrency(scenario.evfDecomposition.riskMitigation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Efficiency Gain</span>
                    <span className="font-medium">{formatCurrency(scenario.evfDecomposition.efficiencyGain)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScenarioComparison;
