/**
 * PlanPhase — Card-reveal animation showing the agent's execution plan.
 * Includes editable assumptions and an approval gate (approve/reject).
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkflowStepState, PlanAssumption } from "../types";

interface PlanPhaseProps {
  steps: WorkflowStepState[];
  assumptions: PlanAssumption[];
  estimatedDuration?: number;
  onApprove: () => void;
  onReject: () => void;
  onUpdateAssumption: (id: string, value: string | number) => void;
  className?: string;
}

export function PlanPhase({
  steps,
  assumptions,
  estimatedDuration,
  onApprove,
  onReject,
  onUpdateAssumption,
  className,
}: PlanPhaseProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <Card className="p-5 border-blue-200 bg-blue-50/50 shadow-sm animate-card-reveal">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
              Proposed Plan
            </span>
          </div>
          <div className="flex items-center gap-2">
            {estimatedDuration && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                ~{formatDuration(estimatedDuration)}
              </Badge>
            )}
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
              {steps.length} steps
            </Badge>
          </div>
        </div>

        {/* Steps list with staggered reveal */}
        <div className="space-y-2 mb-5">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-3 animate-card-reveal"
              style={{ animationDelay: `${(index + 1) * 80}ms` }}
            >
              <span className="mt-0.5 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800">{step.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Editable assumptions */}
        {assumptions.length > 0 && (
          <div className="border-t border-blue-100 pt-4 mb-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Assumptions
            </div>
            <div className="space-y-2">
              {assumptions.map((asm) => (
                <div key={asm.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-600 truncate">{asm.label}</span>
                  {asm.editable ? (
                    <input
                      type="text"
                      value={String(asm.value)}
                      onChange={(e) => {
                        const numVal = Number(e.target.value);
                        onUpdateAssumption(
                          asm.id,
                          isNaN(numVal) ? e.target.value : numVal
                        );
                      }}
                      className="w-28 px-2 py-1 text-sm text-right font-medium text-slate-800 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-800">
                      {asm.value}
                    </span>
                  )}
                  {asm.source && (
                    <span className="text-2xs text-slate-400 shrink-0">{asm.source}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval gate */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Approve & Execute
          </Button>
        </div>
      </Card>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}
