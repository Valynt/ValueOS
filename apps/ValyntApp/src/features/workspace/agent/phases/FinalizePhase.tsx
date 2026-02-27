/**
 * FinalizePhase — Success check animation with summary and persist confirmation.
 * Shown after artifacts are approved, before returning to idle.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Artifact } from "../types";

interface FinalizePhaseProps {
  artifacts: Artifact[];
  onFinalize: () => void;
  onExport?: () => void;
  className?: string;
}

export function FinalizePhase({
  artifacts,
  onFinalize,
  onExport,
  className,
}: FinalizePhaseProps) {
  const approvedArtifacts = artifacts.filter((a) => a.status === "approved");

  return (
    <div className={cn("space-y-4 animate-fade-in", className)}>
      {/* Success header */}
      <Card className="p-6 border-success/30 bg-success/5 shadow-sm text-center">
        {/* Animated check */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-success"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                className="opacity-30"
              />
              <path
                d="M8 12l3 3 5-5"
                stroke="currentColor"
                strokeDasharray="24"
                className="animate-check-draw"
              />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-1">
          Value Case Complete
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          {approvedArtifacts.length} artifact{approvedArtifacts.length !== 1 ? "s" : ""} approved
          and ready to persist.
        </p>

        {/* Artifact summary */}
        {approvedArtifacts.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-5">
            {approvedArtifacts.map((a) => (
              <Badge
                key={a.id}
                className="bg-success/10 text-success-700 border-success/20 text-xs"
              >
                {a.title}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 max-w-xs mx-auto">
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="flex-1"
            >
              Export PDF
            </Button>
          )}
          <Button
            size="sm"
            onClick={onFinalize}
            className="flex-1 bg-success hover:bg-success/90 text-white"
          >
            Save & Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
