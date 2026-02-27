/**
 * HomePage - ValueOS Home
 *
 * Greeting, continue where you left off, quick actions, recent cases.
 * Fetches real user/org data from auth and tenant contexts,
 * and recent cases from Supabase.
 */

import { useNavigate } from "react-router-dom";
import {
  FileText,
  ArrowRight,
  Search,
  Upload,
  MessageSquare,
  TrendingUp,
  Play,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useRecentCases } from "@/hooks/useCases";
import type { ValueCaseWithRelations } from "@/services/supabase/types";

const quickActions = [
  {
    icon: <Search size={20} />,
    label: "Research Company",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: <Upload size={20} />,
    label: "Import from CRM",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: <MessageSquare size={20} />,
    label: "Analyze Call",
    color: "bg-purple-50 text-purple-600",
  },
];

type CaseStatus = "committed" | "in-progress" | "draft";

const statusColors: Record<CaseStatus, string> = {
  committed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "in-progress": "bg-blue-100 text-blue-700 border-blue-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabels: Record<CaseStatus, string> = {
  committed: "COMMITTED",
  "in-progress": "IN PROGRESS",
  draft: "DRAFT",
};

function mapStatus(dbStatus: string): CaseStatus {
  const map: Record<string, CaseStatus> = {
    draft: "draft",
    review: "in-progress",
    published: "committed",
  };
  return map[dbStatus] ?? "draft";
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffHours < 1) return "Edited just now";
  if (diffHours < 24) return `Edited ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `Edited ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return `Edited ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
}

function formatValue(row: ValueCaseWithRelations): string {
  const projectedValue = row.metadata?.projected_value as number | undefined;
  if (projectedValue == null) return "-- Value";
  if (projectedValue >= 1_000_000) return `$${(projectedValue / 1_000_000).toFixed(1)}M Value`;
  if (projectedValue >= 1_000) return `$${(projectedValue / 1_000).toFixed(0)}K Value`;
  return `$${projectedValue.toFixed(0)} Value`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { data: recentCases, isLoading: casesLoading } = useRecentCases(3);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayName =
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "there";

  // Most recently updated case for "continue" card
  const continueCase = recentCases?.[0] ?? null;
  const continueCaseEditedAt = continueCase?.updated_at
    ? formatRelativeTime(new Date(continueCase.updated_at)).replace("Edited ", "")
    : null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          {getGreeting()}, {displayName}
        </h1>
        <p className="text-slate-500 mt-1">
          {currentTenant?.name ?? "Ready to prove some value today?"}
        </p>
      </div>

      {/* Continue Where You Left Off */}
      {casesLoading ? (
        <Card className="mb-8 p-4 border border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-3 w-40 mb-2" />
              <Skeleton className="h-5 w-60 mb-1" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
        </Card>
      ) : continueCase ? (
        <Card className="mb-8 p-4 border border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                <FileText className="text-emerald-600" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Continue where you left off
                  </span>
                  {continueCaseEditedAt && (
                    <span className="text-xs text-slate-400">• Edited {continueCaseEditedAt}</span>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900">{continueCase.name}</h3>
                <p className="text-sm text-slate-500">
                  {continueCase.description ?? `${continueCase.company_profiles?.company_name ?? "Value"} Case`}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/app/cases/${continueCase.id}`)}
              className="gap-2"
            >
              Resume
              <ArrowRight size={16} />
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Start Something New */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Start Something New
        </h2>

        {/* Command Input */}
        <Card className="mb-4 p-3 border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <Play size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="e.g., 'Build a business case for Stripe' or 'Analyze my last sales call'"
              className="flex-1 text-sm text-slate-600 placeholder:text-slate-400 outline-none"
            />
            <ArrowRight size={18} className="text-slate-400" />
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <Card
              key={index}
              className="p-4 border border-slate-200 bg-white hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  {action.icon}
                </div>
                <span className="font-medium text-slate-700">{action.label}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Cases */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Recent Cases
          </h2>
          <button
            className="text-sm text-primary hover:underline"
            onClick={() => navigate("/app/cases")}
          >
            View all
          </button>
        </div>

        {casesLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4 border border-slate-200 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-5 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2 mb-3" />
                <Skeleton className="h-3 w-24" />
              </Card>
            ))}
          </div>
        ) : recentCases && recentCases.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {recentCases.map((caseItem) => {
              const company = caseItem.company_profiles?.company_name ?? "Unknown";
              const initials = company
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const status = mapStatus(caseItem.status);

              return (
                <Card
                  key={caseItem.id}
                  className="p-4 border border-slate-200 bg-white hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/app/cases/${caseItem.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600 border border-slate-200">
                      {initials}
                    </div>
                    <Badge
                      className={`text-[10px] font-semibold uppercase ${statusColors[status]}`}
                    >
                      {statusLabels[status]}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{caseItem.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-slate-500 mb-3">
                    <TrendingUp size={14} />
                    <span>{formatValue(caseItem)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {caseItem.updated_at
                        ? formatRelativeTime(new Date(caseItem.updated_at))
                        : ""}
                    </span>
                    <button className="text-primary hover:underline">Open →</button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center border border-slate-200 bg-white">
            <p className="text-slate-500">No cases yet. Create your first value case to get started.</p>
            <Button className="mt-4" onClick={() => navigate("/app/cases/new")}>
              Create Case
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

export default HomePage;
