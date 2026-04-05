import { AlertTriangle } from "lucide-react";
import type { RuntimeFailureDetails } from "@shared/domain/RuntimeFailureTaxonomy";

interface DegradedStatusBannerProps {
  runtimeFailure: RuntimeFailureDetails;
  className?: string;
}

export function DegradedStatusBanner({ runtimeFailure, className = "" }: DegradedStatusBannerProps) {
  const isDegraded = runtimeFailure.severity === "degraded";
  const tone = isDegraded
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`rounded-lg border px-4 py-3 ${tone} ${className}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {isDegraded ? "Execution degraded" : "Execution failed"} · {runtimeFailure.class}
          </p>
          <p className="text-sm">{runtimeFailure.diagnosis}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">reason: {runtimeFailure.machineReasonCode}</span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">confidence: {Math.round(runtimeFailure.confidence * 100)}%</span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">blast radius: {runtimeFailure.blastRadiusEstimate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
