/**
 * WarmthSummary — Dashboard stat cards showing case counts per warmth tier.
 *
 * Renders three clickable cards (forming | firm | verified) with case counts,
 * total projected value, and links to the filtered case list.
 */

import { Flame, CheckCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { deriveWarmthFromCase, groupCasesByWarmth, getTotalValueByWarmth } from "@/lib/case-utils";
import type { ValueCaseWithRelations } from "@/lib/supabase/types";
import type { WarmthState } from "@/lib/warmth";
import { cn } from "@/lib/utils";

interface WarmthSummaryProps {
  cases: ValueCaseWithRelations[];
  isLoading: boolean;
}

const CARD_CONFIG: Record<
  WarmthState,
  {
    label: string;
    icon: typeof Flame;
    className: string;
    iconClassName: string;
  }
> = {
  forming: {
    label: "Forming",
    icon: Flame,
    className: "border-dashed border-amber-300 bg-amber-50",
    iconClassName: "text-amber-500",
  },
  firm: {
    label: "Firm",
    icon: CheckCircle,
    className: "border-solid border-blue-200 bg-white",
    iconClassName: "text-blue-500",
  },
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    className: "border-solid border-blue-500 bg-blue-50",
    iconClassName: "text-blue-600",
  },
};

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-skeleton="true"
          className="animate-pulse rounded-2xl border border-zinc-200 p-5 h-28"
        >
          <div className="h-4 w-20 bg-zinc-200 rounded mb-3" />
          <div className="h-6 w-16 bg-zinc-200 rounded mb-2" />
          <div className="h-3 w-24 bg-zinc-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function WarmthSummary({ cases, isLoading }: WarmthSummaryProps) {
  if (isLoading) {
    return <SkeletonCards />;
  }

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-700 mb-1">
          Start your first value case
        </p>
        <p className="text-xs text-zinc-400">
          Enter a company name to begin building a defensible value case.
        </p>
      </div>
    );
  }

  const counts = groupCasesByWarmth(cases);
  const totals = getTotalValueByWarmth(cases);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(["forming", "firm", "verified"] as const).map((warmth) => {
        const config = CARD_CONFIG[warmth];
        const Icon = config.icon;
        const count = counts[warmth];
        const total = totals[warmth];

        return (
          <Link
            key={warmth}
            to={`/work/cases?warmth=${warmth}`}
            data-warmth={warmth}
            className={cn(
              "rounded-2xl border p-5 hover:shadow-md transition-all group",
              config.className,
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn("w-4 h-4", config.iconClassName)} />
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                {config.label}
              </span>
            </div>
            <p className="text-2xl font-black text-zinc-950 tracking-tight">
              {count}
              <span className="text-sm font-medium text-zinc-400 ml-1">
                {count === 1 ? "case" : "cases"}
              </span>
            </p>
            {total > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                {formatValue(total)} projected
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
