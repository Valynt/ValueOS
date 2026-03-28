/**
 * WorkflowProgressBar
 *
 * The primary progress indicator for the async workflow.
 * Always answers: "What's happening?" and "How far along are we?"
 * Never shows a dead/empty state — always communicates status.
 */

import { CheckCircle2, Clock, Loader2, Pause, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowProgress, WorkflowState } from '@/types/agent-ux';
import { STATE_EXPERIENCE_MAP } from '@/types/agent-ux';

interface WorkflowProgressBarProps {
  progress: WorkflowProgress | null;
  workflowState: WorkflowState;
  className?: string;
}

const JOURNEY_PHASES = [
  { id: 'discover', label: 'Discover', states: ['INITIATED'] as WorkflowState[] },
  { id: 'analyze', label: 'Analyze', states: ['DRAFTING'] as WorkflowState[] },
  { id: 'validate', label: 'Validate', states: ['VALIDATING'] as WorkflowState[] },
  { id: 'decide', label: 'Decide', states: ['COMPOSING', 'REFINING', 'FINALIZED'] as WorkflowState[] },
];

function StatusIcon({ status }: { status: WorkflowProgress['status'] }) {
  switch (status) {
    case 'running': return <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />;
    case 'paused': return <Pause className="w-3.5 h-3.5 text-amber-400" />;
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'failed': return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
    case 'blocked': return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    default: return null;
  }
}

function getPhaseStatus(phase: typeof JOURNEY_PHASES[0], currentState: WorkflowState): 'complete' | 'active' | 'pending' {
  const stateOrder: WorkflowState[] = ['INITIATED', 'DRAFTING', 'VALIDATING', 'COMPOSING', 'REFINING', 'FINALIZED'];
  const currentIdx = stateOrder.indexOf(currentState);

  if (phase.states.includes(currentState)) return 'active';

  const phaseMaxIdx = Math.max(...phase.states.map(s => stateOrder.indexOf(s)));
  if (currentIdx > phaseMaxIdx) return 'complete';

  return 'pending';
}

export function WorkflowProgressBar({ progress, workflowState, className }: WorkflowProgressBarProps) {
  const experience = STATE_EXPERIENCE_MAP[workflowState];
  const percent = progress?.percentComplete ?? 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Status line */}
      <div className="flex items-center gap-2">
        {progress && <StatusIcon status={progress.status} />}
        <span className="text-sm text-white/70 flex-1 truncate">
          {progress?.statusMessage || experience.activeVerb}
        </span>
        <span className="text-xs font-mono text-white/40 flex-shrink-0">{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/8 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            workflowState === 'FINALIZED'
              ? 'bg-emerald-500'
              : progress?.status === 'failed'
              ? 'bg-rose-500'
              : progress?.status === 'paused'
              ? 'bg-amber-500'
              : 'bg-gradient-to-r from-violet-500 to-blue-500'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Phase stepper */}
      <div className="flex items-center gap-1">
        {JOURNEY_PHASES.map((phase, i) => {
          const status = getPhaseStatus(phase, workflowState);
          return (
            <div key={phase.id} className="flex items-center gap-1 flex-1">
              <div className="flex items-center gap-1.5 flex-1">
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                  status === 'complete' ? 'bg-emerald-500/20 border border-emerald-500/40' :
                  status === 'active' ? 'bg-violet-500/20 border border-violet-500/50 ring-2 ring-violet-500/20' :
                  'bg-white/5 border border-white/10'
                )}>
                  {status === 'complete' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <span className={cn(
                      'text-[9px] font-bold',
                      status === 'active' ? 'text-violet-300' : 'text-white/20'
                    )}>
                      {i + 1}
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium truncate',
                  status === 'complete' ? 'text-emerald-400' :
                  status === 'active' ? 'text-violet-300' :
                  'text-white/25'
                )}>
                  {phase.label}
                </span>
              </div>
              {i < JOURNEY_PHASES.length - 1 && (
                <div className={cn(
                  'flex-shrink-0 h-px w-4',
                  status === 'complete' ? 'bg-emerald-500/40' : 'bg-white/10'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Next action hint */}
      {experience.nextAction && workflowState !== 'FINALIZED' && (
        <div className="text-xs text-white/35 pl-1">
          <span className="text-white/20">Next: </span>
          {experience.nextAction}
        </div>
      )}
    </div>
  );
}
