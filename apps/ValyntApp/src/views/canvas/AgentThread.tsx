import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useAgentJob } from "@/hooks/useAgentJob";
import { useCheckpointReview, useCheckpointReviewDecision } from "@/hooks/useCheckpointReview";
import type { AgentJobResult } from "@/hooks/useAgentJob";
import { cn } from "@/lib/utils";

interface AgentThreadProps {
  /** jobId returned by the agent invoke endpoint. Null = no run yet. */
  runId?: string | null;
  /**
   * Pre-resolved result from a direct-mode invoke (mode: "direct").
   * When provided, polling is skipped and this result is displayed immediately.
   */
  directResult?: AgentJobResult | null;
  /** Current sub-task text from a processing heartbeat, if available. */
  currentSubTask?: string | null;
  /** Lifecycle stage id used for checkpoint persistence. */
  stageId?: string;
  /** Stage risk level to enforce rationale requirements. */
  riskLevel?: "low" | "medium" | "high";
}

export function AgentThread({
  runId,
  directResult,
  currentSubTask,
  stageId = "hypothesis",
  riskLevel = "medium",
}: AgentThreadProps) {
  const { caseId } = useParams<{ caseId: string }>();
  const { data: job, isLoading } = useAgentJob(runId ?? null, directResult);
  const { data: review } = useCheckpointReview(caseId, runId ?? null, stageId);
  const reviewDecision = useCheckpointReviewDecision();

  const [message, setMessage] = useState("");
  const [rationale, setRationale] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentStatus = review?.status ?? "pending";
  const isApproved = currentStatus === "approved";
  const isChangesRequested = currentStatus === "changes_requested";

  const requireApproveRationale = riskLevel === "high";

  const statusIcon = () => {
    if (!runId) return null;
    if (isLoading) return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    switch (job?.status) {
      case "completed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case "failed":
      case "error":
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      case "unavailable":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      case "retrying":
        return <RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin" />;
      default:
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    }
  };

  const statusLabel = () => {
    if (!runId) return "No active run";
    if (isLoading) return "Connecting…";
    const modeTag = job?.mode === "direct" ? " · direct" : job?.mode === "kafka" ? " · async" : "";
    switch (job?.status) {
      case "queued": return "Queued";
      case "processing": return currentSubTask
        ? currentSubTask
        : `Running${job.agentId ? ` · ${job.agentId}` : ""}`;
      case "retrying": return `Retrying${job.attemptsMade != null ? ` (attempt ${job.attemptsMade})` : ""}`;
      case "completed": return `Completed${modeTag}`;
      case "failed":
      case "error": return `Failed${modeTag}`;
      case "unavailable": return "Infrastructure unavailable";
      default: return "Unknown";
    }
  };

  const statusBg = () => {
    switch (job?.status) {
      case "completed": return "bg-emerald-50";
      case "error":
      case "failed": return "bg-red-50";
      case "unavailable": return "bg-amber-50";
      case "retrying": return "bg-orange-50";
      default: return "bg-blue-50";
    }
  };

  const iconBg = () => {
    switch (job?.status) {
      case "completed": return "bg-emerald-100";
      case "error":
      case "failed": return "bg-red-100";
      case "unavailable": return "bg-amber-100";
      case "retrying": return "bg-orange-100";
      default: return "bg-blue-100";
    }
  };

  const reviewBanner = useMemo(() => {
    if (isApproved) return "Approved";
    if (isChangesRequested) return "Changes Requested";
    return "Pending Review";
  }, [isApproved, isChangesRequested]);

  const submitDecision = (decision: "approved" | "changes_requested") => {
    if (!caseId || !runId) return;

    const trimmedRationale = rationale.trim();
    const mustProvideRationale = decision === "changes_requested" || (decision === "approved" && requireApproveRationale);
    if (mustProvideRationale && !trimmedRationale) {
      setValidationError(
        decision === "changes_requested"
          ? 'Rationale is required when requesting changes.'
          : 'Rationale is required for approvals in high-risk stages.',
      );
      return;
    }

    setValidationError(null);
    reviewDecision.mutate({
      caseId,
      runId,
      stageId,
      decision,
      rationale: trimmedRationale || undefined,
      riskLevel,
    });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Agent Workflow</h4>

      {!runId && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-dashed border-zinc-200">
          <Clock className="w-4 h-4 text-zinc-300 flex-shrink-0" />
          <p className="text-[12px] text-zinc-400">
            Click "Run Stage" in the Hypothesis panel to start the agent.
          </p>
        </div>
      )}

      {runId && (
        <div className="space-y-2">
          <div className={cn("flex items-center gap-3 p-3 rounded-xl", statusBg())}>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", iconBg())}>
              {statusIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-zinc-800">{statusLabel()}</p>
              {job?.message && (
                <p className="text-[11px] text-zinc-500 mt-0.5">{job.message}</p>
              )}
            </div>
          </div>

          {job?.status === "retrying" && (
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-[12px] text-orange-800">
              <p className="font-medium">
                Retrying after a transient error
                {job.attemptsMade != null ? ` — attempt ${job.attemptsMade}` : ""}
              </p>
            </div>
          )}

          <p className="text-[10px] text-zinc-300 font-mono px-1">run: {runId}</p>
        </div>
      )}

      {job?.status === "completed" && (
        <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <span className="text-[12px] font-semibold text-amber-800">Review Required</span>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-800">
              {reviewBanner}
            </span>
          </div>

          <p className="text-[12px] text-amber-700">
            Agent run completed. Review the hypothesis output before proceeding to the Model stage.
          </p>

          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder={requireApproveRationale ? "Rationale required for this high-risk approval stage" : "Add rationale (required for Request Changes)"}
            rows={2}
            className="w-full resize-none bg-white border border-amber-200 rounded-lg px-3 py-2 text-[12px] text-zinc-800 placeholder:text-zinc-400 outline-none"
          />

          {validationError && <p className="text-[11px] text-red-600">{validationError}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => submitDecision("approved")}
              disabled={reviewDecision.isPending || isChangesRequested}
              className="px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[12px] font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Approve
            </button>
            <button
              onClick={() => submitDecision("changes_requested")}
              disabled={reviewDecision.isPending || isApproved}
              className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-[12px] font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Request Changes
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 bg-white border border-zinc-200 rounded-2xl p-2 mt-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask the agent about this case..."
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 placeholder:italic placeholder:font-light outline-none"
        />
        <button
          disabled={!message.trim()}
          className="w-9 h-9 bg-zinc-950 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}
