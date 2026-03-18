/**
 * SourceBadge
 *
 * Displays a source type with distinct icon and color.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §1.3
 */

import React from "react";
import {
  UserCheck,
  Database,
  Phone,
  BarChart3,
  FileText,
  Brain,
  Edit3,
  HelpCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

export type SourceType =
  | "customer-confirmed"
  | "CRM-derived"
  | "call-derived"
  | "benchmark-derived"
  | "SEC-filing"
  | "inferred"
  | "manually-overridden"
  | "note-derived"
  | "externally-researched";

export type TierLevel = 1 | 2 | 3;

interface SourceConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
  tier: TierLevel;
}

const sourceConfigMap: Record<SourceType, SourceConfig> = {
  "customer-confirmed": {
    icon: UserCheck,
    label: "Customer Confirmed",
    colorClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    tier: 1,
  },
  "CRM-derived": {
    icon: Database,
    label: "CRM Derived",
    colorClass: "bg-blue-100 text-blue-800 border-blue-200",
    tier: 2,
  },
  "call-derived": {
    icon: Phone,
    label: "Call Derived",
    colorClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
    tier: 2,
  },
  "benchmark-derived": {
    icon: BarChart3,
    label: "Benchmark Derived",
    colorClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
    tier: 2,
  },
  "SEC-filing": {
    icon: FileText,
    label: "SEC Filing",
    colorClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    tier: 1,
  },
  inferred: {
    icon: Brain,
    label: "Inferred",
    colorClass: "bg-amber-100 text-amber-800 border-amber-200",
    tier: 3,
  },
  "manually-overridden": {
    icon: Edit3,
    label: "Manually Overridden",
    colorClass: "bg-orange-100 text-orange-800 border-orange-200",
    tier: 1,
  },
  "note-derived": {
    icon: FileText,
    label: "Note Derived",
    colorClass: "bg-violet-100 text-violet-800 border-violet-200",
    tier: 2,
  },
  "externally-researched": {
    icon: Database,
    label: "Externally Researched",
    colorClass: "bg-purple-100 text-purple-800 border-purple-200",
    tier: 2,
  },
};

function getTierBadgeClass(tier: TierLevel): string {
  switch (tier) {
    case 1:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case 2:
      return "bg-blue-50 text-blue-700 border-blue-200";
    case 3:
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export interface SourceBadgeProps {
  sourceType: SourceType | string;
  className?: string;
  showTier?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "md";
}

export function SourceBadge({
  sourceType,
  className = "",
  showTier = true,
  showTooltip = true,
  size = "md",
}: SourceBadgeProps) {
  const config = sourceConfigMap[sourceType as SourceType] || {
    icon: HelpCircle,
    label: sourceType,
    colorClass: "bg-gray-100 text-gray-800 border-gray-200",
    tier: 3,
  };

  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.colorClass} ${sizeClasses} ${className}`}
      aria-label={`Source: ${config.label}, Tier ${config.tier}`}
    >
      <Icon className={iconSize} />
      <span>{config.label}</span>
      {showTier && (
        <span
          className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${getTierBadgeClass(
            config.tier
          )}`}
        >
          T{config.tier}
        </span>
      )}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">
              Evidence Tier {config.tier} —{" "}
              {config.tier === 1
                ? "High confidence (customer confirmed, regulatory filing)"
                : config.tier === 2
                  ? "Medium confidence (system derived, benchmark)"
                  : "Low confidence (inferred, needs verification)"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Get tier level for a source type
 */
export function getSourceTier(sourceType: SourceType | string): TierLevel {
  return sourceConfigMap[sourceType as SourceType]?.tier || 3;
}
