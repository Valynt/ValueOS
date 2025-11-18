import React from 'react';
import {
  Lightbulb,
  Target,
  TrendingUp,
  Rocket,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

/**
 * Lifecycle stage types
 */
export type LifecycleStage = 'Opportunity' | 'Target' | 'Realization' | 'Expansion' | 'Integrity';

/**
 * Props for LifecyclePanel component
 */
export interface LifecyclePanelProps {
  /**
   * Current lifecycle stage
   */
  stage: LifecycleStage;

  /**
   * Panel content
   */
  children: React.ReactNode;

  /**
   * Optional title override
   */
  title?: string;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Show stage icon
   * @default true
   */
  showIcon?: boolean;

  /**
   * Show stage indicator
   * @default true
   */
  showIndicator?: boolean;

  /**
   * Panel variant
   * @default 'default'
   */
  variant?: 'default' | 'compact' | 'detailed';

  /**
   * Optional action buttons
   */
  actions?: React.ReactNode;

  /**
   * Callback when panel is clicked (for navigation)
   */
  onClick?: () => void;

  /**
   * Whether this stage is active/current
   */
  isActive?: boolean;

  /**
   * Whether this stage is completed
   */
  isCompleted?: boolean;
}

/**
 * Stage configuration
 */
const stageConfig: Record<
  LifecycleStage,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  Opportunity: {
    icon: Lightbulb,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    description: 'Discover and frame business problems',
  },
  Target: {
    icon: Target,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    description: 'Define and commit to value targets',
  },
  Realization: {
    icon: TrendingUp,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    description: 'Track and prove value delivery',
  },
  Expansion: {
    icon: Rocket,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    description: 'Identify and pursue expansion opportunities',
  },
  Integrity: {
    icon: ShieldCheck,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    description: 'Validate manifesto compliance',
  },
};

/**
 * LifecyclePanel - Generic panel container for each lifecycle stage
 *
 * Provides consistent styling and structure for all VOS lifecycle stages
 * with stage-specific colors, icons, and indicators.
 *
 * @example
 * ```tsx
 * <LifecyclePanel stage="Opportunity" isActive>
 *   <DiscoveryCard questions={['What is the problem?']} />
 * </LifecyclePanel>
 * ```
 */
export const LifecyclePanel: React.FC<LifecyclePanelProps> = ({
  stage,
  children,
  title,
  description,
  showIcon = true,
  showIndicator = true,
  variant = 'default',
  actions,
  onClick,
  isActive = false,
  isCompleted = false,
}) => {
  const config = stageConfig[stage];
  const Icon = config.icon;

  const isClickable = !!onClick;

  // Variant-specific classes
  const variantClasses = {
    default: 'p-6',
    compact: 'p-4',
    detailed: 'p-8',
  };

  return (
    <section
      className={`
        border-l-4 rounded-lg shadow-sm transition-all
        ${config.bgColor}
        ${config.borderColor}
        ${variantClasses[variant]}
        ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}
        ${isActive ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
        ${isCompleted ? 'opacity-75' : ''}
      `}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      data-testid="lifecycle-panel"
      data-stage={stage}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Icon */}
          {showIcon && (
            <div
              className={`flex-shrink-0 p-2 rounded-lg bg-white border ${config.borderColor}`}
            >
              <Icon className={`h-6 w-6 ${config.color}`} />
            </div>
          )}

          {/* Title and Description */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className={`text-xl font-bold ${config.color}`}>
                {title || `${stage} Stage`}
              </h2>
              {isCompleted && (
                <span className="px-2 py-0.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-300 rounded-full">
                  Completed
                </span>
              )}
              {isActive && (
                <span className="px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-300 rounded-full">
                  Active
                </span>
              )}
            </div>
            {(description || config.description) && (
              <p className="text-sm text-gray-600 mt-1">
                {description || config.description}
              </p>
            )}
          </div>

          {/* Navigation Arrow */}
          {isClickable && (
            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Stage Indicator */}
      {showIndicator && variant !== 'compact' && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  isCompleted
                    ? 'bg-green-500 w-full'
                    : isActive
                    ? 'bg-blue-500 w-1/2'
                    : 'bg-gray-300 w-0'
                } transition-all duration-500`}
              />
            </div>
            <span className="text-xs font-medium text-gray-600">
              {isCompleted ? '100%' : isActive ? '50%' : '0%'}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">{children}</div>

      {/* Actions */}
      {actions && (
        <div className="mt-6 pt-4 border-t border-gray-200 flex gap-2">{actions}</div>
      )}
    </section>
  );
};

/**
 * LifecycleTimeline - Shows all stages in a timeline view
 */
export interface LifecycleTimelineProps {
  /**
   * Current active stage
   */
  currentStage: LifecycleStage;

  /**
   * Completed stages
   */
  completedStages?: LifecycleStage[];

  /**
   * Callback when stage is clicked
   */
  onStageClick?: (stage: LifecycleStage) => void;

  /**
   * Show stage descriptions
   * @default false
   */
  showDescriptions?: boolean;
}

export const LifecycleTimeline: React.FC<LifecycleTimelineProps> = ({
  currentStage,
  completedStages = [],
  onStageClick,
  showDescriptions = false,
}) => {
  const stages: LifecycleStage[] = [
    'Opportunity',
    'Target',
    'Realization',
    'Expansion',
    'Integrity',
  ];

  return (
    <div className="relative" data-testid="lifecycle-timeline">
      {/* Timeline Line */}
      <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200" />

      {/* Stages */}
      <div className="relative flex justify-between">
        {stages.map((stage, index) => {
          const config = stageConfig[stage];
          const Icon = config.icon;
          const isActive = stage === currentStage;
          const isCompleted = completedStages.includes(stage);
          const isClickable = !!onStageClick;

          return (
            <div
              key={stage}
              className="flex flex-col items-center"
              style={{ width: `${100 / stages.length}%` }}
            >
              {/* Stage Icon */}
              <button
                onClick={isClickable ? () => onStageClick(stage) : undefined}
                disabled={!isClickable}
                className={`
                  relative z-10 p-3 rounded-full border-2 transition-all
                  ${
                    isCompleted
                      ? 'bg-green-500 border-green-600'
                      : isActive
                      ? `${config.bgColor} ${config.borderColor}`
                      : 'bg-white border-gray-300'
                  }
                  ${isClickable ? 'cursor-pointer hover:scale-110' : ''}
                  ${isActive ? 'ring-4 ring-blue-200' : ''}
                `}
                aria-label={stage}
              >
                <Icon
                  className={`h-6 w-6 ${
                    isCompleted
                      ? 'text-white'
                      : isActive
                      ? config.color
                      : 'text-gray-400'
                  }`}
                />
              </button>

              {/* Stage Label */}
              <div className="mt-3 text-center">
                <p
                  className={`text-sm font-semibold ${
                    isActive ? config.color : 'text-gray-600'
                  }`}
                >
                  {stage}
                </p>
                {showDescriptions && (
                  <p className="text-xs text-gray-500 mt-1 max-w-[120px]">
                    {config.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
