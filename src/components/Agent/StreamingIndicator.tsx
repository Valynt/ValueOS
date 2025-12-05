import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { StreamingUpdate } from '../../services/AgentOrchestrator';

interface StreamingIndicatorProps {
  update: StreamingUpdate;
  position: { x: number; y: number };
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  update,
  position
}) => {
  const getStageColor = () => {
    switch (update.stage) {
      case 'analyzing':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-purple-500';
      case 'generating':
        return 'bg-green-500';
      case 'complete':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStageIcon = () => {
    if (update.stage === 'complete') {
      return <Sparkles className="h-4 w-4 text-white" />;
    }
    return <Loader2 className="h-4 w-4 text-white animate-spin" />;
  };

  return (
    <div
      className="absolute z-50 pointer-events-none animate-fade-in"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className={`px-4 py-2 ${getStageColor()} flex items-center space-x-2`}>
          {getStageIcon()}
          <span className="text-white text-sm font-medium capitalize">
            {update.stage}
          </span>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700">{update.message}</p>
          {update.progress !== undefined && (
            <div className="mt-2 w-48">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getStageColor()} transition-all duration-500`}
                  style={{ width: `${update.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
