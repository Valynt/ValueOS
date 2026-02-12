import React from "react";
export interface WorkflowStatusBarProps { status?: string; progress?: number; className?: string; }
export function WorkflowStatusBar({ status, progress, className }: WorkflowStatusBarProps) {
  return <div className={className} role="progressbar" aria-valuenow={progress}>{status}</div>;
}
export default WorkflowStatusBar;
