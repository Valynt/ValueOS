/**
 * IntegrityPanel
 *
 * Phase 3: Validate — shows the full trust and defensibility picture.
 * Every claim is explainable. Every risk is surfaced. Every gap is actionable.
 */

import { AlertTriangle, CheckCircle2, Info, Shield, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DefensibilityScore, DefensibilityIssue } from '@/types/agent-ux';
import { DefensibilityScoreCard } from '@/components/trust/DefensibilityScoreCard';
import { SkeletonCard } from '@/components/async/StreamingText';

interface IntegrityPanelProps {
  defensibilityScore: DefensibilityScore | null;
  isLoading: boolean;
  className?: string;
}

const ISSUE_TYPE_LABELS: Record<DefensibilityIssue['type'], string> = {
  evidence_gap: 'Evidence Gap',
  low_confidence: 'Low Confidence',
  single_source: 'Single Source',
  stale_evidence: 'Stale Evidence',
  unsupported_claim: 'Unsupported Claim',
  benchmark_mismatch: 'Benchmark Mismatch',
};

function IssueRow({ issue }: { issue: DefensibilityIssue }) {
  const severityConfig = {
    blocking: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/8', border: 'border-rose-500/20' },
    critical: { icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/8', border: 'border-rose-500/20' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/20' },
  };
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div className={cn('p-3 rounded-lg border', config.bg, config.border)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-medium text-white/80">{ISSUE_TYPE_LABELS[issue.type]}</span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>
              {issue.severity}
            </span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">{issue.description}</p>
          <div className="mt-1.5 p-2 rounded bg-white/3">
            <div className="text-[10px] text-white/40 font-medium mb-0.5">Remediation</div>
            <p className="text-xs text-white/50">{issue.remediation}</p>
          </div>
          {issue.canAutoResolve && (
            <button className="mt-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              Auto-resolve →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function IntegrityPanel({ defensibilityScore, isLoading, className }: IntegrityPanelProps) {
  if (isLoading && !defensibilityScore) {
    return (
      <div className={cn('space-y-3', className)}>
        <SkeletonCard label="Running plausibility checks..." />
        <SkeletonCard label="Stress-testing assumptions..." />
        <SkeletonCard label="Calculating defensibility score..." />
      </div>
    );
  }

  if (!defensibilityScore) return null;

  const blockingIssues = defensibilityScore.issues.filter(i => i.severity === 'blocking' || i.severity === 'critical');
  const warningIssues = defensibilityScore.issues.filter(i => i.severity === 'warning');
  const infoIssues = defensibilityScore.issues.filter(i => i.severity === 'info');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Score card */}
      <DefensibilityScoreCard score={defensibilityScore} />

      {/* Issues by severity */}
      {blockingIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-xs font-medium text-rose-300">Critical Issues ({blockingIssues.length})</span>
          </div>
          <div className="space-y-2">
            {blockingIssues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
          </div>
        </div>
      )}

      {warningIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">Warnings ({warningIssues.length})</span>
          </div>
          <div className="space-y-2">
            {warningIssues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
          </div>
        </div>
      )}

      {infoIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300">Informational ({infoIssues.length})</span>
          </div>
          <div className="space-y-2">
            {infoIssues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
          </div>
        </div>
      )}

      {defensibilityScore.issues.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-300">No integrity issues found</span>
        </div>
      )}
    </div>
  );
}
