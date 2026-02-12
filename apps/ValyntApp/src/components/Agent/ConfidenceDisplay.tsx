import React from "react";
export interface ConfidenceDisplayProps { value?: number; label?: string; className?: string; }
export function ConfidenceDisplay({ value = 0, label, className }: ConfidenceDisplayProps) {
  return <div className={className}><span>{label}</span><span>{Math.round(value * 100)}%</span></div>;
}
export default ConfidenceDisplay;
