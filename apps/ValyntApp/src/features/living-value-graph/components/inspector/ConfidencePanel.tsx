/**
 * ConfidencePanel Component - Display and manage confidence levels for a node
 */

import { ValueNode } from '../../types/graph.types';

interface ConfidencePanelProps {
  node?: ValueNode | null;
}

export function ConfidencePanel({ node }: ConfidencePanelProps) {
  if (!node) {
    return (
      <div className="p-4">
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Confidence</h4>
        <p className="text-sm text-neutral-500">Select a node to view confidence details</p>
      </div>
    );
  }

  const confidence = node.confidence ?? 0;
  const confidencePercent = Math.round(confidence * 100);

  const getConfidenceColor = (c: number): string => {
    if (c >= 0.8) return 'bg-green-500';
    if (c >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceLabel = (c: number): string => {
    if (c >= 0.8) return 'High';
    if (c >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="p-4 border-t border-neutral-200">
      <h4 className="text-sm font-semibold text-neutral-900 mb-3">Confidence</h4>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-neutral-600">Overall Confidence</span>
            <span className="text-sm font-medium">{confidencePercent}%</span>
          </div>
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getConfidenceColor(confidence)} transition-all`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <span className={`text-xs mt-1 inline-block ${
            confidence >= 0.8 ? 'text-green-600' : confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {getConfidenceLabel(confidence)} confidence level
          </span>
        </div>

        {node.evidence && node.evidence.length > 0 && (
          <div>
            <span className="text-xs text-neutral-500">
              Based on {node.evidence.length} evidence source{node.evidence.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
