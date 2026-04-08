/**
 * SensitivityView Component
 *
 * Displays sensitivity analysis with tornado chart showing
 * which inputs have the greatest impact on output values.
 *
 * Phase 5.4: Value Graph Polish
 */

import React, { useMemo } from "react";
import { ArrowUp, ArrowDown, Info } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

import type { Graph, ValueNode } from "@/features/living-value-graph/types/graph.types";

interface SensitivityItem {
  nodeId: string;
  nodeName: string;
  nodeType: ValueNode["type"];
  baseValue: number;
  lowValue: number;
  highValue: number;
  impact: number; // Percentage impact on primary output
  rank: number;
}

interface SensitivityViewProps {
  graph: Graph;
  targetNodeId?: string; // Node to analyze sensitivity for (defaults to highest value output)
  className?: string;
}

/**
 * Calculate sensitivity of inputs to a target output node.
 * Uses a simplified what-if analysis:
 * - For each input, vary its value by ±10%
 * - Measure the resulting change in the target output
 */
function calculateSensitivity(
  graph: Graph,
  targetNodeId: string
): SensitivityItem[] {
  const targetNode = graph.nodes[targetNodeId];
  if (!targetNode) return [];

  const baseOutputValue = targetNode.value ?? 0;
  if (baseOutputValue === 0) return [];

  // Find all driver/input nodes that contribute to this output
  const contributingNodes = Object.values(graph.edges)
    .filter((e) => e.target === targetNodeId)
    .map((e) => graph.nodes[e.source])
    .filter((n): n is ValueNode => n !== undefined);

  // Calculate sensitivity for each contributing node
  const sensitivities: SensitivityItem[] = contributingNodes.map((node) => {
    const baseValue = node.value ?? 0;

    // Simulate ±10% variation
    const lowValue = baseValue * 0.9;
    const highValue = baseValue * 1.1;

    // Estimate impact based on proportion of target value
    // In a real implementation, this would use the actual formula evaluation
    const proportion = Math.abs(baseValue) / Math.abs(baseOutputValue);
    const estimatedImpact = proportion * 10; // 10% variation

    return {
      nodeId: node.id,
      nodeName: node.label,
      nodeType: node.type,
      baseValue,
      lowValue,
      highValue,
      impact: estimatedImpact,
      rank: 0, // Will be assigned after sorting
    };
  });

  // Sort by absolute impact (descending) and assign ranks
  const sorted = sensitivities.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  sorted.forEach((item, index) => {
    item.rank = index + 1;
  });

  return sorted;
}

/**
 * TornadoBar Component
 * Renders a horizontal bar showing the sensitivity range for a single input.
 */
function TornadoBar({
  item,
  maxImpact,
}: {
  item: SensitivityItem;
  maxImpact: number;
}) {
  const barWidth = Math.min(Math.abs(item.impact) / maxImpact * 100, 100);
  const isPositive = item.impact >= 0;

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Rank */}
      <div className="w-8 text-sm text-muted-foreground text-right">
        #{item.rank}
      </div>

      {/* Label */}
      <div className="w-40 shrink-0">
        <div className="text-sm font-medium truncate">{item.nodeName}</div>
        <div className="text-xs text-muted-foreground">{item.nodeType}</div>
      </div>

      {/* Tornado Bar */}
      <div className="flex-1 flex items-center">
        <div className="relative flex-1 h-8 bg-muted rounded-md overflow-hidden">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />

          {/* Impact bar */}
          <div
            className={`absolute top-1 bottom-1 rounded transition-all duration-300 ${
              isPositive ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{
              left: isPositive ? "50%" : `${50 - barWidth}%`,
              width: `${barWidth}%`,
            }}
          />

          {/* Value labels */}
          <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-white font-medium pointer-events-none">
            <span className={isPositive ? "text-transparent" : ""}>
              {item.impact < 0 ? "↓" : ""} {Math.abs(item.impact).toFixed(1)}%
            </span>
            <span className={!isPositive ? "text-transparent" : ""}>
              {item.impact > 0 ? "↑" : ""} {Math.abs(item.impact).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Impact badge */}
      <Badge variant={Math.abs(item.impact) > 5 ? "default" : "secondary"} className="shrink-0">
        {Math.abs(item.impact) > 10 ? "High" : Math.abs(item.impact) > 5 ? "Medium" : "Low"}
      </Badge>
    </div>
  );
}

export function SensitivityView({ graph, targetNodeId, className }: SensitivityViewProps) {
  // Determine target node (highest value output if not specified)
  const effectiveTargetId = useMemo(() => {
    if (targetNodeId) return targetNodeId;

    // Find output node with highest value
    const outputs = Object.values(graph.nodes).filter((n) => n.type === "output");
    const highest = outputs.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    return highest?.id;
  }, [graph, targetNodeId]);

  const targetNode = effectiveTargetId ? graph.nodes[effectiveTargetId] : null;

  // Calculate sensitivity data
  const sensitivityData = useMemo(() => {
    if (!effectiveTargetId) return [];
    return calculateSensitivity(graph, effectiveTargetId);
  }, [graph, effectiveTargetId]);

  const maxImpact = useMemo(() => {
    if (sensitivityData.length === 0) return 1;
    return Math.max(...sensitivityData.map((d) => Math.abs(d.impact)), 1);
  }, [sensitivityData]);

  if (!targetNode) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Sensitivity Analysis</CardTitle>
          <CardDescription>
            No output node found in the graph to analyze.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (sensitivityData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Sensitivity Analysis</CardTitle>
          <CardDescription>
            No input drivers found for {targetNode.label}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Sensitivity Analysis
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>
                      Shows how much each input affects the target output.
                      Higher percentages indicate inputs with greater impact.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Impact of input variations on {targetNode.label}
                <span className="text-muted-foreground ml-2">
                  (Base: {(targetNode.value ?? 0).toLocaleString()})
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded" />
              <span>Positive impact (increases output)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>Negative impact (decreases output)</span>
            </div>
          </div>

          {/* Tornado Chart */}
          <div className="space-y-1">
            {sensitivityData.map((item) => (
              <TornadoBar key={item.nodeId} item={item} maxImpact={maxImpact} />
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-semibold">{sensitivityData.length}</div>
                <div className="text-sm text-muted-foreground">Input drivers</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {maxImpact.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Max impact</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {sensitivityData.filter((d) => Math.abs(d.impact) > 5).length}
                </div>
                <div className="text-sm text-muted-foreground">High-sensitivity inputs</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default SensitivityView;
