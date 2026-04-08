/**
 * ActivityFeed — Warmth-sorted case feed for the dashboard.
 *
 * Replaces NeedsInputQueue + RecentActivity with a unified, warmth-sorted feed.
 * Needs-input cases appear first, then forming → firm → verified, then by recency.
 */

import { ChevronRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { WarmthBadge } from "@/components/warmth/WarmthBadge";
import {
  deriveCaseDisplayFields,
  deriveWarmthFromCase,
  sortByWarmthPriority,
} from "@/lib/case-utils";
import type { ValueCaseWithRelations } from "@/lib/supabase/types";
import { deriveWarmth } from "@/lib/warmth";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  cases: ValueCaseWithRelations[];
  isLoading: boolean;
  maxItems?: number;
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          data-skeleton="true"
          className="animate-pulse flex items-center gap-3 p-3 rounded-xl border border-zinc-100"
        >
          <div className="w-16 h-5 bg-zinc-200 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-40 bg-zinc-200 rounded" />
            <div className="h-3 w-56 bg-zinc-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function stageToSagaState(stage: string | null): string {
  const s = stage?.toLowerCase() ?? "";
  if (s.includes("discovery")) return "INITIATED";
  if (s.includes("target")) return "VALIDATING";
  if (s.includes("narrat")) return "REFINING";
  if (s.includes("realiz")) return "FINALIZED";
  if (s.includes("expan")) return "FINALIZED";
  return "INITIATED";
}

export function ActivityFeed({
  cases,
  isLoading,
  maxItems = 10,
}: ActivityFeedProps) {
  if (isLoading) {
    return <SkeletonRows />;
  }

  if (cases.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-zinc-400">No active cases yet</p>
      </div>
    );
  }

  const sorted = sortByWarmthPriority(cases).slice(0, maxItems);

  return (
    <div className="space-y-1">
      {sorted.map((c) => {
        const fields = deriveCaseDisplayFields(c);
        const warmthState = deriveWarmthFromCase(c);
        const sagaState = stageToSagaState(c.stage);
        const warmthResult = deriveWarmth(sagaState, c.quality_score);

        return (
          <Link
            key={c.id}
            to={`/case/${c.id}`}
            data-case-id={c.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-100 group",
              fields.status === "needs-input" && "border-l-2 border-l-amber-400",
            )}
          >
            <WarmthBadge
              warmth={warmthResult.state}
              modifier={warmthResult.modifier}
              size="sm"
              showLabel
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">
                {fields.companyName}
              </p>
              <p className="text-xs text-zinc-400 truncate">
                {fields.nextAction}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-zinc-900">{fields.value}</p>
              <p className="text-[11px] text-zinc-400">{fields.lastActivity}</p>
            </div>

            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
