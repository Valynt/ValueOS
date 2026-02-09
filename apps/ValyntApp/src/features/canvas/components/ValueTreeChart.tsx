import React, { useState, useCallback } from "react";
import useDataBinding from "@/sdui/useDataBinding";
import { Tree, TreeNode } from "recharts";
}
export default ValueTreeChart;
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

// Example data structure for a value tree node
export interface ValueTreeNode {
  id: string;
  label: string;
  value?: number;
  confidence?: number; // 0-1
  children?: ValueTreeNode[];
}

export interface ValueTreeChartProps {
  data: ValueTreeNode;
}

// Helper to find path from root to a node by id
function findPathToNode(root: ValueTreeNode, targetId: string, path: ValueTreeNode[] = []): ValueTreeNode[] | null {
  if (root.id === targetId) return [...path, root];
  if (!root.children) return null;
  for (const child of root.children) {
    const result = findPathToNode(child, targetId, [...path, root]);
    if (result) return result;
  }
  return null;
}


// Real-time data binding for value tree data
// (Assume a resolver/context is provided via props or context in real app)
const { value: boundData, loading } = useDataBinding(data, {
  resolver: {
    resolve: async (binding: any) => ({ success: true, value: binding, cached: false, timestamp: null }),
  },
  context: {},
  enableRefresh: true,
});

const [zoom, setZoom] = useState(1);
const [offset, setOffset] = useState({ x: 0, y: 0 });
const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
const [hoverPath, setHoverPath] = useState<ValueTreeNode[] | null>(null);

const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2));
const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
const resetZoom = () => {
  setZoom(1);
  setOffset({ x: 0, y: 0 });
};

// When hovering a node, find the path from root to that node
const handleNodeMouseEnter = useCallback((nodeId: string) => {
  setHoveredNodeId(nodeId);
  setHoverPath(findPathToNode(boundData, nodeId));
}, [boundData]);
const handleNodeMouseLeave = useCallback(() => {
  setHoveredNodeId(null);
  setHoverPath(null);
}, []);

// Render a node with hover trail effect
const renderNode = useCallback(({ x, y, node }: { x: number; y: number; node: ValueTreeNode }) => {
  const isInTrail = hoverPath?.some((n) => n.id === node.id);
  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={() => handleNodeMouseEnter(node.id)}
      onMouseLeave={handleNodeMouseLeave}
      style={{ cursor: "pointer" }}
    >
      <rect
        width={120}
        height={40}
        rx={8}
        fill={isInTrail ? "#6366f1" : "#0FBF9B"}
        opacity={isInTrail ? 0.7 : 1}
        style={{
          filter: isInTrail ? "drop-shadow(0 0 8px #818cf8)" : undefined,
          transition: "fill 0.2s, filter 0.2s, opacity 0.2s",
        }}
      />
      <text x={60} y={20} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={600}>
        {node.label}
      </text>
      {typeof node.value === "number" && (
        <text x={60} y={35} textAnchor="middle" fill="#E6EEF3" fontSize={12}>
          {node.value}
        </text>
      )}
      {typeof node.confidence === "number" && (
        <Tooltip content={`Confidence: ${(node.confidence * 100).toFixed(0)}%`}>
          <circle cx={110} cy={10} r={8} fill="#16A34A" />
        </Tooltip>
      )}
    </g>
  );
}, [hoverPath, handleNodeMouseEnter, handleNodeMouseLeave]);

// TODO: If using custom link rendering, highlight links in the path as well

if (loading) {
  return <div className="h-96 flex items-center justify-center animate-pulse text-muted-foreground">Loading value tree...</div>;
}

return (
  <Card className="p-4 relative overflow-hidden group">
    <div className="flex justify-between items-center mb-4">
      <Label className="block">Value Tree</Label>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="xs" variant="outline" onClick={handleZoomOut}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <Button size="xs" variant="outline" onClick={handleZoomIn}>
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button size="xs" variant="outline" onClick={resetZoom}>
          <Maximize className="h-3 w-3" />
        </Button>
      </div>
    </div>

    <div
      className="cursor-grab active:cursor-grabbing"
      style={{
        width: "100%",
        height: 400,
        transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`,
        transformOrigin: "center center",
        transition: "transform 0.2s ease-out",
      }}
    >
      <Tree
        width={600}
        height={400}
        data={boundData}
        nodeContent={renderNode}
      />
    </div>
    <div className="absolute bottom-4 right-4 text-[10px] text-muted-foreground bg-white/80 px-2 py-1 rounded border">
      Zoom: {(zoom * 100).toFixed(0)}%
    </div>

  </Card>
);
}


export default ValueTreeChart;
export default ValueTreeChart;
