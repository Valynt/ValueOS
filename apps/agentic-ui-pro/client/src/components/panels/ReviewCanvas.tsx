/**
 * ReviewCanvas
 *
 * Dedicated inline editing and review mode for the REFINING state.
 * Side-by-side diff view with per-hypothesis accept/reject and batch actions.
 * Makes review feel like refinement, not evaluation.
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, Edit3, GitCompare, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValueHypothesis, ValueNode, DefensibilityScore } from '@/types/agent-ux';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';

interface ReviewCanvasProps {
  hypotheses: ValueHypothesis[];
  valueGraph: ValueNode[];
  defensibilityScore: DefensibilityScore | null;
  onAcceptHypothesis: (id: string) => void;
  onRejectHypothesis: (id: string) => void;
  onBatchAccept: () => void;
  onBatchReject: () => void;
  className?: string;
}

interface HypothesisReviewCardProps {
  hypothesis: ValueHypothesis;
  node?: ValueNode;
  onAccept: () => void;
  onReject: () => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function HypothesisReviewCard({ hypothesis, node, onAccept, onReject }: HypothesisReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    pending: { color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    accepted: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    edited: { color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    rejected: { color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  };
  const config = statusConfig[hypothesis.status];

  return (
    <div className={cn('rounded-xl border overflow-hidden', config.border, config.bg)}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-xs font-medium', config.color)}>
                {hypothesis.status === 'pending' && 'Review needed'}
                {hypothesis.status === 'accepted' && 'Accepted'}
                {hypothesis.status === 'edited' && 'Modified'}
                {hypothesis.status === 'rejected' && 'Rejected'}
              </span>
              <ConfidenceBadge score={hypothesis.confidenceScore} size="sm" />
            </div>
            <h4 className="text-sm font-semibold text-white">{hypothesis.driver}</h4>
            <p className="text-xs text-white/50 mt-0.5">
              {formatCurrency(hypothesis.estimatedImpactMin)} — {formatCurrency(hypothesis.estimatedImpactMax)} annual
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {hypothesis.status === 'pending' && (
              <>
                <button
                  onClick={onAccept}
                  className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  title="Accept"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onReject}
                  className="p-2 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                  title="Reject"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isExpanded && node && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Evidence</div>
              <div className="text-xs text-white/70">{node.evidence.length} sources</div>
            </div>

            {node.assumptions.length > 0 && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Key Assumptions</div>
                <div className="space-y-1">
                  {node.assumptions.slice(0, 3).map((assumption) => (
                    <div key={assumption.id} className="flex items-center justify-between text-xs">
                      <span className="text-white/60">{assumption.label}</span>
                      <span className="text-white/40 font-mono">
                        {assumption.value}{assumption.unit ? ` ${assumption.unit}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewCanvas({
  hypotheses,
  valueGraph,
  defensibilityScore,
  onAcceptHypothesis,
  onRejectHypothesis,
  onBatchAccept,
  onBatchReject,
  className,
}: ReviewCanvasProps) {
  const pendingCount = hypotheses.filter(h => h.status === 'pending').length;
  const acceptedCount = hypotheses.filter(h => h.status === 'accepted').length;
  const rejectedCount = hypotheses.filter(h => h.status === 'rejected').length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/8">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-violet-400" />
            Review Value Model
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            {pendingCount} pending, {acceptedCount} accepted, {rejectedCount} rejected
          </p>
        </div>

        <div className="flex items-center gap-2">
          {defensibilityScore && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
              <span className="text-[10px] text-white/40">Confidence</span>
              <ConfidenceBadge score={defensibilityScore.global} size="sm" />
            </div>
          )}

          {pendingCount > 0 && (
            <>
              <button
                onClick={onBatchAccept}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
              >
                Accept all
              </button>
              <button
                onClick={onBatchReject}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-medium hover:bg-rose-500/30 transition-colors"
              >
                Reject all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Warning if low confidence */}
      {defensibilityScore && defensibilityScore.global < 0.7 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-300">
            Overall confidence is {Math.round(defensibilityScore.global * 100)}%. 
            Review flagged items carefully before finalizing.
          </span>
        </div>
      )}

      {/* Hypothesis cards */}
      <div className="space-y-2">
        {hypotheses.map((hypothesis) => {
          const node = valueGraph.find(n => n.id === hypothesis.nodeId);
          return (
            <HypothesisReviewCard
              key={hypothesis.id}
              hypothesis={hypothesis}
              node={node}
              onAccept={() => onAcceptHypothesis(hypothesis.id)}
              onReject={() => onRejectHypothesis(hypothesis.id)}
            />
          );
        })}
      </div>

      {hypotheses.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <Edit3 className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hypotheses to review</p>
        </div>
      )}
    </div>
  );
}
