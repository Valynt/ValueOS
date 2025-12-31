import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, MessageSquare, RefreshCw, XCircle } from 'lucide-react';

interface ConfidenceDisplayProps {
  confidence?: number;
  hallucinationCheck?: boolean;
  reasoning?: string;
  agentName?: string;
  onRegenerate?: () => void;
  onRequestClarification?: () => void;
  showActions?: boolean;
}

export const ConfidenceDisplay: React.FC<ConfidenceDisplayProps> = ({
  confidence,
  hallucinationCheck,
  reasoning,
  agentName,
  onRegenerate,
  onRequestClarification,
  showActions = true,
}) => {
  const [showReasoning, setShowReasoning] = useState(false);

  const getConfidenceLevel = (conf?: number): 'high' | 'medium' | 'low' => {
    if (!conf) return 'low';
    if (conf >= 0.8) return 'high';
    if (conf >= 0.6) return 'medium';
    return 'low';
  };

  const getConfidenceIcon = (level: string, hallucination?: boolean) => {
    if (hallucination === false) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (hallucination === true) return <XCircle className="w-5 h-5 text-red-600" />;
    
    switch (level) {
      case 'high': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default: return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-700 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default: return 'text-red-700 bg-red-50 border-red-200';
    }
  };

  const getStatusText = (conf?: number, hallucination?: boolean) => {
    if (hallucination === false) return 'Verified';
    if (hallucination === true) return 'Flagged';
    if (!conf) return 'Unknown';
    
    const level = getConfidenceLevel(conf);
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const level = getConfidenceLevel(confidence);

  return (
    <div className={`border rounded-lg p-3 ${getConfidenceColor(level)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getConfidenceIcon(level, hallucinationCheck)}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">
                {agentName ? `${agentName} Response` : 'Agent Response'}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-white bg-opacity-50">
                {getStatusText(confidence, hallucinationCheck)}
                {confidence && ` (${Math.round(confidence * 100)}%)`}
              </span>
            </div>
            {reasoning && (
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="text-xs text-gray-600 hover:text-gray-800 mt-1"
              >
                {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
              </button>
            )}
          </div>
        </div>

        {showActions && (onRegenerate || onRequestClarification) && (
          <div className="flex space-x-2">
            {onRequestClarification && (
              <button
                onClick={onRequestClarification}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                title="Request clarification"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Clarify</span>
              </button>
            )}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                title="Regenerate response"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showReasoning && reasoning && (
        <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-sm">
          <strong>Reasoning:</strong> {reasoning}
        </div>
      )}
    </div>
  );
};
