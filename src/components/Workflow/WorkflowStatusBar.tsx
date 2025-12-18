import React from 'react';
import { AlertCircle, CheckCircle, Clock, Loader, User } from 'lucide-react';

interface WorkflowStatusBarProps {
  currentStage?: string;
  lastAgentAction?: string;
  agentName?: string;
  confidence?: number;
  hallucinationCheck?: boolean;
  isLoading?: boolean;
  estimatedTimeRemaining?: number;
}

export const WorkflowStatusBar: React.FC<WorkflowStatusBarProps> = ({
  currentStage,
  lastAgentAction,
  agentName,
  confidence,
  hallucinationCheck,
  isLoading = false,
  estimatedTimeRemaining,
}) => {
  const getConfidenceColor = (conf?: number) => {
    if (!conf) return 'text-gray-500';
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (conf?: number, hallucination?: boolean) => {
    if (hallucination === false) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (hallucination === true) return <AlertCircle className="w-4 h-4 text-red-600" />;
    if (!conf) return null;
    if (conf >= 0.8) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (conf >= 0.6) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center space-x-4">
        {/* Current Stage */}
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-600" />
          )}
          <span className="font-medium text-gray-900">
            {currentStage || 'Initializing...'}
          </span>
        </div>

        {/* Agent Info */}
        {agentName && (
          <div className="flex items-center space-x-2 text-gray-600">
            <User className="w-4 h-4" />
            <span>{agentName}</span>
          </div>
        )}

        {/* Last Action */}
        {lastAgentAction && (
          <div className="text-gray-600 max-w-xs truncate">
            {lastAgentAction}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Confidence Indicator */}
        {(confidence !== undefined || hallucinationCheck !== undefined) && (
          <div className="flex items-center space-x-1">
            {getConfidenceIcon(confidence, hallucinationCheck)}
            <span className={`text-xs ${getConfidenceColor(confidence)}`}>
              {confidence !== undefined ? `${Math.round(confidence * 100)}%` : 
               hallucinationCheck === false ? 'Verified' : 
               hallucinationCheck === true ? 'Flagged' : 'Unknown'}
            </span>
          </div>
        )}

        {/* ETA */}
        {estimatedTimeRemaining && (
          <div className="flex items-center space-x-1 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-xs">
              ~{Math.round(estimatedTimeRemaining / 1000)}s
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
