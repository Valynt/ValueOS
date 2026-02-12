import React from "react";
export interface ConfidenceIndicatorProps { value?: number; className?: string; }
export function ConfidenceIndicator({ value = 0, className }: ConfidenceIndicatorProps) {
  return <span className={className}>{Math.round(value * 100)}%</span>;
}
export default ConfidenceIndicator;
