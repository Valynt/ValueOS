/**
 * ReviewPhase — Side-by-side artifact review with approve/reject per artifact.
 * Shows agent-generated artifacts for human validation before finalization.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Artifact } from "../types";

interface ReviewPhaseProps {
  artifacts: Artifact[];
  onApproveArtifact: (artifactId: string) => void;
  onRejectArtifact: (artifactId: string) => void;
  onApproveAll: () => void;
  onRequestRevision: () => void;
  className?: string;
}

export function ReviewPhase({
  artifacts,
  onApproveArtifact,
  onRejectArtifact,
  onApproveAll,
  onRequestRevision,
  className,
}: ReviewPhaseProps) {
  const pendingCount = artifacts.filter(
    (a) => a.status === "proposed" || a.status === "draft"
  ).length;
  const approvedCount = artifacts.filter((a) => a.status === "approved").length;
  const allReviewed = pendingCount === 0 && artifacts.length > 0;

  return (
    <div className={cn("space-y-4 animate-fade-in", className)}>
      {/* Header */}
      <Card className="p-4 border-violet-200 bg-violet-50/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
              Review Artifacts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-violet-600 border-violet-200">
              {approvedCount}/{artifacts.length} approved
            </Badge>
          </div>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Review each artifact below. Approve individually or approve all to proceed.
        </p>
      </Card>

      {/* Artifact cards */}
      <div className="space-y-3">
        {artifacts.map((artifact, index) => (
          <ArtifactReviewCard
            key={artifact.id}
            artifact={artifact}
            index={index}
            onApprove={() => onApproveArtifact(artifact.id)}
            onReject={() => onRejectArtifact(artifact.id)}
          />
        ))}
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRequestRevision}
          className="flex-1 border-slate-300 text-slate-600"
        >
          Request Revision
        </Button>
        <Button
          size="sm"
          onClick={onApproveAll}
          disabled={artifacts.length === 0}
          className={cn(
            "flex-1",
            allReviewed
              ? "bg-success hover:bg-success/90 text-white"
              : "bg-violet-600 hover:bg-violet-700 text-white"
          )}
        >
          {allReviewed ? "Finalize" : "Approve All & Finalize"}
        </Button>
      </div>
    </div>
  );
}

function ArtifactReviewCard({
  artifact,
  index,
  onApprove,
  onReject,
}: {
  artifact: Artifact;
  index: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = artifact.status === "proposed" || artifact.status === "draft";
  const isApproved = artifact.status === "approved";
  const isRejected = artifact.status === "rejected";

  return (
    <Card
      className={cn(
        "p-4 shadow-sm transition-all animate-card-reveal",
        isPending && "border-violet-200 bg-white",
        isApproved && "border-success/30 bg-success/5",
        isRejected && "border-destructive/30 bg-destructive/5 opacity-60"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-800 truncate">
              {artifact.title}
            </span>
            <StatusBadge status={artifact.status} />
          </div>
          <div className="text-xs text-slate-500">
            {artifact.type.replace(/_/g, " ")}
          </div>

          {/* Content preview */}
          <div className="mt-2 p-2 bg-slate-50 rounded-md border border-slate-100 max-h-24 overflow-hidden">
            <ArtifactPreview content={artifact.content} />
          </div>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={onApprove}
              className="text-xs border-success/40 text-success-700 hover:bg-success/10"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              className="text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: Artifact["status"] }) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-success/10 text-success-700 border-success/20 text-2xs">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-2xs">
          Rejected
        </Badge>
      );
    case "proposed":
      return (
        <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-2xs">
          Pending
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-2xs text-slate-500">
          {status}
        </Badge>
      );
  }
}

function ArtifactPreview({ content }: { content: Artifact["content"] }) {
  switch (content.kind) {
    case "markdown":
      return (
        <p className="text-xs text-slate-600 line-clamp-3">
          {content.markdown.slice(0, 200)}
        </p>
      );
    case "json":
      return (
        <pre className="text-xs text-slate-600 font-mono line-clamp-3">
          {JSON.stringify(content.data, null, 2).slice(0, 200)}
        </pre>
      );
    case "table":
      return (
        <p className="text-xs text-slate-500">
          Table: {content.columns.length} columns, {content.rows.length} rows
        </p>
      );
    case "chart":
      return (
        <p className="text-xs text-slate-500">
          {content.chartType} chart &middot; {content.data.length} data points
        </p>
      );
    default:
      return <p className="text-xs text-slate-400">Preview unavailable</p>;
  }
}
