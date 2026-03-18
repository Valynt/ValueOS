/**
 * StateBadge Component - Displays current workflow phase
 */

import { WorkflowState } from '../../types/workflow.types';

interface StateBadgeProps {
  state: WorkflowState;
  phaseProgress?: number;
}

export function StateBadge({ state, phaseProgress }: StateBadgeProps) {
  const { color, label } = getStateConfig(state);

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${color} text-sm font-medium`}>
      <span>{label}</span>
      {phaseProgress !== undefined && (
        <span className="text-xs opacity-75">({phaseProgress}/7)</span>
      )}
    </div>
  );
}

function getStateConfig(state: WorkflowState): { color: string; label: string } {
  switch (state) {
    case 'INITIATED':
      return { color: 'bg-gray-100 text-gray-700', label: 'Initiated' };
    case 'DRAFTING':
      return { color: 'bg-blue-100 text-blue-700', label: 'Drafting' };
    case 'VALIDATING':
      return { color: 'bg-amber-100 text-amber-700', label: 'Validating' };
    case 'COMPOSING':
      return { color: 'bg-purple-100 text-purple-700', label: 'Composing' };
    case 'REFINING':
      return { color: 'bg-orange-100 text-orange-700', label: 'Refining' };
    case 'FINALIZED':
      return { color: 'bg-green-100 text-green-700', label: 'Finalized' };
    default:
      return { color: 'bg-gray-100 text-gray-700', label: state };
  }
}
