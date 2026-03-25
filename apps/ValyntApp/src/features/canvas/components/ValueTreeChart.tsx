import { useDataBindings as useDataBinding } from "@sdui/useDataBinding";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useState } from "react";
import { Treemap } from "recharts";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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



export function ValueTreeChart({ data }: ValueTreeChartProps) {
  // Real-time data binding for value tree data
  const { value: boundData, loading } = useDataBinding(data as unknown as Parameters<typeof useDataBinding>[0], {
    resolver: {
      resolve: async (binding: unknown) => ({ success: true, value: binding as ValueTreeNode, cached: false, timestamp: new Date().toISOString(), source: "static" as const }),
    },
    context: { organizationId: "default", projectId: "default" },
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
    setHoverPath(findPathToNode(boundData as ValueTreeNode, nodeId));
  }, [boundData]);
  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
    setHoverPath(null);
  }, []);

  // Render a node with hover trail effect
  const renderNode = useCallback((props: {
    x: number; y: number; width: number; height: number;
    node?: ValueTreeNode;
    children?: Array<{ x: number; y: number; node?: ValueTreeNode }>;
  }) => {
    const { x, y, node, children } = props;
    if (!node) return null;

    const isInTrail = hoverPath?.some((n) => n.id === node.id);

    return (
      <g>
        {/* Render links to children before the node itself so they appear behind */}
        {children && children.length > 0 && children.map((child) => {
          if (!child.node) return null;

          const isChildInTrail = hoverPath?.some((n) => n.id === child.node.id);
          const isLinkHighlighted = isInTrail && isChildInTrail;

          // Parent node center
          const startX = x + 60; // 120 / 2
          const startY = y + 20; // 40 / 2

          // Child node center
          const endX = child.x + 60;
          const endY = child.y + 20;

          return (
            <line
              key={`link-${node.id}-${child.node.id}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={isLinkHighlighted ? "#6366f1" : "#cbd5e1"}
              strokeWidth={isLinkHighlighted ? 2 : 1}
              style={{
                transition: "stroke 0.2s, stroke-width 0.2s",
                filter: isLinkHighlighted ? "drop-shadow(0 0 4px #818cf8)" : undefined,
                pointerEvents: "none", // Prevent links from interfering with node hover
              }}
            />
          );
        })}

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <circle cx={110} cy={10} r={8} fill="#16A34A" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Confidence: ${(node.confidence * 100).toFixed(0)}%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </g>
      </g>
    );
  }, [hoverPath, handleNodeMouseEnter, handleNodeMouseLeave]);

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
        <Treemap
          width={600}
          height={400}
          data={Array.isArray(boundData) ? boundData : [boundData]}
          content={renderNode as Parameters<typeof Treemap>[0]["content"]}
        />
      </div>
      <div className="absolute bottom-4 right-4 text-[10px] text-muted-foreground bg-white/80 px-2 py-1 rounded border">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>

    </Card>
  );
}
