import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";
import type { WarmthModifier, WarmthState } from "@/lib/warmth";

import { WarmthBadge } from "./WarmthBadge";

interface OperationalState {
  sagaState: string;
  confidence: number;
  blockingReasons: string[];
  lastAgentAction?: string;
}

interface WarmthHeaderProps {
  title: string;
  warmth: WarmthState;
  modifier?: WarmthModifier | null;
  operationalState?: OperationalState;
  onDeepStateToggle?: () => void;
  actions?: ReactNode;
}

export function WarmthHeader({
  title,
  warmth,
  modifier,
  operationalState,
  onDeepStateToggle,
  actions,
}: WarmthHeaderProps) {
  const [deepStateOpen, setDeepStateOpen] = useState(false);

  const handleToggle = () => {
    setDeepStateOpen((prev) => !prev);
    onDeepStateToggle?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <WarmthBadge warmth={warmth} modifier={modifier} showLabel size="md" />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggle}
            aria-label={deepStateOpen ? "Hide details" : "Show details"}
            aria-expanded={deepStateOpen}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              "transition-colors",
            )}
          >
            {deepStateOpen ? "Hide details" : "Show details"}
            {deepStateOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {actions}
        </div>
      </div>

      {deepStateOpen && operationalState && (
        <div
          role="region"
          aria-label="Operational state details"
          className="rounded-md border bg-muted/30 p-3 text-xs space-y-1"
        >
          <div className="flex gap-4">
            <span className="text-muted-foreground">Stage:</span>
            <span className="font-mono font-medium">
              {operationalState.sagaState}
            </span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground">Confidence:</span>
            <span className="font-medium">
              {Math.round(operationalState.confidence * 100)}%
            </span>
          </div>
          {operationalState.lastAgentAction && (
            <div className="flex gap-4">
              <span className="text-muted-foreground">Last agent:</span>
              <span>{operationalState.lastAgentAction}</span>
            </div>
          )}
          {operationalState.blockingReasons.length > 0 && (
            <div className="flex gap-4">
              <span className="text-muted-foreground">Blocking:</span>
              <span className="text-amber-600">
                {operationalState.blockingReasons.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
