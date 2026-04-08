/**
 * FilterBar — Warmth filter tabs + search for the case listing page.
 *
 * Renders warmth state tabs with count badges and a search input.
 */

import { Search } from "lucide-react";

import type { WarmthState } from "@/lib/warmth";
import { cn } from "@/lib/utils";

type WarmthFilter = WarmthState | "all";

interface WarmthCounts {
  forming: number;
  firm: number;
  verified: number;
}

interface FilterBarProps {
  warmthFilter: WarmthFilter;
  searchQuery: string;
  onWarmthChange: (warmth: WarmthFilter) => void;
  onSearchChange: (query: string) => void;
  counts: WarmthCounts;
}

const TABS: Array<{ value: WarmthFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "forming", label: "Forming" },
  { value: "firm", label: "Firm" },
  { value: "verified", label: "Verified" },
];

export function FilterBar({
  warmthFilter,
  searchQuery,
  onWarmthChange,
  onSearchChange,
  counts,
}: FilterBarProps) {
  const totalCount = counts.forming + counts.firm + counts.verified;

  function getCount(tab: WarmthFilter): number {
    if (tab === "all") return totalCount;
    return counts[tab];
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-1" role="group" aria-label="Warmth filter">
        {TABS.map((tab) => {
          const isActive = warmthFilter === tab.value;
          const count = getCount(tab.value);

          return (
            <button
              key={tab.value}
              type="button"
              role="button"
              aria-pressed={isActive}
              data-active={isActive}
              onClick={() => onWarmthChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                  isActive ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-500",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="search"
          role="searchbox"
          placeholder="Search cases..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition-colors"
        />
      </div>
    </div>
  );
}
