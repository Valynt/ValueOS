import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Eye, XCircle } from 'lucide-react';

interface HumanCheckpointProps {
  stageId: string;
  agentName: string;
  action: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence?: number;
  reasoning?: string;
  onApprove: () => void;
  onReject: () => void;
  onRequestClarification: () => void;
  isLoading?: boolean;
}

export const HumanCheckpoint: React.FC<HumanCheckpointProps> = ({
  stageId,
  agentName,
  action,
  riskLevel,
  confidence,
  reasoning,
  onApprove,
  onReject,
  onRequestClarification,
  isLoading = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'high': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'medium': return <Clock className="w-5 h-5 text-yellow-600" />;
      default: return <CheckCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className={`border-2 rounded-lg p-4 ${getRiskColor(riskLevel)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {getRiskIcon(riskLevel)}
          <div>
            <h3 className="font-semibold text-gray-900">
              Human Approval Required
            </h3>
            <p className="text-sm text-gray-600">
              {agentName} wants to {action} in stage "{stageId}"
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-500 hover:text-gray-700"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-3">
          {confidence !== undefined && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Confidence:</span>
              <span className={`text-sm ${
                confidence >= 0.8 ? 'text-green-600' :
                confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.round(confidence * 100)}%
              </span>
            </div>
          )}

          {reasoning && (
            <div>
              <span className="text-sm font-medium text-gray-700">Reasoning:</span>
              <p className="text-sm text-gray-600 mt-1">{reasoning}</p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Risk Level:</span>
            <span className={`text-sm px-2 py-1 rounded ${
              riskLevel === 'high' ? 'bg-red-100 text-red-800' :
              riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {riskLevel.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex space-x-3">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Approve</span>
        </button>

        <button
          onClick={onReject}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          <span>Reject</span>
        </button>

        <button
          onClick={onRequestClarification}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          <span>Request Clarification</span>
        </button>
      </div>
    </div>
  );
};
