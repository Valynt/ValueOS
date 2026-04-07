/**
 * ApprovalActions — Warmth-gated + RBAC-gated approval buttons for reviewer surface.
 *
 * Approve is disabled when warmth is "forming" or user lacks permission.
 * Export PDF is always available.
 */

import { CheckCircle, Download, MessageSquare } from "lucide-react";

import type { WarmthState } from "@/lib/warmth";
import { cn } from "@/lib/utils";

interface ApprovalActionsProps {
  caseId: string;
  warmth: WarmthState;
  canApprove: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  onExport: () => void;
}

function getDisabledReason(warmth: WarmthState, canApprove: boolean): string | null {
  if (warmth === "forming") return "Case must reach firm or verified state before approval";
  if (!canApprove) return "You do not have permission to approve cases";
  return null;
}

export function ApprovalActions({
  caseId,
  warmth,
  canApprove,
  onApprove,
  onRequestChanges,
  onExport,
}: ApprovalActionsProps) {
  const approveDisabled = warmth === "forming" || !canApprove;
  const disabledReason = getDisabledReason(warmth, canApprove);

  return (
    <div className="flex flex-col sm:flex-row gap-3 p-4 border-t border-zinc-200 bg-white">
      <button
        type="button"
        onClick={onApprove}
        disabled={approveDisabled}
        title={disabledReason ?? undefined}
        aria-describedby={disabledReason ? `approve-reason-${caseId}` : undefined}
        className={cn(
          "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
          approveDisabled
            ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-700",
        )}
      >
        <CheckCircle className="w-4 h-4" />
        Approve Case
      </button>

      {disabledReason && (
        <span id={`approve-reason-${caseId}`} className="sr-only">
          {disabledReason}
        </span>
      )}

      <button
        type="button"
        onClick={onRequestChanges}
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        Request Changes
      </button>

      <button
        type="button"
        onClick={onExport}
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export PDF
      </button>
    </div>
  );
}
