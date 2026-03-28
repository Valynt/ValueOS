/**
 * IntegrityVetoPanel
 *
 * Displays blocking issues and warnings that prevent workflow progression.
 * Part of the Confidence → Trust Layer architecture.
 *
 * UI Elements: DefensibilityScoreCard, ConfidenceBadge, EvidencePanel, IntegrityVetoPanel
 */

import { AlertTriangle, XCircle, Info, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DefensibilityIssue } from '@/types/agent-ux';

interface IntegrityVetoPanelProps {
  issues: DefensibilityIssue[];
  onResolve?: (issueId: string) => void;
  onDismiss?: (issueId: string) => void;
  className?: string;
}

const SEVERITY_CONFIG = {
  blocking: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Blocking' },
  critical: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Critical' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Info' },
};

const TYPE_LABELS: Record<DefensibilityIssue['type'], string> = {
  evidence_gap: 'Evidence Gap',
  low_confidence: 'Low Confidence',
  single_source: 'Single Source',
  stale_evidence: 'Stale Evidence',
  unsupported_claim: 'Unsupported Claim',
  benchmark_mismatch: 'Benchmark Mismatch',
};

function IssueCard({
  issue,
  onResolve,
  onDismiss,
}: {
  issue: DefensibilityIssue;
  onResolve?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const config = SEVERITY_CONFIG[issue.severity];
  const Icon = config.icon;
  const isBlocking = issue.severity === 'blocking' || issue.severity === 'critical';

  return (
    <div className={cn('rounded-xl border overflow-hidden', config.border, config.bg)}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
            <Icon className={cn('w-4 h-4', config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{TYPE_LABELS[issue.type]}</span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">{issue.description}</p>
          </div>
        </div>

        {/* Remediation */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1">Remediation</div>
          <p className="text-xs text-white/50">{issue.remediation}</p>
        </div>

        {/* Actions */}
        {(onResolve || onDismiss) && (
          <div className="flex items-center gap-2 mt-3">
            {issue.canAutoResolve && onResolve && (
              <button
                onClick={() => onResolve(issue.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 text-xs hover:bg-violet-500/25 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Auto-resolve
              </button>
            )}
            {onResolve && !issue.canAutoResolve && (
              <button
                onClick={() => onResolve(issue.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Mark resolved
              </button>
            )}
            {onDismiss && !isBlocking && (
              <button
                onClick={() => onDismiss(issue.id)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function IntegrityVetoPanel({ issues, onResolve, onDismiss, className }: IntegrityVetoPanelProps) {
  const blockingIssues = issues.filter(i => i.severity === 'blocking' || i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  const infoIssues = issues.filter(i => i.severity === 'info');

  if (issues.length === 0) {
    return (
      <div className={cn('rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4', className)}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-sm font-medium text-emerald-300">All Checks Passed</div>
            <div className="text-xs text-white/50">No integrity issues found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs">
        {blockingIssues.length > 0 && (
          <div className="flex items-center gap-1.5 text-rose-400">
            <XCircle className="w-3.5 h-3.5" />
            <span>{blockingIssues.length} blocking</span>
          </div>
        )}
        {warningIssues.length > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{warningIssues.length} warnings</span>
          </div>
        )}
        {infoIssues.length > 0 && (
          <div className="flex items-center gap-1.5 text-blue-400">
            <Info className="w-3.5 h-3.5" />
            <span>{infoIssues.length} notices</span>
          </div>
        )}
      </div>

      {/* Issues list */}
      <div className="space-y-2">
        {blockingIssues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onResolve={onResolve} onDismiss={onDismiss} />
        ))}
        {warningIssues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onResolve={onResolve} onDismiss={onDismiss} />
        ))}
        {infoIssues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onResolve={onResolve} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}
