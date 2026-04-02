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
import {
  useCheckpointReview,
  useCheckpointReviewDecision,
} from "@/hooks/useCheckpointReview";
import type { AgentJobResult } from "@/hooks/useAgentJob";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface AgentThreadProps {
  runId?: string | null;
  directResult?: AgentJobResult | null;
  currentSubTask?: string | null;
  stageId?: string;
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

  const { data: job, isLoading, retryRun, resumePolling } =
    useAgentJob(runId ?? null, directResult);

  const { data: review } = useCheckpointReview(
    caseId,
    runId ?? null,
    stageId
  );

  const reviewDecision = useCheckpointReviewDecision();

  const [message, setMessage] = useState("");
  const [rationale, setRationale] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentStatus = review?.status ?? "pending";
  const isApproved = currentStatus === "approved";
  const isChangesRequested = currentStatus === "changes_requested";

  const requireApproveRationale = riskLevel === "high";

  const isDegraded =
    job?.status === "failed" ||
    job?.status === "error" ||
    job?.status === "unavailable";

  const retryBackoffLabel = useMemo(() => {
    if (!job?.nextRetryAt) return null;
    const nextRetryDate = new Date(job.nextRetryAt);
    if (Number.isNaN(nextRetryDate.getTime())) return null;

    const deltaMs = Math.max(0, nextRetryDate.getTime() - Date.now());
    const seconds = Math.ceil(deltaMs / 1000);
    return seconds > 0
      ? `Next automatic attempt in ~${seconds}s`
      : `Next automatic attempt at ${nextRetryDate.toLocaleTimeString()}`;
  }, [job?.nextRetryAt]);

  const retryAttemptLabel = useMemo(() => {
    if (job?.attemptsMade == null) return null;
    const attemptNumber = Math.max(1, job.attemptsMade);
    return `Attempt ${attemptNumber}`;
  }, [job?.attemptsMade]);

  const statusIcon = () => {
    if (!runId) return null;
    if (isLoading)
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
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

    const modeTag =
      job?.mode === "direct"
        ? " · direct"
        : job?.mode === "kafka"
          ? " · async"
          : "";

    switch (job?.status) {
      case "queued":
        return "Queued";
      case "processing":
        return currentSubTask
          ? currentSubTask
          : `Running${job.agentId ? ` · ${job.agentId}` : ""}`;
      case "retrying":
        return `Retrying${job.attemptsMade != null ? ` (attempt ${job.attemptsMade})` : ""
          }`;
      case "completed":
        return `Completed${modeTag}`;
      case "failed":
      case "error":
        return `Failed${modeTag}`;
      case "unavailable":
        return "Infrastructure unavailable";
      default:
        return "Unknown";
    }
  };

  const statusBg = () => {
    switch (job?.status) {
      case "completed":
        return "bg-emerald-50";
      case "error":
      case "failed":
        return "bg-red-50";
      case "unavailable":
        return "bg-amber-50";
      case "retrying":
        return "bg-orange-50";
      default:
        return "bg-blue-50";
    }
  };

  const iconBg = () => {
    switch (job?.status) {
      case "completed":
        return "bg-emerald-100";
      case "error":
      case "failed":
        return "bg-red-100";
      case "unavailable":
        return "bg-amber-100";
      case "retrying":
        return "bg-orange-100";
      default:
        return "bg-blue-100";
    }
  };

  const handleViewArtifact = () => {
    if (!job?.lastKnownGoodOutput) return;
    const artifact =
      typeof job.lastKnownGoodOutput === "string"
        ? job.lastKnownGoodOutput
        : JSON.stringify(job.lastKnownGoodOutput, null, 2);

    navigator.clipboard.writeText(artifact).catch((err) => {
      logger.warn("Failed to copy artifact to clipboard:", { error: err });
    });
  };

  const reviewBanner = useMemo(() => {
    if (isApproved) return "Approved";
    if (isChangesRequested) return "Changes Requested";
    return "Pending Review";
  }, [isApproved, isChangesRequested]);

  const formattedDecisionTime = useMemo(() => {
    if (!review?.decidedAt) return null;
    const parsed = new Date(review.decidedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
  }, [review?.decidedAt]);

  const canApprove = !isChangesRequested && !reviewDecision.isPending;
  const canRequestChanges = !isApproved && !reviewDecision.isPending;

  const submitDecision = (decision: "approved" | "changes_requested") => {
    if (!caseId || !runId) return;

    const trimmed = rationale.trim();

    const mustProvide =
      decision === "changes_requested" ||
      (decision === "approved" && requireApproveRationale);

    if (mustProvide && !trimmed) {
      setValidationError(
        decision === "changes_requested"
          ? "Rationale is required when requesting changes."
          : "Rationale is required for approvals in high-risk stages."
      );
      return;
    }

    setValidationError(null);

    reviewDecision.mutate({
      caseId,
      runId,
      stageId,
      decision,
      rationale: trimmed || undefined,
      riskLevel,
    });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Agent Workflow
      </h4>

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
          <div
            className={cn("flex items-center gap-3 p-3 rounded-xl", statusBg())}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                iconBg()
              )}
            >
              {statusIcon()}
            </div>

            <div className="flex-1">
              <p className="text-[12px] font-medium text-zinc-800">
                {statusLabel()}
              </p>

              {job?.message && (
                <p className="text-[11px] text-zinc-500">{job.message}</p>
              )}

              {retryBackoffLabel && (
                <p className="text-[11px] text-zinc-500">
                  {retryBackoffLabel}
                </p>
              )}
            </div>
          </div>

          {isDegraded && (
            <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-medium text-zinc-700">
                Recovery Actions
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => retryRun.mutate()}
                  disabled={retryRun.isPending}
                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                Retry run
              </button>

                <button
                  onClick={() => resumePolling.mutate()}
                  disabled={resumePolling.isPending}
                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                Resume polling
              </button>

                <button
                  onClick={handleViewArtifact}
                  disabled={!job?.lastKnownGoodOutput}
                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  View last successful artifact
              </button>
            </div>

              {(retryAttemptLabel || retryBackoffLabel) && (
                <p className="text-[11px] text-zinc-500">
                  {[retryAttemptLabel, retryBackoffLabel].filter(Boolean).join(" · ")}
                </p>
              )}

              {job?.lastKnownGoodOutput && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-[11px] font-medium text-emerald-700">
                    Last known good output
                  </p>
                  <p className="text-[10px] text-emerald-700/80">
                    {job.lastKnownGoodAt
                      ? `Captured ${new Date(job.lastKnownGoodAt).toLocaleString()}`
                      : "Captured from the previous successful run"}
                  </p>
                  <pre className="mt-1 max-h-28 overflow-auto rounded bg-white/80 p-2 text-[10px] text-zinc-700">
                    {typeof job.lastKnownGoodOutput === "string"
                      ? job.lastKnownGoodOutput
                      : JSON.stringify(job.lastKnownGoodOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-zinc-300 font-mono">
            run: {runId}
          </p>
        </div>
      )}

{job?.status === "completed" && (
  <div className="p-4 border-2 border-amber-300 bg-amber-50 space-y-3">
    <div className="flex justify-between">
      <span>Review Required</span>
      <span>{reviewBanner}</span>
    </div>

    <textarea
      value={rationale}
      onChange={(e) => setRationale(e.target.value)}
      placeholder="Add rationale..."
    />

    {validationError && <p>{validationError}</p>}

    {review?.actorId && formattedDecisionTime && (
      <p className="text-[11px] text-zinc-600">
        Last decision by {review.actorId} at {formattedDecisionTime}
      </p>
    )}

    <div className="flex gap-2">
      <button
        onClick={() => submitDecision("approved")}
        disabled={!canApprove}
      >
        Approve
      </button>
      <button
        onClick={() => submitDecision("changes_requested")}
        disabled={!canRequestChanges}
      >
        Request Changes
      </button>
    </div>
  </div>
)}

<div className="flex gap-2">
  <textarea
    value={message}
    onChange={(e) => setMessage(e.target.value)}
    placeholder="Ask the agent..."
  />
  <button disabled={!message.trim()}>
    <ArrowUp />
  </button>
</div>
    </div>
  );
}
