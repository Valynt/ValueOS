/**
 * FE-026: Review State UI — Diff View
 *
 * Presents proposed artifacts for user review with approve/reject per artifact.
 * Shows a summary of changes and tracks review progress.
 */

import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Table2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import type { Artifact, ArtifactType } from "../../agent/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";


interface ReviewDiffPanelProps {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  onSelectArtifact: (id: string) => void;
  onApproveArtifact: (id: string) => void;
  onRejectArtifact: (id: string) => void;
  onApproveAll: () => void;
  onCancel: () => void;
}

const ARTIFACT_ICONS: Partial<Record<ArtifactType, React.ReactNode>> = {
  value_model: <BarChart3 size={14} />,
  financial_projection: <BarChart3 size={14} />,
  executive_summary: <BookOpen size={14} />,
  table: <Table2 size={14} />,
  narrative: <BookOpen size={14} />,
  chart: <BarChart3 size={14} />,
};

const STATUS_CONFIG = {
  proposed: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  superseded: { label: "Superseded", className: "bg-slate-100 text-slate-500 border-slate-200" },
} as const;

export function ReviewDiffPanel({
  artifacts,
  activeArtifactId,
  onSelectArtifact,
  onApproveArtifact,
  onRejectArtifact,
  onApproveAll,
  onCancel,
}: ReviewDiffPanelProps) {
  const reviewable = artifacts.filter((a) => a.status === "proposed" || a.status === "draft");
  const reviewed = artifacts.filter((a) => a.status === "approved" || a.status === "rejected");
  const allReviewed = reviewable.length === 0 && reviewed.length > 0;
  const approvedCount = artifacts.filter((a) => a.status === "approved").length;

  return (
    <Card className="border-emerald-200 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
            Review Artifacts
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {approvedCount}/{artifacts.length} approved
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-emerald-100">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${artifacts.length > 0 ? (reviewed.length / artifacts.length) * 100 : 0}%` }}
        />
      </div>

      {/* Artifact list */}
      <div className="p-2">
        {artifacts.map((artifact) => {
          const statusConfig = STATUS_CONFIG[artifact.status];
          const isActive = artifact.id === activeArtifactId;
          const isPending = artifact.status === "proposed" || artifact.status === "draft";

          return (
            <div
              key={artifact.id}
              className={cn(
                "rounded-lg border transition-all mb-1",
                isActive
                  ? "border-emerald-300 bg-emerald-50/50 shadow-sm"
                  : "border-transparent hover:bg-slate-50"
              )}
            >
              {/* Artifact row */}
              <button
                onClick={() => onSelectArtifact(artifact.id)}
                className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  {ARTIFACT_ICONS[artifact.type] ?? <FileText size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {artifact.title}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">
                    {artifact.type.replace(/_/g, " ")}
                  </p>
                </div>
                <Badge className={cn("text-[10px] shrink-0", statusConfig.className)}>
                  {statusConfig.label}
                </Badge>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>

              {/* Inline approve/reject for active pending artifact */}
              {isActive && isPending && (
                <div className="px-3 pb-2.5 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRejectArtifact(artifact.id)}
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle size={14} className="mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onApproveArtifact(artifact.id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={14} className="mr-1" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        {reviewable.length > 0 ? (
          <Button
            size="sm"
            onClick={onApproveAll}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Approve All ({reviewable.length})
          </Button>
        ) : allReviewed ? (
          <Button
            size="sm"
            onClick={onApproveAll}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Finalize
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
