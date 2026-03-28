/**
 * HumanCheckpointPanel
 *
 * The human-in-the-loop decision gate.
 * Presents a clear decision with context, options, and consequences.
 * Never blocks without explanation — always shows why the pause happened.
 */

import { AlertTriangle, CheckCircle2, Clock, Shield, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HumanCheckpoint } from '@/types/agent-ux';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';

interface HumanCheckpointPanelProps {
  checkpoint: HumanCheckpoint;
  onDecide: (optionId: string) => void;
  className?: string;
}

const RISK_CONFIG = {
  low: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  medium: { color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle },
  high: { color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: Shield },
};

export function HumanCheckpointPanel({ checkpoint, onDecide, className }: HumanCheckpointPanelProps) {
  const riskConfig = RISK_CONFIG[checkpoint.riskLevel];
  const RiskIcon = riskConfig.icon;

  const deadline = checkpoint.deadline
    ? new Date(checkpoint.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={cn('rounded-xl border overflow-hidden', riskConfig.border, riskConfig.bg, className)}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 px-4 py-3 border-b', riskConfig.border)}>
        <RiskIcon className={cn('w-5 h-5 flex-shrink-0', riskConfig.color)} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{checkpoint.title}</div>
          <div className={cn('text-xs mt-0.5', riskConfig.color)}>
            {checkpoint.type === 'approval' ? 'Approval Required' :
             checkpoint.type === 'gap_fill' ? 'Information Required' :
             checkpoint.type === 'assumption_confirm' ? 'Confirmation Required' :
             'Override Required'}
          </div>
        </div>
        <ConfidenceBadge score={checkpoint.confidence} size="sm" />
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        <p className="text-sm text-white/70 leading-relaxed">{checkpoint.description}</p>

        {/* Context metrics */}
        {checkpoint.context && Object.keys(checkpoint.context).length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {checkpoint.context.defensibilityScore !== undefined && (
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] text-white/40">Defensibility</div>
                <div className="text-sm font-bold text-white font-mono">
                  {Math.round((checkpoint.context.defensibilityScore as number) * 100)}%
                </div>
              </div>
            )}
            {checkpoint.context.totalValue !== undefined && (
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] text-white/40">Total Value</div>
                <div className="text-sm font-bold text-white font-mono">
                  ${((checkpoint.context.totalValue as number) / 1_000_000).toFixed(2)}M
                </div>
              </div>
            )}
            {checkpoint.context.roi !== undefined && (
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] text-white/40">ROI</div>
                <div className="text-sm font-bold text-white font-mono">
                  {checkpoint.context.roi as number}%
                </div>
              </div>
            )}
            {checkpoint.context.paybackMonths !== undefined && (
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] text-white/40">Payback</div>
                <div className="text-sm font-bold text-white font-mono">
                  {checkpoint.context.paybackMonths as number} months
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deadline */}
        {deadline && (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Clock className="w-3 h-3" />
            <span>Decision needed by {deadline}</span>
          </div>
        )}

        {/* Options */}
        <div className="space-y-2">
          {checkpoint.options.map((option) => (
            <button
              key={option.id}
              onClick={() => onDecide(option.id)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-all',
                option.id === 'approve' || option.isDefault
                  ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                  : option.id === 'reject'
                  ? 'border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/30'
                  : 'border-white/10 bg-white/3 hover:bg-white/6 hover:border-white/20'
              )}
            >
              <div className={cn(
                'text-sm font-medium mb-0.5',
                option.id === 'approve' || option.isDefault ? 'text-emerald-300' :
                option.id === 'reject' ? 'text-rose-300' : 'text-white/80'
              )}>
                {option.label}
              </div>
              <div className="text-xs text-white/50">{option.description}</div>
              <div className="text-[10px] text-white/30 mt-1 italic">{option.consequence}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
