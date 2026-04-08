/**
 * CaseListPage — Case listing with warmth filters (/work/cases)
 *
 * Renders FilterBar + warmth-sorted case rows. Filter state lives in URL
 * search params so links from WarmthSummary cards work.
 */

import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { WarmthBadge } from "@/components/warmth/WarmthBadge";
import { useCasesList } from "@/hooks/useCases";
import {
  deriveCaseDisplayFields,
  deriveWarmthFromCase,
  groupCasesByWarmth,
  sortByWarmthPriority,
} from "@/lib/case-utils";
import type { ValueCaseWithRelations } from "@/lib/supabase/types";
import { deriveWarmth } from "@/lib/warmth";
import type { WarmthState } from "@/lib/warmth";
import { cn } from "@/lib/utils";

import { FilterBar } from "./components/FilterBar";

type WarmthFilter = WarmthState | "all";

function stageToSagaState(stage: string | null): string {
  const s = stage?.toLowerCase() ?? "";
  if (s.includes("discovery")) return "INITIATED";
  if (s.includes("target")) return "VALIDATING";
  if (s.includes("narrat")) return "REFINING";
  return "INITIATED";
}

function CaseRow({ c }: { c: ValueCaseWithRelations }) {
  const fields = deriveCaseDisplayFields(c);
  const sagaState = stageToSagaState(c.stage);
  const warmthResult = deriveWarmth(sagaState, c.quality_score);

  return (
    <Link
      to={`/case/${c.id}`}
      className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all group"
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
        <p className="text-xs text-zinc-400 truncate">{fields.nextAction}</p>
      </div>

      {c.domain_packs && (
        <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-zinc-100 text-zinc-500">
          {c.domain_packs.industry}
        </span>
      )}

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-zinc-900">{fields.value}</p>
        <p className="text-[11px] text-zinc-400">{fields.lastActivity}</p>
      </div>
    </Link>
  );
}

function CaseListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-center gap-4 p-4 rounded-xl border border-zinc-100"
        >
          <div className="w-16 h-5 bg-zinc-200 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-48 bg-zinc-200 rounded" />
            <div className="h-3 w-64 bg-zinc-100 rounded" />
          </div>
          <div className="h-4 w-12 bg-zinc-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export function CaseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const warmthFilter = (searchParams.get("warmth") ?? "all") as WarmthFilter;
  const searchQuery = searchParams.get("q") ?? "";

  const { data: cases, isLoading } = useCasesList();
  const activeCases = useMemo(
    () => (cases ?? []).filter((c) => c.status !== "archived"),
    [cases],
  );

  const counts = useMemo(() => groupCasesByWarmth(activeCases), [activeCases]);

  const filtered = useMemo(() => {
    let result = activeCases;

    if (warmthFilter !== "all") {
      result = result.filter((c) => deriveWarmthFromCase(c) === warmthFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const name = c.company_profiles?.company_name ?? c.name;
        return name.toLowerCase().includes(q);
      });
    }

    return sortByWarmthPriority(result);
  }, [activeCases, warmthFilter, searchQuery]);

  const handleWarmthChange = useCallback(
    (warmth: WarmthFilter) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (warmth === "all") {
          next.delete("warmth");
        } else {
          next.set("warmth", warmth);
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (query) {
          next.set("q", query);
        } else {
          next.delete("q");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-zinc-950 tracking-tight">
            My Work
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {activeCases.length} {activeCases.length === 1 ? "case" : "cases"}
          </p>
        </div>
        <Link
          to="/work/cases/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Case
        </Link>
      </div>

      <FilterBar
        warmthFilter={warmthFilter}
        searchQuery={searchQuery}
        onWarmthChange={handleWarmthChange}
        onSearchChange={handleSearchChange}
        counts={counts}
      />

      {isLoading ? (
        <CaseListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-zinc-500">No cases match your filters</p>
          <p className="text-xs text-zinc-400 mt-1">
            Try adjusting your filters or create a new case.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <CaseRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
