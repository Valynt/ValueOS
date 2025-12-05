import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import type { WorkflowNavigationProps } from './types';

export const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({
  onPrevious,
  onNext,
  onComplete,
  canProceed,
  isFirstStage,
  isLastStage,
  currentStage,
  nextStage
}) => {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onPrevious}
        disabled={isFirstStage}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
          isFirstStage
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Previous</span>
      </button>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Current: <span className="font-medium text-gray-900">{currentStage}</span>
        </p>
        {!isLastStage && nextStage && (
          <p className="text-xs text-gray-500 mt-1">
            Next: {nextStage}
          </p>
        )}
      </div>

      {!isLastStage ? (
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span>Next</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={onComplete}
          disabled={!canProceed}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors ${
            canProceed
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span>Complete</span>
          <CheckCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
