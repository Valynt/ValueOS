/**
 * FE-019: Plan State UI — Approval Gate
 *
 * Displays the agent's proposed execution plan with numbered steps,
 * editable assumptions, estimated duration, and approve/reject actions.
 */

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Edit3,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import type { PlanAssumption, WorkflowStepState } from "../../agent/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";


interface PlanApprovalGateProps {
  steps: WorkflowStepState[];
  assumptions: PlanAssumption[];
  estimatedDuration?: number;
  onApprove: () => void;
  onReject: () => void;
  onUpdateAssumption: (id: string, value: string | number) => void;
}

export function PlanApprovalGate({
  steps,
  assumptions,
  estimatedDuration,
  onApprove,
  onReject,
  onUpdateAssumption,
}: PlanApprovalGateProps) {
  const [showAssumptions, setShowAssumptions] = useState(assumptions.length > 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const formatDuration = (ms: number) => {
    if (ms < 60_000) return `~${Math.ceil(ms / 1000)}s`;
    return `~${Math.ceil(ms / 60_000)} min`;
  };

  return (
    <Card className="border-amber-200 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-600" />
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Proposed Plan
          </span>
        </div>
        <div className="flex items-center gap-2">
          {estimatedDuration && (
            <Badge variant="outline" className="text-xs text-slate-500 border-slate-200">
              <Clock size={12} className="mr-1" />
              {formatDuration(estimatedDuration)}
            </Badge>
          )}
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
            Awaiting Approval
          </Badge>
        </div>
      </div>

      {/* Steps */}
      <div className="p-4">
        <div className="space-y-1">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-3 py-2 group"
            >
              {/* Step number / connector */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-px h-4 bg-slate-200 mt-1" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{step.label}</p>
                {step.error && (
                  <p className="text-xs text-red-500 mt-0.5">{step.error}</p>
                )}
              </div>

              {/* Step status icon */}
              <div className="w-5 flex justify-center pt-0.5">
                {step.status === "completed" ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <Circle size={14} className="text-slate-300" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assumptions (collapsible) */}
      {assumptions.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowAssumptions(!showAssumptions)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <span>Assumptions ({assumptions.length})</span>
            {showAssumptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAssumptions && (
            <div className="px-4 pb-3 space-y-2">
              {assumptions.map((asm) => (
                <div
                  key={asm.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50 group/asm"
                >
                  <span className="text-sm text-slate-600">{asm.label}</span>
                  <div className="flex items-center gap-1.5">
                    {editingId === asm.id && asm.editable ? (
                      <input
                        type="text"
                        defaultValue={String(asm.value)}
                        autoFocus
                        onBlur={(e) => {
                          const val = e.target.value;
                          const num = Number(val);
                          onUpdateAssumption(asm.id, isNaN(num) ? val : num);
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-24 text-right text-sm font-medium text-slate-800 border border-primary/30 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <>
                        <span className="text-sm font-medium text-slate-800">
                          {asm.value}
                        </span>
                        {asm.editable && (
                          <button
                            onClick={() => setEditingId(asm.id)}
                            className="opacity-0 group-hover/asm:opacity-100 p-0.5 text-slate-400 hover:text-primary transition-opacity"
                            aria-label={`Edit ${asm.label}`}
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                      </>
                    )}
                    {asm.source && (
                      <span className="text-[10px] text-slate-400 ml-1">{asm.source}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          className="flex-1"
        >
          Reject
        </Button>
        <Button
          size="sm"
          onClick={onApprove}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          Approve & Execute
        </Button>
      </div>
    </Card>
  );
}
