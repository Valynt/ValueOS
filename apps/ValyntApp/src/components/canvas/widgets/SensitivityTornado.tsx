/**
 * SensitivityTornado Widget
 *
 * Horizontal bar chart showing assumption impact (positive and negative), clickable bars navigate to assumption.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2
 */

import React from "react";
import { BarChart3, ArrowRight } from "lucide-react";
import { WidgetProps } from "../CanvasHost";

export interface SensitivityItem {
  assumptionId: string;
  assumptionName: string;
  impactPositive: number; // +20% change
  impactNegative: number; // -20% change
  leverage: number;
}

export interface SensitivityTornadoData {
  items: SensitivityItem[];
  baseScenario: string;
}

export function SensitivityTornado({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as SensitivityTornadoData;
  const items = widgetData.items ?? [];

  // Sort by leverage (highest first)
  const sortedItems = [...items].sort((a, b) => b.leverage - a.leverage);

  // Find max value for scaling
  const maxValue = Math.max(
    ...items.map((i) => Math.max(Math.abs(i.impactPositive), Math.abs(i.impactNegative)))
  );

  const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Sensitivity Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Impact of ±20% assumption changes on NPV
          </p>
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No sensitivity data available
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => {
            const positiveWidth = (Math.abs(item.impactPositive) / maxValue) * 100;
            const negativeWidth = (Math.abs(item.impactNegative) / maxValue) * 100;

            return (
              <div
                key={item.assumptionId}
                className="group cursor-pointer"
                onClick={() => onAction?.("navigateToAssumption", { assumptionId: item.assumptionId })}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium flex-1">{item.assumptionName}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="flex items-center gap-2">
                  {/* Negative impact bar */}
                  <div className="flex-1 flex justify-end">
                    <div
                      className="h-6 bg-red-400 rounded-l flex items-center justify-end px-2 text-xs text-white font-medium transition-all hover:bg-red-500"
                      style={{ width: `${negativeWidth}%` }}
                    >
                      {negativeWidth > 20 && formatPercent(item.impactNegative)}
                    </div>
                  </div>

                  {/* Center line */}
                  <div className="w-px h-8 bg-border" />

                  {/* Positive impact bar */}
                  <div className="flex-1">
                    <div
                      className="h-6 bg-green-400 rounded-r flex items-center px-2 text-xs text-white font-medium transition-all hover:bg-green-500"
                      style={{ width: `${positiveWidth}%` }}
                    >
                      {positiveWidth > 20 && formatPercent(item.impactPositive)}
                    </div>
                  </div>
                </div>

                {/* Leverage indicator */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    Leverage: {item.leverage.toFixed(2)}
                  </span>
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(item.leverage * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SensitivityTornado;
