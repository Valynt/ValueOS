/**
 * HumanCheckpointPanel
 *
 * The human-in-the-loop decision gate — redesigned for question-first UX.
 * Leads with what the user needs to decide, not system checkpoint metadata.
 * "Does this look right?" not "Approval Checkpoint Required"
 */

import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HumanCheckpoint } from '@/types/agent-ux';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';

interface HumanCheckpointPanelProps {
  checkpoint: HumanCheckpoint;
  onDecide: (optionId: string) => void;
  className?: string;
}

export function HumanCheckpointPanel({ checkpoint, onDecide, className }: HumanCheckpointPanelProps) {
  const deadline = checkpoint.deadline
    ? new Date(checkpoint.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  // Extract key metrics for summary display
  const totalValue = checkpoint.context?.totalValue as number | undefined;
  const roi = checkpoint.context?.roi as number | undefined;
  const defensibility = checkpoint.context?.defensibilityScore as number | undefined;

  return (
    <div className={cn('rounded-xl border border-white/10 bg-white/5 overflow-hidden', className)}>
      {/* Question-First Header */}
      <div className="px-5 py-4 border-b border-white/8">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white leading-tight">
              {checkpoint.title}
            </h3>
            <p className="text-sm text-white/60 mt-1 leading-relaxed">
              {checkpoint.description}
            </p>
          </div>
          <ConfidenceBadge score={checkpoint.confidence} size="md" />
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Key Outcomes Summary */}
        {(totalValue || roi || defensibility) && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/6">
            {totalValue !== undefined && (
              <div className="flex-1">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Annual Value</div>
                <div className="text-xl font-bold text-white font-mono">
                  ${(totalValue / 1_000_000).toFixed(2)}M
                </div>
              </div>
            )}
            {roi !== undefined && (
              <div className="flex-1">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">ROI</div>
                <div className="text-xl font-bold text-white font-mono">
                  {roi}x
                </div>
              </div>
            )}
            {defensibility !== undefined && (
              <div className="flex-1">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Confidence</div>
                <div className="text-xl font-bold text-white font-mono">
                  {Math.round(defensibility * 100)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* Primary Question */}
        <div className="text-center py-2">
          <p className="text-sm text-white/70">
            Does this look right for {(checkpoint.context as { accountName?: string } | undefined)?.accountName || 'this opportunity'}?
          </p>
          {deadline && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/40 mt-2">
              <Clock className="w-3 h-3" />
              <span>Decision needed by {deadline}</span>
            </div>
          )}
        </div>

        {/* Decision Buttons — Clear hierarchy */}
        <div className="space-y-2">
          {/* Primary: Looks good */}
          <button
            onClick={() => onDecide('approve')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-500/50 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">Looks good — finalize</span>
          </button>

          {/* Secondary: Adjust */}
          <button
            onClick={() => onDecide('reject')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Needs adjustment</span>
          </button>

          {/* Tertiary: Start over */}
          <button
            onClick={() => onDecide('restart')}
            className="w-full px-4 py-2 rounded-lg text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
