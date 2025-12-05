/**
 * Session Resume Banner Component
 * 
 * Displays notification when resuming a previous workflow session.
 * 
 * Phase 4: UX Polish
 */

import React from 'react';
import { Clock, Play, Trash2, X } from 'lucide-react';

export interface SessionResumeBannerProps {
  sessionId: string;
  resumedAt: Date;
  stage: string;
  caseId?: string;
  caseName?: string;
  onViewHistory?: () => void;
  onStartFresh?: () => void;
  onDismiss?: () => void;
}

/**
 * Session Resume Banner
 * 
 * Shows when user resumes a previous workflow session
 */
export const SessionResumeBanner: React.FC<SessionResumeBannerProps> = ({
  sessionId,
  resumedAt,
  stage,
  caseId,
  caseName,
  onViewHistory,
  onStartFresh,
  onDismiss,
}) => {
  const [isDismissed, setIsDismissed] = React.useState(false);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago';
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getStageDisplayName = (stage: string): string => {
    const stageMap: Record<string, string> = {
      opportunity: 'Opportunity',
      target: 'Target',
      realization: 'Realization',
      expansion: 'Expansion',
    };
    return stageMap[stage] || stage;
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-r-lg shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">
              Session Resumed
            </h4>
            <p className="text-sm text-blue-800">
              Continuing from <strong>{getStageDisplayName(stage)}</strong> stage
              {caseName && <span> • <strong>{caseName}</strong></span>}
              {' '}• Last active {formatTimeAgo(resumedAt)}
            </p>
            
            {sessionId && (
              <p className="text-xs text-blue-600 mt-1 font-mono">
                Session ID: {sessionId.slice(0, 12)}...
              </p>
            )}

            <div className="flex gap-2 mt-3">
              {onViewHistory && (
                <button
                  onClick={onViewHistory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white 
                           text-blue-700 rounded-md text-sm font-medium hover:bg-blue-100 
                           transition-colors border border-blue-300"
                >
                  <Play className="w-3.5 h-3.5" />
                  View History
                </button>
              )}

              {onStartFresh && (
                <button
                  onClick={onStartFresh}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white 
                           text-blue-700 rounded-md text-sm font-medium hover:bg-blue-100 
                           transition-colors border border-blue-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Start Fresh
                </button>
              )}
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-blue-100 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-blue-600" />
          </button>
        )}
      </div>
    </div>
  );
};
