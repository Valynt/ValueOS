/**
 * BottomTray Component - Bottom panel with workflow timeline and feeds
 */

import { useWorkflowState } from '../../hooks/useWorkflowState';

export function BottomTray() {
  const { phaseHistory } = useWorkflowState();

  return (
    <div className="h-48 bg-white border-t border-neutral-200 flex">
      <div className="flex-1 p-4 overflow-y-auto">
        <h4 className="text-xs font-semibold text-neutral-500 uppercase mb-2">Workflow Timeline</h4>
        <div className="space-y-1">
          {phaseHistory.map((phase, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span className="text-neutral-400">{new Date(phase.enteredAt).toLocaleTimeString()}</span>
              <span className="font-medium">{phase.state}</span>
              <span className="text-neutral-500">by {phase.actor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
