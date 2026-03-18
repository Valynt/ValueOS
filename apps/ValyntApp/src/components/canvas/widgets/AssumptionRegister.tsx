/**
 * AssumptionRegister Widget
 *
 * Sortable table with: name, value, unit, source badge, confidence badge, benchmark reference, unsupported flag highlight.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.2
 */

import React, { useState } from "react";
import { ArrowUpDown, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { SourceBadge, SourceType } from "@valueos/components/components/SourceBadge";
import { ConfidenceBadge } from "@valueos/components/components/ConfidenceBadge";
import { WidgetProps } from "../CanvasHost";

type SortField = "name" | "value" | "confidence" | "source";
type SortDirection = "asc" | "desc";

export interface Assumption {
  id: string;
  name: string;
  value: number;
  unit: string;
  source: SourceType;
  confidenceScore: number;
  benchmarkReference?: string;
  unsupported: boolean;
  plausibility: "plausible" | "aggressive" | "weakly-supported";
}

export interface AssumptionRegisterData {
  assumptions: Assumption[];
}

export function AssumptionRegister({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as AssumptionRegisterData;
  const assumptions = widgetData.assumptions ?? [];
  
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterSource, setFilterSource] = useState<string>("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedAssumptions = [...assumptions]
    .filter((a) => filterSource === "all" || a.source === filterSource)
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "value":
          comparison = a.value - b.value;
          break;
        case "confidence":
          comparison = a.confidenceScore - b.confidenceScore;
          break;
        case "source":
          comparison = a.source.localeCompare(b.source);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary" />
    );
  };

  const sourceTypes = Array.from(new Set(assumptions.map((a) => a.source)));

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Assumption Register</h3>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-md border bg-background"
        >
          <option value="all">All Sources</option>
          {sourceTypes.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      {sortedAssumptions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No assumptions found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th
                  className="text-left py-3 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">Name</span>
                    <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("value")}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">Value</span>
                    <SortIcon field="value" />
                  </div>
                </th>
                <th className="text-left py-3 px-2">
                  <span className="text-sm font-medium">Source</span>
                </th>
                <th
                  className="text-left py-3 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("confidence")}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">Confidence</span>
                    <SortIcon field="confidence" />
                  </div>
                </th>
                <th className="text-left py-3 px-2">
                  <span className="text-sm font-medium">Status</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAssumptions.map((assumption) => (
                <tr
                  key={assumption.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                    assumption.unsupported ? "bg-red-50/50" : ""
                  }`}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{assumption.name}</span>
                      {assumption.unsupported && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    {assumption.benchmarkReference && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Benchmark: {assumption.benchmarkReference}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-medium">
                      {assumption.value.toLocaleString()} {assumption.unit}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <SourceBadge sourceType={assumption.source} size="sm" showTier={false} />
                  </td>
                  <td className="py-3 px-2">
                    <ConfidenceBadge score={assumption.confidenceScore} showTooltip={false} />
                  </td>
                  <td className="py-3 px-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        assumption.plausibility === "plausible"
                          ? "bg-green-100 text-green-800"
                          : assumption.plausibility === "aggressive"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {assumption.plausibility.replace("-", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AssumptionRegister;
