import React from "react";
import { Tree, TreeNode } from "recharts";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";

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
  // Recharts Tree expects a hierarchical data structure
  return (
    <Card className="p-4">
      <Label className="mb-2 block">Value Tree</Label>
      <div style={{ width: "100%", height: 400 }}>
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
    </Card>
  );
};
