import React, { useState } from "react";
import { Tree, TreeNode } from "recharts";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

export const ValueTreeChart: React.FC<ValueTreeChartProps> = ({ data }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Recharts Tree expects a hierarchical data structure
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
          data={data}
          nodeContent={({ x, y, node }) => (
            <g transform={`translate(${x},${y})`}>
              <rect width={120} height={40} rx={8} fill="#0FBF9B" />
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
          )}
        />
      </div>
      <div className="absolute bottom-4 right-4 text-[10px] text-muted-foreground bg-white/80 px-2 py-1 rounded border">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>
    </Card>
  );
};
