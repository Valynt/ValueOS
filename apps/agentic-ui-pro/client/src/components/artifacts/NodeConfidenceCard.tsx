/**
 * NodeConfidenceCard
 *
 * Displays per-node confidence breakdown with coverage and source independence.
 * Part of the Confidence → Trust Layer architecture.
 *
 * Metrics: evidenceCoverage, sourceIndependence, auditTrailComplete
 */

import { CheckCircle2, AlertTriangle, Database, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeConfidence } from '@/types/agent-ux';

interface NodeConfidenceCardProps {
  nodeConfidence: NodeConfidence;
  className?: string;
}

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/50">{label}</span>
          <span className="text-xs font-mono text-white/70">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function NodeConfidenceCard({ nodeConfidence, className }: NodeConfidenceCardProps) {
  const { score, evidenceCoverage, sourceIndependence, auditTrailComplete, warnings } = nodeConfidence;
  const hasWarnings = warnings.length > 0;
  const scoreColor = score >= 0.85 ? 'bg-emerald-500' : score >= 0.7 ? 'bg-amber-500' : 'bg-orange-500';

  return (
    <div className={cn('rounded-xl border border-white/8 bg-white/3 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <span className="text-xs text-white/50">Node Confidence</span>
        <div className="flex items-center gap-2">
          {auditTrailComplete ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className={cn('text-xs font-medium', score >= 0.85 ? 'text-emerald-300' : 'text-amber-300')}>
            {Math.round(score * 100)}%
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 space-y-3">
        <Gauge
          value={evidenceCoverage}
          label="Evidence Coverage"
          color={evidenceCoverage >= 0.8 ? 'bg-emerald-500' : evidenceCoverage >= 0.5 ? 'bg-amber-500' : 'bg-orange-500'}
        />
        <Gauge
          value={sourceIndependence}
          label="Source Independence"
          color={sourceIndependence >= 0.8 ? 'bg-emerald-500' : sourceIndependence >= 0.5 ? 'bg-amber-500' : 'bg-orange-500'}
        />

        {/* Audit trail status */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/6">
          <Database className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs text-white/50">
            Audit trail {auditTrailComplete ? 'complete' : 'incomplete'}
          </span>
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="px-4 pb-4 space-y-1.5">
          {warnings.map((warning) => (
            <div
              key={warning.type}
              className={cn(
                'flex items-start gap-2 p-2 rounded-lg',
                warning.severity === 'critical' ? 'bg-rose-500/10' : 'bg-amber-500/10'
              )}
            >
              <AlertTriangle className={cn(
                'w-3.5 h-3.5 flex-shrink-0 mt-0.5',
                warning.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/70">{warning.message}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{warning.remediation}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
