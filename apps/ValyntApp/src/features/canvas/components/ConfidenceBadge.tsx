import React from "react";

import { Tooltip } from "@/components/ui/tooltip";

export interface ConfidenceBadgeProps {
  confidence: number; // 0-1
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  let label = "Low";
  let badgeClass = "inline-block rounded-full px-2 py-0.5 text-xs font-semibold ml-2";
  if (confidence > 0.8) {
    badgeClass += " bg-green-600 text-white";
    label = "High";
  } else if (confidence > 0.5) {
    badgeClass += " bg-yellow-500 text-white";
    label = "Medium";
  } else {
    badgeClass += " bg-gray-400 text-white";
  }
  return (
    <Tooltip content={`Confidence: ${(confidence * 100).toFixed(0)}%`}>
      <span className={badgeClass}>{label}</span>
    </Tooltip>
  );
};
