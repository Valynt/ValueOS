/**
 * LifecycleStageNav Component
 *
 * Navigation component for the Value Case lifecycle stages.
 * Shows progress through Discovery -> Modeling -> Realization -> Expansion
 */

import React from 'react';
import {
  Check,
  ChevronRight,
  Rocket,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LifecycleStage } from '@/types/vos';

export interface LifecycleStageNavProps {
  /** Current active stage */
  currentStage: LifecycleStage;
  /** Callback when stage is changed */
  onStageChange: (stage: LifecycleStage) => void;
  /** Map of stage completion status */
  stageCompletion?: Partial<Record<LifecycleStage, boolean>>;
  /** Whether navigation is disabled */
  disabled?: boolean;
}

interface StageConfig {
  id: LifecycleStage;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StageConfig[] = [
  {
    id: 'opportunity',
    label: 'Discovery',
    description: 'Identify pain points and objectives',
    icon: Search,
  },
  {
    id: 'target',
    label: 'Modeling',
    description: 'Build ROI model and quantify value',
    icon: Target,
  },
  {
    id: 'realization',
    label: 'Realization',
    description: 'Track value delivery',
    icon: TrendingUp,
  },
  {
    id: 'expansion',
    label: 'Expansion',
    description: 'Identify growth opportunities',
    icon: Rocket,
  },
];

export function LifecycleStageNav({
  currentStage,
  onStageChange,
  stageCompletion = {},
  disabled = false,
}: LifecycleStageNavProps) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <nav className="flex items-center gap-1" aria-label="Lifecycle stages">
      {STAGES.map((stage, index) => {
        const isActive = stage.id === currentStage;
        const isCompleted = stageCompletion[stage.id] === true;
        const isPast = index < currentIndex;
        const isFuture = index > currentIndex;
        const Icon = stage.icon;

        return (
          <React.Fragment key={stage.id}>
            <button
              onClick={() => !disabled && onStageChange(stage.id)}
              disabled={disabled}
              className={cn(
                'group relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isActive && 'bg-primary text-primary-foreground',
                !isActive && isCompleted && 'bg-green-100 text-green-700 hover:bg-green-200',
                !isActive && isPast && !isCompleted && 'bg-muted text-muted-foreground hover:bg-muted/80',
                !isActive && isFuture && 'bg-transparent text-muted-foreground hover:bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              aria-current={isActive ? 'step' : undefined}
            >
              {/* Icon with completion indicator */}
              <div className="relative">
                {isCompleted && !isActive ? (
                  <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <Icon className={cn(
                    'w-5 h-5',
                    isActive && 'text-primary-foreground',
                    !isActive && 'text-current'
                  )} />
                )}
              </div>

              {/* Label */}
              <div className="hidden sm:block text-left">
                <p className={cn(
                  'text-sm font-medium',
                  isActive && 'text-primary-foreground',
                  !isActive && isCompleted && 'text-green-700',
                  !isActive && !isCompleted && 'text-current'
                )}>
                  {stage.label}
                </p>
                <p className={cn(
                  'text-xs',
                  isActive && 'text-primary-foreground/80',
                  !isActive && 'text-muted-foreground'
                )}>
                  {stage.description}
                </p>
              </div>

              {/* Mobile label */}
              <span className="sm:hidden text-sm font-medium">
                {stage.label}
              </span>
            </button>

            {/* Connector */}
            {index < STAGES.length - 1 && (
              <ChevronRight className={cn(
                'w-4 h-4 flex-shrink-0',
                index < currentIndex ? 'text-green-500' : 'text-muted-foreground/50'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * Compact version for mobile or sidebar use
 */
export function LifecycleStageNavCompact({
  currentStage,
  onStageChange,
  stageCompletion = {},
  disabled = false,
}: LifecycleStageNavProps) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="flex items-center gap-2">
      {STAGES.map((stage, index) => {
        const isActive = stage.id === currentStage;
        const isCompleted = stageCompletion[stage.id] === true;
        const Icon = stage.icon;

        return (
          <button
            key={stage.id}
            onClick={() => !disabled && onStageChange(stage.id)}
            disabled={disabled}
            className={cn(
              'relative p-2 rounded-full transition-all',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isActive && 'bg-primary text-primary-foreground',
              !isActive && isCompleted && 'bg-green-100 text-green-700',
              !isActive && !isCompleted && 'bg-muted text-muted-foreground hover:bg-muted/80',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            title={`${stage.label}: ${stage.description}`}
          >
            {isCompleted && !isActive ? (
              <Check className="w-4 h-4" />
            ) : (
              <Icon className="w-4 h-4" />
            )}

            {/* Progress indicator */}
            {index < STAGES.length - 1 && (
              <div className={cn(
                'absolute top-1/2 -right-2 w-2 h-0.5 -translate-y-1/2',
                index < currentIndex ? 'bg-green-500' : 'bg-muted-foreground/30'
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}
