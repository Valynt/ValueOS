/**
 * Orchestration Layer: AgentStatusIndicator
 * Visual indicator of agent state with "breathing" animation
 */

import { AlertCircle, CheckCircle, Loader2, Sparkles } from "lucide-react";

import type { AgentState } from "@/hooks/useAgentOrchestrator";

interface AgentStatusIndicatorProps {
  state: AgentState;
  currentStep?: string;
  className?: string;
}

export function AgentStatusIndicator({
  state,
  currentStep,
  className = "",
}: AgentStatusIndicatorProps) {
  const getStateConfig = () => {
    switch (state) {
      case "IDLE":
        return {
          icon: <Sparkles className="h-4 w-4" />,
          label: "Ready",
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          animate: false,
        };
      case "PLANNING":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: "Thinking",
          color: "text-brand-indigo",
          bgColor: "bg-brand-indigo/10",
          animate: "glow",
        };
      case "EXECUTING":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: currentStep || "Thinking",
          color: "text-brand-indigo",
          bgColor: "bg-brand-indigo/10",
          animate: "glow",
        };
      case "ERROR":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          label: "Error",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          animate: false,
        };
      default:
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: "Unknown",
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          animate: false,
        };
    }
  };

  const config = getStateConfig();

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${config.bgColor} ${config.color} ${
        config.animate === "glow" ? "agent-glow" : config.animate ? "animate-pulse-glow" : ""
      } ${className}`}
    >
      {config.icon}
      <span className="font-medium">{config.label}</span>
    </div>
  );
}

export default AgentStatusIndicator;
