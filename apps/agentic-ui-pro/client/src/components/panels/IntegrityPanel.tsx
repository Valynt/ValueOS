/**
 * IntegrityPanel
 *
 * Phase 3: Validate — shows the full trust and defensibility picture.
 * Every claim is explainable. Every risk is surfaced. Every gap is actionable.
 */

import { cn } from '@/lib/utils';
import type { DefensibilityScore } from '@/types/agent-ux';
import { DefensibilityScoreCard } from '@/components/trust/DefensibilityScoreCard';
import { IntegrityVetoPanel } from '@/components/trust/IntegrityVetoPanel';
import { SkeletonCard } from '@/components/async/StreamingText';

interface IntegrityPanelProps {
  defensibilityScore: DefensibilityScore | null;
  isLoading: boolean;
  className?: string;
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

  return (
    <div className={cn('space-y-4', className)}>
      {/* Score card */}
      <DefensibilityScoreCard score={defensibilityScore} />

      {/* Integrity veto panel - Architecture component for warnings/blockers */}
      <IntegrityVetoPanel
        issues={defensibilityScore.issues}
        onResolve={(issueId) => console.log('Resolve issue:', issueId)}
      />
    </div>
  );
}
