/**
 * CanvasView — Canvas mode view wrapping React Flow
 *
 * Phase 2: Workspace Core
 */

import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";

import type { WarmthState } from "@shared/domain/Warmth";
import "@xyflow/react/dist/style.css";

interface GraphNode {
  id: string;
  type: "driver" | "metric" | "input" | "output";
  label: string;
  value: number;
  confidence: number;
  evidence: unknown[];
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface Graph {
  id: string;
  versionId: string;
  scenarioId: string;
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
  computedAt: string;
  globalMetrics: {
    npv: number;
    confidence: number;
    defensibilityScore: number;
  };
  evidenceCoverage: number;
}

interface CanvasViewProps {
  graph: Graph | null;
  warmth: WarmthState;
  onNodeSelect: (nodeId: string) => void;
}

export function CanvasView({ graph, warmth, onNodeSelect }: CanvasViewProps): JSX.Element {
  if (!graph) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        No value tree data available
      </div>
    );
  }

  const warmthBgClass = {
    forming: "bg-amber-50/30",
    firm: "bg-blue-50/30",
    verified: "bg-emerald-50/30",
  }[warmth];

  return (
    <div className={`h-full ${warmthBgClass}`}>
      <ReactFlow
        data-testid="react-flow"
        fitView
        className="bg-gray-50"
      >
        <Background data-testid="rf-background" />
        <Controls data-testid="rf-controls" />
        <MiniMap data-testid="rf-minimap" />
      </ReactFlow>
    </div>
  );
}

export default CanvasView;
