import React from 'react';
import { Check, Circle, Lock } from 'lucide-react';
import type { WorkflowProgressProps } from './types';

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  stages,
  currentStage,
  completedStages,
  onStageClick
}) => {
  return (
    <div className="flex items-center justify-between">
      {stages.map((stage, index) => {
        const isCompleted = completedStages.includes(stage.id);
        const isCurrent = stage.id === currentStage;
        const isClickable = isCompleted || isCurrent || 
          (index > 0 && completedStages.includes(stages[index - 1].id));
        
        return (
          <React.Fragment key={stage.id}>
            <button
              onClick={() => isClickable && onStageClick(stage.id)}
              disabled={!isClickable}
              className={`flex flex-col items-center space-y-2 px-3 py-2 rounded-lg transition-all ${
                isClickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                isCompleted ? 'bg-green-500 border-green-500' :
                isCurrent ? 'bg-blue-500 border-blue-500' :
                'bg-white border-gray-300'
              }`}>
                {isCompleted && <Check className="h-5 w-5 text-white" />}
                {isCurrent && <Circle className="h-5 w-5 text-white fill-current" />}
                {!isCompleted && !isCurrent && (
                  isClickable ? stage.icon : <Lock className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="text-center">
                <p className={`text-xs font-medium ${
                  isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {stage.label}
                </p>
                {stage.estimatedMinutes && (
                  <p className="text-xs text-gray-400">
                    ~{stage.estimatedMinutes} min
                  </p>
                )}
              </div>
            </button>
            
            {index < stages.length - 1 && (
              <div className={`flex-1 h-0.5 ${
                completedStages.includes(stages[index + 1].id) || 
                (isCurrent && index < stages.length - 1) 
                  ? 'bg-green-500' 
                  : 'bg-gray-300'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
