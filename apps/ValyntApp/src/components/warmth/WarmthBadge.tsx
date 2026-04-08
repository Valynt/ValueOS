import { AlertTriangle, CheckCircle, Flame, ShieldCheck, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { WarmthModifier, WarmthState } from "@/lib/warmth";

const ICON_MAP: Record<string, (props: { className?: string }) => ReactNode> = {
  flame: Flame,
  "check-circle": CheckCircle,
  "shield-check": ShieldCheck,
  "trending-up": TrendingUp,
  "alert-triangle": AlertTriangle,
};

const STATE_CONFIG: Record<
  WarmthState,
  { icon: string; label: string; className: string }
> = {
  forming: {
    icon: "flame",
    label: "Forming",
    className: "border-dashed border-amber-300 bg-amber-50 text-amber-700",
  },
  firm: {
    icon: "check-circle",
    label: "Firm",
    className: "border-solid border-blue-200 bg-white text-slate-900",
  },
  verified: {
    icon: "shield-check",
    label: "Verified",
    className: "border-solid border-blue-500 bg-blue-50 text-blue-900",
  },
};

const MODIFIER_CONFIG: Record<string, { icon: string; label: string }> = {
  firming: { icon: "trending-up", label: "Firming up" },
  needs_review: { icon: "alert-triangle", label: "Needs review" },
};

const SIZE_MAP = {
  sm: { badge: "px-1.5 py-0.5 text-[10px] gap-1", icon: "w-3 h-3" },
  md: { badge: "px-2 py-1 text-xs gap-1.5", icon: "w-3.5 h-3.5" },
  lg: { badge: "px-3 py-1.5 text-sm gap-2", icon: "w-4 h-4" },
};

interface WarmthBadgeProps {
  warmth: WarmthState;
  modifier?: WarmthModifier | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function WarmthBadge({
  warmth,
  modifier,
  size = "md",
  showLabel = false,
}: WarmthBadgeProps) {
  const config = STATE_CONFIG[warmth];
  const sizeTokens = SIZE_MAP[size];
  const Icon = ICON_MAP[config.icon];
  const modConfig = modifier ? MODIFIER_CONFIG[modifier] : null;
  const ModIcon = modConfig ? ICON_MAP[modConfig.icon] : null;

  const ariaLabel = modConfig
    ? `${config.label} — ${modConfig.label}`
    : config.label;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.className,
        sizeTokens.badge,
      )}
    >
      {Icon && <Icon className={sizeTokens.icon} />}
      {showLabel && <span>{config.label}</span>}
      {ModIcon && modConfig && (
        <span data-modifier={modifier} className="inline-flex items-center">
          <ModIcon className={cn(sizeTokens.icon, "text-amber-600")} />
        </span>
      )}
    </span>
  );
}
