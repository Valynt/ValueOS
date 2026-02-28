/**
 * HumanCheckpoint
 *
 * Decision gate in the workflow where a human must approve or reject.
 * Shows context summary, clear CTA hierarchy, and optional confirmation.
 *
 * UX Principles:
 * - One Primary Task per Screen: approve or reject, nothing else
 * - Contextual Continuity: carries forward summary from previous steps
 * - Error Prevention: confirmation dialog before destructive reject
 * - 5-Second Rule: immediately clear what action is needed
 */

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, User, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckpointSummaryItem {
  label: string;
  value: string;
}

export interface HumanCheckpointProps {
  title?: string;
  description?: string;
  summary?: CheckpointSummaryItem[];
  assignee?: string;
  deadline?: string;
  confidence?: number;
  onApprove?: () => void;
  onReject?: (reason?: string) => void;
  approveLabel?: string;
  rejectLabel?: string;
  loading?: boolean;
  className?: string;
}

export function HumanCheckpoint({
  title = "Review Required",
  description,
  summary = [],
  assignee,
  deadline,
  confidence,
  onApprove,
  onReject,
  approveLabel = "Approve",
  rejectLabel = "Reject",
  loading = false,
  className,
}: HumanCheckpointProps) {
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleReject = () => {
    onReject?.(rejectReason || undefined);
    setRejectConfirm(false);
    setRejectReason("");
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-primary/30 bg-primary/5 p-6",
        className
      )}
      role="region"
      aria-label={title}
    >
      {/* Header: What needs to happen */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Meta: who and when */}
      {(assignee || deadline || confidence !== undefined) && (
        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-muted-foreground">
          {assignee && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {assignee}
            </span>
          )}
          {deadline && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due: {deadline}
            </span>
          )}
          {confidence !== undefined && (
            <span className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  confidence >= 0.7 ? "bg-success" : confidence >= 0.4 ? "bg-warning" : "bg-destructive"
                )}
              />
              Confidence: {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Context summary: what was done so far */}
      {summary.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4 mb-5">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Summary
          </h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {summary.map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="text-sm font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Actions: clear CTA hierarchy */}
      {!rejectConfirm ? (
        <div className="flex items-center gap-3">
          {onApprove && (
            <button
              onClick={onApprove}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-colors",
                "bg-success text-success-foreground hover:bg-success/90 active:bg-success/80",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              {approveLabel}
            </button>
          )}
          {onReject && (
            <button
              onClick={() => setRejectConfirm(true)}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-colors",
                "border border-destructive/30 text-destructive hover:bg-destructive/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              <XCircle className="h-4 w-4" />
              {rejectLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-medium">This will send the case back for revision.</span>
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional but recommended)..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={2}
            aria-label="Rejection reason"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => { setRejectConfirm(false); setRejectReason(""); }}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default HumanCheckpoint;
