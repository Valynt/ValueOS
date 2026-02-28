/**
 * PhaseIndicator — Visual badge showing the current agent phase
 * with color coding and animation matching the 7-state model.
 */

import React from "react";

import { AGENT_STATE_CONFIG } from "../state-machine";
import type { AgentPhase } from "../types";
import { useAgentPhase } from "../useAgentPhase";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PhaseIndicatorProps {
  /** Override phase (otherwise reads from store) */
  phase?: AgentPhase;
  /** Show animation dot */
  showDot?: boolean;
  className?: string;
}

export function PhaseIndicator({
  phase: phaseProp,
  showDot = true,
  className,
}: PhaseIndicatorProps) {
  const { phase: storePhase } = useAgentPhase();
  const phase = phaseProp ?? storePhase;
  const config = AGENT_STATE_CONFIG[phase];

  return (
    <Badge
      className={cn(
        "gap-1.5 text-xs font-medium border",
        config.color,
        config.textColor,
        config.borderColor,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            phase === "idle" && "bg-primary animate-breathe",
            phase === "clarify" && "bg-warning animate-pulse-subtle",
            phase === "plan" && "bg-blue-500",
            phase === "execute" && "bg-success animate-ping",
            phase === "review" && "bg-violet-500",
            phase === "finalize" && "bg-success",
            phase === "resume" && "bg-cyan-500 animate-pulse-subtle"
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}
