/**
 * HeadlineValueCard
 *
 * Translates raw value metrics into a scannable business artifact.
 * Displays ROI, payback period, and confidence as a unified headline.
 *
 * Architecture: Raw JSON → ValueHypothesis → HeadlineValueCard
 */

import { TrendingUp, Clock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';

interface HeadlineValueCardProps {
  roi: number;
  paybackMonths: number;
  confidence: number;
  scenario: 'conservative' | 'base' | 'upside';
  annualValue: number;
  className?: string;
  onClick?: () => void;
}

const SCENARIO_CONFIG = {
  conservative: { color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Conservative' },
  base: { color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'Base Case' },
  upside: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Upside' },
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function HeadlineValueCard({
  roi,
  paybackMonths,
  confidence,
  scenario,
  annualValue,
  className,
  onClick,
}: HeadlineValueCardProps) {
  const config = SCENARIO_CONFIG[scenario];

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-white/3 overflow-hidden',
        config.border,
        onClick && 'cursor-pointer hover:bg-white/5 transition-colors',
        className
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-2 border-b', config.border, config.bg)}>
        <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
        <ConfidenceBadge score={confidence} size="sm" />
      </div>

      {/* Main value */}
      <div className="p-4">
        <div className="text-xs text-white/40 mb-1">Annual Value</div>
        <div
          className={cn(
            "text-2xl font-bold text-white font-mono",
            onClick && "cursor-pointer hover:text-violet-300 transition-colors underline decoration-dotted decoration-white/30 underline-offset-4"
          )}
          title={onClick ? "Click to see calculation" : undefined}
        >
          {formatCurrency(annualValue)}
        </div>
        {onClick && (
          <div className="text-[10px] text-white/30 mt-1">Click to view derivation</div>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-white">{roi}%</div>
              <div className="text-[10px] text-white/40">ROI</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-white">{paybackMonths}mo</div>
              <div className="text-[10px] text-white/40">Payback</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-white">{Math.round(confidence * 100)}%</div>
              <div className="text-[10px] text-white/40">Confidence</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
