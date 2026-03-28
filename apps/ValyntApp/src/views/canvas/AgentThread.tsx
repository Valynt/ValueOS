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

import { useAgentJob } from "@/hooks/useAgentJob";
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
}

export function AgentThread({ runId, directResult, currentSubTask }: AgentThreadProps) {
  const { data: job, isLoading, retryRun, resumePolling } = useAgentJob(runId ?? null, directResult);
  const [message, setMessage] = useState("");

  const isDegraded = job?.status === "failed" || job?.status === "error" || job?.status === "unavailable";

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

  const handleViewArtifact = () => {
    if (!job?.lastKnownGoodOutput) return;
    const artifact = typeof job.lastKnownGoodOutput === "string"
      ? job.lastKnownGoodOutput
      : JSON.stringify(job.lastKnownGoodOutput, null, 2);
    navigator.clipboard.writeText(artifact).catch(() => {
      // no-op; users can still read rendered artifact preview below
    });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Agent Workflow</h4>

      {/* No run yet */}
      {!runId && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-dashed border-zinc-200">
          <Clock className="w-4 h-4 text-zinc-300 flex-shrink-0" />
          <p className="text-[12px] text-zinc-400">
            Click "Run Stage" in the Hypothesis panel to start the agent.
          </p>
        </div>
      )}

      {/* Active run status */}
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
              {job?.attemptsMade != null && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Retry attempt {job.attemptsMade}
                </p>
              )}
              {retryBackoffLabel && (
                <p className="text-[11px] text-zinc-500 mt-0.5">{retryBackoffLabel}</p>
              )}
              {job?.queuedAt && (
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Queued {new Date(job.queuedAt).toLocaleTimeString()}
                </p>
              )}
              {job?.completedAt && job.latency && (
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Completed in {(job.latency / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>

          {job?.status === "unavailable" && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
              The agent infrastructure (Kafka/event bus) is not running in this environment.
              You can resume polling now or view the last successful artifact.
            </div>
          )}

          {job?.status === "error" && job.error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
              {job.error}
            </div>
          )}

          {isDegraded && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => retryRun.mutate()}
                disabled={retryRun.isPending}
                className="px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[12px] font-medium hover:bg-zinc-800 disabled:opacity-50"
              >
                {retryRun.isPending ? "Retrying…" : "Retry run"}
              </button>
              <button
                type="button"
                onClick={() => resumePolling.mutate()}
                disabled={resumePolling.isPending}
                className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-[12px] font-medium hover:bg-zinc-50 disabled:opacity-50"
              >
                {resumePolling.isPending ? "Resuming…" : "Resume polling"}
              </button>
              <button
                type="button"
                onClick={handleViewArtifact}
                disabled={!job?.lastKnownGoodOutput}
                className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-[12px] font-medium hover:bg-zinc-50 disabled:opacity-50"
              >
                View last successful artifact
              </button>
            </div>
          )}

          {isDegraded && job?.lastKnownGoodOutput && (
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-[12px] text-zinc-700">
              <p className="font-medium">Last known good output</p>
              {job.lastKnownGoodAt && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Captured at {new Date(job.lastKnownGoodAt).toLocaleString()}
                </p>
              )}
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white border border-zinc-200 p-2 text-[11px] leading-relaxed">
                {typeof job.lastKnownGoodOutput === "string"
                  ? job.lastKnownGoodOutput
                  : JSON.stringify(job.lastKnownGoodOutput, null, 2)}
              </pre>
            </div>
          )}

          <p className="text-[10px] text-zinc-300 font-mono px-1">run: {runId}</p>
        </div>
      )}

      {/* Human checkpoint — shown when run completed */}
      {job?.status === "completed" && (
        <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-[12px] font-semibold text-amber-800">Review Required</span>
          </div>
          <p className="text-[12px] text-amber-700 mb-3">
            Agent run completed. Review the hypothesis output before proceeding to the Model stage.
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-[12px] font-medium hover:bg-zinc-800 transition-colors">
              Approve
            </button>
            <button className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-[12px] font-medium hover:bg-zinc-50 transition-colors">
              Request Changes
            </button>
          </div>
        </div>
      )}

      {/* Agent input */}
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
