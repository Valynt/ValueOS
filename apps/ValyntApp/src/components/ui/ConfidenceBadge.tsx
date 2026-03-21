/**
 * ConfidenceBadge — canonical shared component.
 *
 * Consolidates four previously duplicated local ConfidenceBadge helpers across:
 *   - components/onboarding/SuggestionCard.tsx
 *   - components/orchestration/PipelineStepper.tsx
 *   - features/living-value-graph/components/inspector/EvidencePanel.tsx
 *   - views/canvas/HypothesisStage.tsx
 *
 * Props accept all prior variants:
 *   - `value`      — confidence as a 0–100 integer (HypothesisStage style)
 *   - `score`      — confidence as a 0–1 float (SuggestionCard / EvidencePanel style)
 *   - `source`     — optional source label (HypothesisStage style)
 *   - `showLabel`  — show High/Medium/Low text label (EvidencePanel style)
 *   - `variant`    — "pill" (default, compact badge) | "bar" (progress bar + source)
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ConfidenceBadgeProps {
  /** Confidence as 0–100 integer. Takes precedence over `score`. */
  value?: number;
  /** Confidence as 0–1 float. Converted to 0–100 internally. */
  score?: number;
  /** Optional source label shown next to the bar in "bar" variant. */
  source?: string;
  /** Show a High/Medium/Low text label alongside the percentage. */
  showLabel?: boolean;
  /** Visual variant. Defaults to "pill". */
  variant?: 'pill' | 'bar';
  className?: string;
}

function getColorClasses(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (pct >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-500 bg-red-50 border-red-200';
}

function getBarColorClass(pct: number): string {
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 75) return 'bg-blue-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-400';
}

function getLabel(pct: number): string {
  if (pct >= 80) return 'High';
  if (pct >= 60) return 'Medium';
  return 'Low';
}

export function ConfidenceBadge({
  value,
  score,
  source,
  showLabel = false,
  variant = 'pill',
  className,
}: ConfidenceBadgeProps) {
  // Normalise to 0–100 integer
  const pct: number =
    value !== undefined
      ? Math.round(value)
      : score !== undefined
        ? Math.round(score * 100)
        : 0;

  if (variant === 'bar') {
    return (
      <div className={cn('flex items-center gap-1.5', className)} aria-label={`Confidence: ${pct}%`}>
        <div className="w-10 h-1.5 bg-zinc-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={cn('h-full rounded-full', getBarColorClass(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-zinc-500">{pct}%</span>
        {source && (
          <>
            <span className="text-[10px] text-zinc-300" aria-hidden="true">·</span>
            <span className="text-[10px] text-zinc-400">{source}</span>
          </>
        )}
      </div>
    );
  }

  // Default: pill variant
  const colorClasses = getColorClasses(pct);
  const label = showLabel ? getLabel(pct) : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
        colorClasses,
        className,
      )}
      aria-label={`Confidence: ${pct}%${label ? ` (${label})` : ''}`}
    >
      {label && <span>{label}</span>}
      {pct}%
    </span>
  );
}

export default ConfidenceBadge;
