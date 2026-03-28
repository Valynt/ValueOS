/**
 * StepperWizard
 *
 * Persistent step indicator showing progress through 4-phase journey.
 * Gives users a clear sense of where they are and what's next.
 * Always visible during active workflow, collapses on FINALIZED.
 */

import { CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  label: string;
  description: string;
  icon: typeof Circle;
}

interface StepperWizardProps {
  currentStep: string;
  completedSteps: string[];
  className?: string;
  onStepClick?: (stepId: string) => void;
}

const STEPS: Step[] = [
  { id: 'discovery', label: 'Discover', description: 'Opportunity context', icon: Circle },
  { id: 'model', label: 'Analyze', description: 'Value model', icon: Circle },
  { id: 'integrity', label: 'Validate', description: 'Check accuracy', icon: Circle },
  { id: 'artifacts', label: 'Decide', description: 'Executive output', icon: Circle },
];

export function StepperWizard({ currentStep, completedSteps, className, onStepClick }: StepperWizardProps) {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isFuture = index > currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => isCompleted && onStepClick?.(step.id)}
              disabled={isFuture}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                isCompleted
                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                  : isCurrent
                  ? 'text-violet-400 bg-violet-500/10'
                  : 'text-white/30'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center border-2',
                isCompleted
                  ? 'border-emerald-500 bg-emerald-500/20'
                  : isCurrent
                  ? 'border-violet-500 bg-violet-500/20 animate-pulse'
                  : 'border-white/20'
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-bold">{index + 1}</span>
                )}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-medium">{step.label}</div>
                <div className={cn(
                  'text-[10px]',
                  isCompleted || isCurrent ? 'opacity-70' : 'opacity-40'
                )}>
                  {step.description}
                </div>
              </div>
            </button>

            {index < STEPS.length - 1 && (
              <ChevronRight className={cn(
                'w-4 h-4 mx-1',
                isCompleted ? 'text-emerald-500/50' : 'text-white/10'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
