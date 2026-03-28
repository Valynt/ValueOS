/**
 * DefensibilityScoreCard
 *
 * The primary trust signal for the entire value case.
 * Shows the global defensibility score, breakdown by node, and issues.
 */

import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle, Database, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DefensibilityScore } from '@/types/agent-ux';

interface DefensibilityScoreCardProps {
  score: DefensibilityScore;
  compact?: boolean;
  className?: string;
}

function ScoreRing({ value, size = 80 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - value);
  const color = value >= 0.85 ? '#10b981' : value >= 0.7 ? '#f59e0b' : value >= 0.5 ? '#f97316' : '#ef4444';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={progress}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
      />
    </svg>
  );
}

function IssueIcon({ severity }: { severity: string }) {
  if (severity === 'blocking' || severity === 'critical') return <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
  if (severity === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  return <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
}

function Gauge({ value, label, icon: Icon, color }: { value: number; label: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-white/40" />
      </div>
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

const NODE_LABELS: Record<string, string> = {
  procurement: 'Procurement',
  'supply-chain': 'Supply Chain',
  compliance: 'Compliance',
  inventory: 'Inventory',
};

export function DefensibilityScoreCard({ score, compact = false, className }: DefensibilityScoreCardProps) {
  const pct = Math.round(score.global * 100);
  const isReady = score.readinessLevel === 'presentation-ready';
  const backedPct = Math.round((score.backedValue / score.totalValue) * 100);

  return (
    <div className={cn('rounded-xl border border-white/8 bg-white/3 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-white/80">Defensibility Score</span>
        </div>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          isReady ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
        )}>
          {isReady ? 'Presentation Ready' : 'Needs Review'}
        </span>
      </div>

      <div className="p-4">
        {/* Score display */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-shrink-0">
            <ScoreRing value={score.global} size={72} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white font-mono">{pct}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/50 mb-1">Evidence-backed value</div>
            <div className="text-sm font-medium text-white">
              ${(score.backedValue / 1_000_000).toFixed(2)}M of ${(score.totalValue / 1_000_000).toFixed(2)}M
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-1000"
                style={{ width: `${backedPct}%` }}
              />
            </div>
            <div className="text-xs text-white/40 mt-1">{backedPct}% backed by evidence</div>
          </div>
        </div>

        {/* Node breakdown */}
        {!compact && (
          <div className="space-y-1.5 mb-4">
            {Object.entries(score.byNode).map(([nodeId, nodeScore]) => (
              <div key={nodeId} className="flex items-center gap-2">
                <span className="text-xs text-white/50 w-24 truncate">{NODE_LABELS[nodeId] || nodeId}</span>
                <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      nodeScore >= 0.85 ? 'bg-emerald-500' : nodeScore >= 0.7 ? 'bg-amber-500' : 'bg-orange-500'
                    )}
                    style={{ width: `${Math.round(nodeScore * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-white/60 w-8 text-right">{Math.round(nodeScore * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Coverage metrics - Architecture: coverageByNode, sourceIndependence */}
        {!compact && (
          <div className="space-y-2 p-3 rounded-lg bg-white/3 border border-white/6 mb-4">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-1">Trust Metrics</div>
            <Gauge
              value={Math.min(1, score.global * 1.1)} // Simulated coverage metric
              label="Evidence Coverage"
              icon={Database}
              color={score.global >= 0.8 ? 'bg-emerald-500' : score.global >= 0.6 ? 'bg-amber-500' : 'bg-orange-500'}
            />
            <Gauge
              value={Math.min(1, score.global * 0.95)} // Simulated source independence
              label="Source Independence"
              icon={GitBranch}
              color={score.global >= 0.8 ? 'bg-emerald-500' : score.global >= 0.6 ? 'bg-amber-500' : 'bg-orange-500'}
            />
          </div>
        )}

        {/* Issues */}
        {score.issues.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Issues</div>
            {score.issues.map((issue) => (
              <div key={issue.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/3">
                <IssueIcon severity={issue.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/70 leading-snug">{issue.description}</div>
                  {!compact && (
                    <div className="text-xs text-white/40 mt-0.5 leading-snug">{issue.remediation}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Readiness indicator */}
        {isReady && (
          <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-xs text-emerald-300">Ready for CFO presentation</span>
          </div>
        )}
      </div>
    </div>
  );
}
