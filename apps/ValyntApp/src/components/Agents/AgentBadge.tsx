import React from "react";

export interface AgentBadgeProps {
  agentId?: string;
  name?: string;
  status?: "active" | "idle" | "error";
  confidence?: number;
  className?: string;
}

export function AgentBadge({ name, status = "idle", className }: AgentBadgeProps) {
  return <span className={className} data-status={status}>{name ?? "Agent"}</span>;
}

export default AgentBadge;
