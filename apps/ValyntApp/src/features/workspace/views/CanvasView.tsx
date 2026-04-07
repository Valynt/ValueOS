/**
 * CanvasView — Canvas mode view wrapping React Flow
 *
 * Phase 2: Workspace Core
 */

import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";

import type { WarmthState } from "@shared/domain/Warmth";
import "@xyflow/react/dist/style.css";

import type { Graph } from "@/features/living-value-graph/types/graph.types";

interface CanvasViewProps {
  graph: Graph | null;
  warmth: WarmthState;
  onNodeSelect: (nodeId: string) => void;
  onNodeUpdate?: (nodeId: string, updates: Record<string, unknown>) => void;
  isUpdating?: boolean;
}

export function CanvasView({
  graph,
  warmth,
  onNodeSelect,
  onNodeUpdate,
  isUpdating
}: CanvasViewProps): JSX.Element {
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
