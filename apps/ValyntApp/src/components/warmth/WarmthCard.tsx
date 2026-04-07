import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { WarmthModifier, WarmthState } from "@/lib/warmth";

const WARMTH_CLASSES: Record<WarmthState, string> = {
  forming: "warmth-forming",
  firm: "warmth-firm",
  verified: "warmth-verified",
};

interface WarmthCardProps {
  warmth: WarmthState;
  modifier?: WarmthModifier | null;
  children: ReactNode;
  className?: string;
}

export function WarmthCard({
  warmth,
  children,
  className,
}: WarmthCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        WARMTH_CLASSES[warmth],
        className,
      )}
    >
      {children}
    </div>
  );
}
