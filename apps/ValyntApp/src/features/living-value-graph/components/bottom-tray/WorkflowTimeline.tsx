/**
 * WorkflowTimeline Component - Horizontal timeline showing phase transitions
 */

import { useWorkflowState } from '../../hooks/useWorkflowState';
import { WorkflowState } from '../../types/workflow.types';

export function WorkflowTimeline() {
  const { phaseHistory, phase } = useWorkflowState();

  const allPhases: WorkflowState[] = ['INITIATED', 'DRAFTING', 'VALIDATING', 'COMPOSING', 'REFINING', 'FINALIZED'];
  const currentPhaseIndex = allPhases.indexOf(phase);

  return (
    <div className="p-4">
      <h4 className="text-xs font-semibold text-neutral-500 uppercase mb-3">Workflow Timeline</h4>
      <div className="flex items-center gap-1">
        {allPhases.map((state, index) => {
          const historyEntry = phaseHistory.find(p => p.state === state);
          const isCurrent = state === phase;
          const isPast = index < currentPhaseIndex;
          const isFuture = index > currentPhaseIndex;

          return (
            <div key={state} className="flex items-center">
              <PhaseNode
                state={state}
                isCurrent={isCurrent}
                isPast={isPast}
                isFuture={isFuture}
                timestamp={historyEntry?.enteredAt}
                actor={historyEntry?.actor}
              />
              {index < allPhases.length - 1 && (
                <div className={`w-8 h-0.5 ${isPast ? 'bg-blue-500' : 'bg-neutral-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PhaseNodeProps {
  state: WorkflowState;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  timestamp?: string;
  actor?: string;
}

function PhaseNode({ state, isCurrent, isPast, isFuture, timestamp, actor }: PhaseNodeProps) {
  const colorClass = isCurrent
    ? 'bg-blue-500 text-white'
    : isPast
    ? 'bg-green-500 text-white'
    : 'bg-neutral-200 text-neutral-500';

  return (
    <div className="relative group">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${colorClass}`}>
        {state[0]}
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {state}
        {timestamp && (
          <div className="text-neutral-400">
            {new Date(timestamp).toLocaleDateString()} by {actor}
          </div>
        )}
      </div>
    </div>
  );
}
