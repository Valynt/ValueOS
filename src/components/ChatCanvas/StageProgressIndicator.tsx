/**
 * Stage Progress Indicator Component
 * 
 * Visual indicator for lifecycle stage progression.
 * Shows current stage, completed stages, and available next stages.
 * 
 * Phase 4: UX Polish
 */

import React from 'react';
import { Check, ChevronRight, Circle } from 'lucide-react';

export interface StageProgressIndicatorProps {
  currentStage: string;
  completedStages: string[];
  onStageClick?: (stage: string) => void;
  compact?: boolean;
}

interface StageInfo {
  id: string;
  label: string;
  description: string;
  icon?: string;
}

const LIFECYCLE_STAGES: StageInfo[] = [
  {
    id: 'opportunity',
    label: 'Opportunity',
    description: 'Discover pain points and value hypotheses',
    icon: '🎯',
  },
  {
    id: 'target',
    label: 'Target',
    description: 'Build ROI models and business cases',
    icon: '💰',
  },
  {
    id: 'realization',
    label: 'Realization',
    description: 'Track value delivery against targets',
    icon: '📈',
  },
  {
    id: 'expansion',
    label: 'Expansion',
    description: 'Identify upsell and growth opportunities',
    icon: '🚀',
  },
];

/**
 * Stage Progress Indicator
 * 
 * Visual representation of workflow progression through lifecycle stages
 */
export const StageProgressIndicator: React.FC<StageProgressIndicatorProps> = ({
  currentStage,
  completedStages,
  onStageClick,
  compact = false,
}) => {
  const getStageStatus = (stageId: string): 'completed' | 'current' | 'upcoming' => {
    if (completedStages.includes(stageId)) return 'completed';
    if (stageId === currentStage) return 'current';
    return 'upcoming';
  };

  const getStageStyles = (status: 'completed' | 'current' | 'upcoming') => {
    switch (status) {
      case 'completed':
        return {
          container: 'bg-green-50 border-green-300',
          text: 'text-green-900',
          icon: 'bg-green-500 text-white',
          description: 'text-green-700',
        };
      case 'current':
        return {
          container: 'bg-blue-50 border-blue-400 ring-2 ring-blue-200',
          text: 'text-blue-900 font-semibold',
          icon: 'bg-blue-500 text-white',
          description: 'text-blue-700',
        };
      case 'upcoming':
        return {
          container: 'bg-gray-50 border-gray-200',
          text: 'text-gray-600',
          icon: 'bg-gray-300 text-gray-600',
          description: 'text-gray-500',
        };
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        {LIFECYCLE_STAGES.map((stage, index) => {
          const status = getStageStatus(stage.id);
          const styles = getStageStyles(status);

          return (
            <React.Fragment key={stage.id}>
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${
                  onStageClick ? 'cursor-pointer hover:bg-gray-100' : ''
                } ${status === 'current' ? 'bg-blue-100' : ''}`}
                onClick={() => onStageClick?.(stage.id)}
                title={stage.description}
              >
                {status === 'completed' ? (
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : status === 'current' ? (
                  <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
                <span className={`text-xs ${styles.text}`}>{stage.label}</span>
              </div>

              {index < LIFECYCLE_STAGES.length - 1 && (
                <ChevronRight className="w-3 h-3 text-gray-400" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Lifecycle Progress</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {LIFECYCLE_STAGES.map((stage) => {
          const status = getStageStatus(stage.id);
          const styles = getStageStyles(status);
          const isClickable = onStageClick && (status === 'completed' || status === 'current');

          return (
            <div
              key={stage.id}
              className={`relative p-4 rounded-lg border-2 transition-all ${styles.container} ${
                isClickable ? 'cursor-pointer hover:shadow-md' : ''
              }`}
              onClick={() => isClickable && onStageClick(stage.id)}
            >
              {/* Stage Icon/Status */}
              <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.icon}`}>
                  {status === 'completed' ? (
                    <Check className="w-5 h-5" />
                  ) : status === 'current' ? (
                    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="text-lg">{stage.icon}</span>
                  )}
                </div>

                {status === 'current' && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-200 text-blue-800 rounded">
                    Current
                  </span>
                )}
              </div>

              {/* Stage Label */}
              <h4 className={`text-sm font-medium mb-1 ${styles.text}`}>
                {stage.label}
              </h4>

              {/* Stage Description */}
              <p className={`text-xs ${styles.description}`}>
                {stage.description}
              </p>

              {/* Status Badge */}
              {status === 'completed' && (
                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
          <span className="font-medium">Overall Progress</span>
          <span className="text-gray-400">
            {completedStages.length} of {LIFECYCLE_STAGES.length} stages completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
            style={{
              width: `${(completedStages.length / LIFECYCLE_STAGES.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
