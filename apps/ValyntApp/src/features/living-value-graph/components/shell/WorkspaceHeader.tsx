/**
 * WorkspaceHeader Component - Header with key metrics and view controls
 */

import { useWorkflowState } from '../../hooks/useWorkflowState';
import { useDefensibilityStore } from '../../store/defensibility-store';
import { DefensibilityScoreCard } from '../header/DefensibilityScoreCard';
import { StateBadge } from '../header/StateBadge';

export function WorkspaceHeader() {
  const { phase, steps } = useWorkflowState();
  const globalScore = useDefensibilityStore((state) => state.globalScore);

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-lg font-semibold">Opportunity Name</h1>
          <p className="text-sm text-neutral-500">Value Engineering Workspace</p>
        </div>

        <div className="flex items-center gap-4">
          <StateBadge state={phase} phaseProgress={steps.filter(s => s.status === 'complete').length} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DefensibilityScoreCard
          score={globalScore}
          breakdown={{
            backedByEvidence: 42000000,
            totalValue: 48000000,
            coveragePercent: globalScore * 100,
          }}
          threshold={0.7}
          isBlocking={globalScore < 0.7}
        />
      </div>
    </header>
  );
}
