/**
 * TopNav Component - Global navigation and workflow indicators
 */

import { useStateGating } from '../../hooks/useStateGating';
import { useWorkflowState } from '../../hooks/useWorkflowState';
import { StateBadge } from '../header/StateBadge';

export function TopNav() {
  const { phase, currentStep, steps } = useWorkflowState();
  const { canApprove } = useStateGating();

  return (
    <nav className="flex items-center justify-between px-4 py-2 bg-card border-b border-neutral-200">
      <div className="flex items-center gap-4">
        <div className="font-bold text-lg">ValueOS</div>
        <div className="h-6 w-px bg-neutral-300" />
        <div className="text-sm text-neutral-600">
          Living Value Graph
        </div>
      </div>

      <div className="flex items-center gap-4">
        <StateBadge state={phase} phaseProgress={getPhaseProgress(steps)} />
        
        {canApprove && (
          <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
            Approve
          </button>
        )}
      </div>
    </nav>
  );
}

function getPhaseProgress(steps: { status: string }[]): number {
  const completed = steps.filter(s => s.status === 'complete').length;
  return completed;
}
