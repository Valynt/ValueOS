/**
 * WorkflowTimeline
 *
 * Visualizes the 7-step hypothesis loop grouped into 4 user-facing phases.
 * Provides context on which backend steps map to which UI phases.
 *
 * Architecture: 7-Step Loop → 4-Phase Journey
 */

import { CheckCircle2, Circle, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowState, WorkflowStep } from '@/types/agent-ux';

interface WorkflowTimelineProps {
  currentState: WorkflowState;
  completedSteps: WorkflowStep[];
  className?: string;
}

const PHASES = [
  {
    id: 'discover',
    label: 'Discover',
    description: 'Ingest signals and extract context',
    steps: ['hypothesis'] as WorkflowStep[],
    states: ['INITIATED'] as WorkflowState[],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Build value model and gather evidence',
    steps: ['model', 'evidence'] as WorkflowStep[],
    states: ['DRAFTING'] as WorkflowState[],
  },
  {
    id: 'validate',
    label: 'Validate',
    description: 'Stress-test and score defensibility',
    steps: ['objection', 'revision'] as WorkflowStep[],
    states: ['VALIDATING'] as WorkflowState[],
  },
  {
    id: 'decide',
    label: 'Decide',
    description: 'Generate artifacts and approve',
    steps: ['narrative', 'approval'] as WorkflowStep[],
    states: ['COMPOSING', 'REFINING', 'FINALIZED'] as WorkflowState[],
  },
];

const STEP_LABELS: Record<WorkflowStep, string> = {
  hypothesis: 'Hypothesis',
  model: 'Model',
  evidence: 'Evidence',
  narrative: 'Narrative',
  objection: 'Objection',
  revision: 'Revision',
  approval: 'Approval',
};

function StepIcon({ status }: { status: 'complete' | 'active' | 'pending' }) {
  if (status === 'complete') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'active') return <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />;
  return <Circle className="w-4 h-4 text-white/20" />;
}

export function WorkflowTimeline({ currentState, completedSteps, className }: WorkflowTimelineProps) {
  const stateOrder: WorkflowState[] = ['INITIATED', 'DRAFTING', 'VALIDATING', 'COMPOSING', 'REFINING', 'FINALIZED'];
  const currentIdx = stateOrder.indexOf(currentState);

  function getPhaseStatus(phase: typeof PHASES[0]): 'complete' | 'active' | 'pending' {
    if (phase.states.includes(currentState)) return 'active';
    const phaseMaxIdx = Math.max(...phase.states.map(s => stateOrder.indexOf(s)));
    if (currentIdx > phaseMaxIdx) return 'complete';
    return 'pending';
  }

  function getStepStatus(step: WorkflowStep): 'complete' | 'active' | 'pending' {
    if (completedSteps.includes(step)) return 'complete';
    // Step is active if we're in its phase
    const phase = PHASES.find(p => p.steps.includes(step));
    if (phase && phase.states.includes(currentState)) return 'active';
    return 'pending';
  }

  return (
    <div className={cn('space-y-4', className)}>
      {PHASES.map((phase) => {
        const phaseStatus = getPhaseStatus(phase);
        const isActive = phaseStatus === 'active';
        const isComplete = phaseStatus === 'complete';

        return (
          <div
            key={phase.id}
            className={cn(
              'rounded-xl border overflow-hidden transition-all',
              isActive ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/6 bg-white/2',
              isComplete && 'border-emerald-500/20 bg-emerald-500/5'
            )}
          >
            {/* Phase header */}
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 border-b',
              isActive ? 'border-violet-500/20' : 'border-white/6',
              isComplete && 'border-emerald-500/15'
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                isActive ? 'bg-violet-500/20' : isComplete ? 'bg-emerald-500/15' : 'bg-white/5'
              )}>
                {isComplete ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isActive ? (
                  <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                ) : (
                  <Lock className="w-3 h-3 text-white/20" />
                )}
              </div>
              <div className="flex-1">
                <div className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-violet-300' : isComplete ? 'text-emerald-300' : 'text-white/50'
                )}>
                  {phase.label}
                </div>
                <div className="text-xs text-white/40">{phase.description}</div>
              </div>
              <div className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                isActive ? 'bg-violet-500/15 text-violet-300' : isComplete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/30'
              )}>
                {phase.steps.length} steps
              </div>
            </div>

            {/* Steps */}
            <div className="p-3 space-y-1">
              {phase.steps.map((step) => {
                const stepStatus = getStepStatus(step);
                return (
                  <div
                    key={step}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                      stepStatus === 'active' ? 'bg-violet-500/10' : 'bg-transparent'
                    )}
                  >
                    <StepIcon status={stepStatus} />
                    <span className={cn(
                      'text-xs',
                      stepStatus === 'complete' ? 'text-emerald-300' :
                      stepStatus === 'active' ? 'text-violet-200' :
                      'text-white/30'
                    )}>
                      {STEP_LABELS[step]}
                    </span>
                    {stepStatus === 'complete' && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400/50 ml-auto" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
