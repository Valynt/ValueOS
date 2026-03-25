/**
 * ValueGraphVisualization — SDUI component (ValyntApp-scoped)
 *
 * ReactFlow-based interactive canvas for the Value Graph. Lives in ValyntApp
 * (not packages/sdui) to keep the reactflow dependency scoped to this app.
 *
 * Features:
 *   - Nodes color-coded by entity type
 *   - elkjs automated directed-graph layout
 *   - Click a node → fires onNodeSelect(entityType, entityId)
 *   - Pan / zoom / minimap via ReactFlow built-ins
 *   - Loading skeleton while data fetches
 *
 * Registered as intentType "show_value_graph" in both:
 *   - scripts/config/ui-registry.json
 *   - packages/sdui/src/registry.tsx  (stub entry pointing here)
 *
 * Sprint 50: Initial implementation.
 */

import ELK from "elkjs/lib/elk.bundled.js";
import React, { useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import type { ValueGraphEdge, ValueGraphEntityType } from "@/api/valueGraph";
import { useValueGraph } from "@/hooks/useValueGraph";

// ---------------------------------------------------------------------------
// Entity type → Tailwind color tokens
// ---------------------------------------------------------------------------

const ENTITY_COLORS: Record<ValueGraphEntityType, string> = {
  account: "bg-blue-500",
  stakeholder: "bg-violet-500",
  use_case: "bg-amber-500",
  vg_capability: "bg-emerald-500",
  vg_metric: "bg-pink-500",
  vg_value_driver: "bg-orange-500",
  evidence: "bg-zinc-400",
  value_hypothesis: "bg-indigo-500",
};

const ENTITY_LABELS: Record<ValueGraphEntityType, string> = {
  account: "Account",
  stakeholder: "Stakeholder",
  use_case: "Use Case",
  vg_capability: "Capability",
  vg_metric: "Metric",
  vg_value_driver: "Value Driver",
  evidence: "Evidence",
  value_hypothesis: "Hypothesis",
};

// ---------------------------------------------------------------------------
// Custom node component
// ---------------------------------------------------------------------------

interface VgNodeData {
  label: string;
  entityType: ValueGraphEntityType;
  entityId: string;
}

function VgNode({ data }: NodeProps<VgNodeData>) {
  const dotColor = ENTITY_COLORS[data.entityType] ?? "bg-zinc-400";
  const typeLabel = ENTITY_LABELS[data.entityType] ?? data.entityType;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 min-w-[140px] max-w-[200px]">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide truncate">
          {typeLabel}
        </span>
      </div>
      <p className="text-xs font-medium text-zinc-800 leading-snug line-clamp-2">
        {data.label}
      </p>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </div>
  );
}

const NODE_TYPES = { vgNode: VgNode };

// ---------------------------------------------------------------------------
// ELK layout helper
// ---------------------------------------------------------------------------

const elk = new ELK();

const ELK_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "60",
  "elk.spacing.nodeNode": "40",
};

async function applyElkLayout(
  nodes: Node[],
  edges: Edge[]
): Promise<Node[]> {
  const elkGraph = {
    id: "root",
    layoutOptions: ELK_OPTIONS,
    children: nodes.map((n) => ({
      id: n.id,
      width: 180,
      height: 64,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const laid = await elk.layout(elkGraph);

  return nodes.map((n) => {
    const elkNode = laid.children?.find((c) => c.id === n.id);
    return {
      ...n,
      position: {
        x: elkNode?.x ?? 0,
        y: elkNode?.y ?? 0,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function GraphSkeleton() {
  return (
    <div
      className="w-full h-full flex items-center justify-center bg-zinc-50"
      data-testid="graph-skeleton"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Loading value graph…</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ValueGraphVisualizationProps {
  opportunityId: string;
  organizationId?: string;
  /** Called when the user clicks a node. Wire to RightInspector in parent. */
  onNodeSelect?: (entityType: ValueGraphEntityType, entityId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ValueGraphVisualization({
  opportunityId,
  onNodeSelect,
  className = "",
}: ValueGraphVisualizationProps) {
  const { data, isLoading, isError } = useValueGraph(opportunityId);

  const [nodes, setNodes, onNodesChange] = useNodesState<VgNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Build ReactFlow nodes/edges from graph data, then apply ELK layout.
  // The cleanup flag prevents setState calls on an unmounted component if
  // ELK resolves after the component has been torn down.
  useEffect(() => {
    if (!data?.graph) return;

    let cancelled = false;
    const { graph } = data;

    const rfNodes: Node<VgNodeData>[] = graph.nodes.map((n) => {
      const label =
        (n.data as Record<string, unknown>)["name"] as string ??
        (n.data as Record<string, unknown>)["title"] as string ??
        n.entity_id.slice(0, 8);

      return {
        id: `${n.entity_type}:${n.entity_id}`,
        type: "vgNode",
        position: { x: 0, y: 0 }, // overwritten by ELK
        data: {
          label,
          entityType: n.entity_type,
          entityId: n.entity_id,
        },
      };
    });

    const rfEdges: Edge[] = graph.edges.map((e: ValueGraphEdge) => ({
      id: e.id,
      source: `${e.from_entity_type}:${e.from_entity_id}`,
      target: `${e.to_entity_type}:${e.to_entity_id}`,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#d1d5db", strokeWidth: 1.5 },
    }));

    void applyElkLayout(rfNodes, rfEdges).then((laidOut) => {
      if (cancelled) return;
      setNodes(laidOut);
      setEdges(rfEdges);
    });

    return () => {
      cancelled = true;
    };
  }, [data, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<VgNodeData>) => {
      onNodeSelect?.(node.data.entityType, node.data.entityId);
    },
    [onNodeSelect]
  );

  if (isLoading) return <GraphSkeleton />;

  if (isError || !data) {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-zinc-50"
        data-testid="graph-error"
      >
        <p className="text-sm text-zinc-500">
          Could not load the value graph. Try refreshing.
        </p>
      </div>
    );
  }

  if (data.graph.nodes.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-zinc-50"
        data-testid="graph-empty"
      >
        <p className="text-sm text-zinc-500">
          No graph data yet. Agents will populate this as they run.
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className}`} data-testid="value-graph-visualization">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-right"
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(_n: Node) => "#6b7280"}
          maskColor="rgba(255,255,255,0.7)"
        />
      </ReactFlow>
    </div>
  );
}

ValueGraphVisualization.displayName = "ValueGraphVisualization";
