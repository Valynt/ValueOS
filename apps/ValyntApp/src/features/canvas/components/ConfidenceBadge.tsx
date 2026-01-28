import React from "react";
import { Tooltip } from "@/components/ui/tooltip";

export interface ConfidenceBadgeProps {
  confidence: number; // 0-1
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  let color = "#9AA6B2";
  let label = "Low";
  if (confidence > 0.8) {
    color = "#16A34A";
    label = "High";
  } else if (confidence > 0.5) {
    color = "#F59E0B";
    label = "Medium";
  }
  return (
    <Tooltip content={`Confidence: ${(confidence * 100).toFixed(0)}%`}>
      <span
        style={{
          display: "inline-block",
          background: color,
          color: "#fff",
          borderRadius: 12,
          padding: "2px 10px",
          fontSize: 12,
          fontWeight: 600,
          marginLeft: 8,
        }}
      >
        {label}
      </span>
    </Tooltip>
  );
};
