/**
 * Error Recovery Component
 * 
 * User-friendly error handling UI with retry and recovery options.
 * 
 * Phase 4: UX Polish
 */

import React from 'react';
import { AlertCircle, RefreshCw, Trash2, Download, HelpCircle } from 'lucide-react';

export interface ErrorRecoveryProps {
  error: {
    message: string;
    code?: string;
    timestamp?: string;
    recoverable?: boolean;
  };
  onRetry?: () => void;
  onClearSession?: () => void;
  onExportConversation?: () => void;
  onContactSupport?: () => void;
}

/**
 * Error Recovery UI Component
 * 
 * Provides user-friendly error display with actionable recovery options
 */
export const ErrorRecovery: React.FC<ErrorRecoveryProps> = ({
  error,
  onRetry,
  onClearSession,
  onExportConversation,
  onContactSupport,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const getErrorSeverity = (code?: string): 'error' | 'warning' | 'info' => {
    if (!code) return 'error';
    if (code.startsWith('WARN')) return 'warning';
    if (code.startsWith('INFO')) return 'info';
    return 'error';
  };

  const severity = getErrorSeverity(error.code);

  const getSeverityStyles = () => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getSeverityIcon = () => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${getSeverityStyles()}`}>
      {/* Error Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getSeverityIcon()}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">
            {severity === 'error' ? 'Something went wrong' : 'Notice'}
          </h3>
          <p className="text-sm opacity-90">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          
          {error.code && (
            <p className="text-xs mt-2 font-mono opacity-75">
              Error Code: {error.code}
            </p>
          )}

          {error.timestamp && (
            <p className="text-xs mt-1 opacity-60">
              {new Date(error.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Recovery Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry && error.recoverable !== false && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-md 
                     shadow-sm hover:shadow-md transition-shadow text-sm font-medium
                     border border-gray-300 hover:border-gray-400"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}

        {onClearSession && (
          <button
            onClick={onClearSession}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-md 
                     shadow-sm hover:shadow-md transition-shadow text-sm font-medium
                     border border-gray-300 hover:border-gray-400"
          >
            <Trash2 className="w-4 h-4" />
            Clear Session
          </button>
        )}

        {onExportConversation && (
          <button
            onClick={onExportConversation}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-md 
                     shadow-sm hover:shadow-md transition-shadow text-sm font-medium
                     border border-gray-300 hover:border-gray-400"
          >
            <Download className="w-4 h-4" />
            Export Debug Log
          </button>
        )}

        {onContactSupport && (
          <button
            onClick={onContactSupport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-md 
                     shadow-sm hover:shadow-md transition-shadow text-sm font-medium
                     border border-gray-300 hover:border-gray-400"
          >
            <HelpCircle className="w-4 h-4" />
            Contact Support
          </button>
        )}
      </div>

      {/* Technical Details (Expandable) */}
      {error.code && (
        <div className="mt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs underline opacity-75 hover:opacity-100 transition-opacity"
          >
            {isExpanded ? 'Hide' : 'Show'} Technical Details
          </button>
          
          {isExpanded && (
            <div className="mt-2 p-3 bg-white bg-opacity-50 rounded border border-gray-300">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
