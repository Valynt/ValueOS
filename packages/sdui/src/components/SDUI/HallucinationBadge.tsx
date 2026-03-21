import React, { useState } from "react";

export interface HallucinationBadgeProps {
  /** Result of the hallucination check from secureInvoke. */
  hallucination_check?: boolean | null;
  /** Grounding score 0–1 from hallucination_details. */
  grounding_score?: number | null;
  /** Additional detail string shown in the tooltip. */
  detail?: string;
  /**
   * Called when the badge is clicked, in addition to toggling the tooltip.
   * Used by AgentResponseCard to activate the Reasoning tab.
   */
  onReasoningOpen?: () => void;
}

type BadgeState = "pass" | "fail" | "unknown";

function resolveState(check: boolean | null | undefined): BadgeState {
  if (check === true) return "pass";
  if (check === false) return "fail";
  return "unknown";
}

const STATE_CONFIG: Record<BadgeState, { label: string; bg: string; text: string; dot: string }> = {
  pass: {
    label: "Verified",
    bg: "bg-green-50 border-green-200",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  fail: {
    label: "Flagged",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  unknown: {
    label: "Unverified",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-400",
  },
};

/**
 * HallucinationBadge
 *
 * Displays the hallucination check result for an agent output.
 * Green = check passed, Red = check failed, Amber = check absent/unknown.
 * Clicking the badge reveals the grounding score and optional detail.
 */
export function HallucinationBadge({
  hallucination_check,
  grounding_score,
  detail,
  onReasoningOpen,
}: HallucinationBadgeProps) {
  const [open, setOpen] = useState(false);
  const state = resolveState(hallucination_check);
  const cfg = STATE_CONFIG[state];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          onReasoningOpen?.();
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${cfg.bg} ${cfg.text}`}
        aria-label={`Hallucination check: ${cfg.label}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
        {cfg.label}
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-zinc-200 bg-white p-3 shadow-md text-xs text-zinc-700"
        >
          <p className="font-semibold mb-1">Hallucination check</p>
          <p>
            Status:{" "}
            <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
          </p>
          {grounding_score != null && (
            <p>
              Grounding score:{" "}
              <span className="font-medium">{(grounding_score * 100).toFixed(0)}%</span>
            </p>
          )}
          {detail && <p className="mt-1 text-zinc-500">{detail}</p>}
        </div>
      )}
    </div>
  );
}
