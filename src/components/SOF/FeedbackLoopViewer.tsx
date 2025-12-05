/**
 * FeedbackLoopViewer Component
 * 
 * Visualizes feedback loops with metrics and behavior changes.
 */

import React from 'react';
import type { FeedbackLoop } from '../../types/sof';

export interface FeedbackLoopViewerProps {
  loop: FeedbackLoop;
  showMetrics?: boolean;
  showBehaviorChanges?: boolean;
  compact?: boolean;
}

export const FeedbackLoopViewer: React.FC<FeedbackLoopViewerProps> = ({
  loop,
  showMetrics = true,
  showBehaviorChanges = true,
  compact = false,
}) => {
  const getLoopTypeColor = (type: FeedbackLoop['loop_type']) => {
    const colors = {
      reinforcing: 'bg-green-100 text-green-800',
      balancing: 'bg-blue-100 text-blue-800',
      mixed: 'bg-purple-100 text-purple-800',
    };
    return colors[type];
  };

  const getClosureColor = (status: FeedbackLoop['closure_status']) => {
    const colors = {
      open: 'bg-gray-100 text-gray-800',
      partial: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-green-100 text-green-800',
      broken: 'bg-red-100 text-red-800',
    };
    return colors[status || 'open'];
  };

  const getStrengthIcon = (strength: FeedbackLoop['loop_strength']) => {
    const icons = {
      weak: '○',
      moderate: '◐',
      strong: '●',
      dominant: '⬤',
    };
    return icons[strength || 'weak'];
  };

  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${compact ? 'p-3' : 'p-4'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className={`font-semibold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>
            {loop.loop_name}
          </h4>
          {loop.loop_description && (
            <p className="text-sm text-gray-600 mt-1">{loop.loop_description}</p>
          )}
        </div>
        <div className="flex gap-2 ml-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getLoopTypeColor(loop.loop_type)}`}>
            {loop.loop_type}
          </span>
          {loop.closure_status && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${getClosureColor(loop.closure_status)}`}>
              {loop.closure_status}
            </span>
          )}
        </div>
      </div>

      {/* Loop Properties */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Strength</div>
          <div className="font-medium flex items-center gap-1">
            <span>{getStrengthIcon(loop.loop_strength)}</span>
            <span className="capitalize">{loop.loop_strength || 'unknown'}</span>
          </div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Stage</div>
          <div className="font-medium capitalize">{loop.realization_stage || 'designed'}</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Time Constant</div>
          <div className="font-medium">{loop.time_constant || 'N/A'}</div>
        </div>
      </div>

      {/* Loop Diagram */}
      {!compact && loop.loop_path.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="text-xs font-semibold text-gray-700 mb-2">Loop Structure:</div>
          <div className="flex items-center justify-center">
            <svg width="100%" height="120" viewBox="0 0 400 120" className="max-w-full">
              <defs>
                <marker
                  id="arrowhead-positive"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
                </marker>
                <marker
                  id="arrowhead-negative"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
                </marker>
              </defs>
              
              {loop.loop_path.map((segment, idx) => {
                const totalSegments = loop.loop_path.length;
                const angle = (idx / totalSegments) * 2 * Math.PI - Math.PI / 2;
                const nextAngle = ((idx + 1) / totalSegments) * 2 * Math.PI - Math.PI / 2;
                const radius = 40;
                const centerX = 200;
                const centerY = 60;
                
                const x1 = centerX + radius * Math.cos(angle);
                const y1 = centerY + radius * Math.sin(angle);
                const x2 = centerX + radius * Math.cos(nextAngle);
                const y2 = centerY + radius * Math.sin(nextAngle);
                
                return (
                  <g key={idx}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={segment.polarity === 'positive' ? '#10b981' : '#ef4444'}
                      strokeWidth="2"
                      markerEnd={`url(#arrowhead-${segment.polarity})`}
                    />
                    <circle cx={x1} cy={y1} r="3" fill="#6b7280" />
                  </g>
                );
              })}
              
              {/* Center label */}
              <text x="200" y="60" textAnchor="middle" fontSize="12" fill="#374151" fontWeight="bold">
                {loop.loop_type === 'reinforcing' ? 'R' : loop.loop_type === 'balancing' ? 'B' : 'M'}
              </text>
            </svg>
          </div>
          <div className="text-xs text-gray-500 text-center mt-2">
            {loop.loop_path.length} elements • {loop.delay_points.length} delay point(s)
          </div>
        </div>
      )}

      {/* Loop Metrics */}
      {showMetrics && loop.loop_metrics.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Loop Metrics:</div>
          <div className="space-y-2">
            {loop.loop_metrics.map((metric, idx) => {
              const progress = metric.target !== 0 ? (metric.current / metric.target) * 100 : 0;
              return (
                <div key={idx} className="bg-gray-50 p-2 rounded">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{metric.metric}</span>
                    <span className="font-medium">
                      {metric.current.toFixed(1)} / {metric.target.toFixed(1)} {metric.unit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Behavior Changes */}
      {showBehaviorChanges && loop.behavior_changes.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Observed Behavior Changes:</div>
          <div className="space-y-2">
            {loop.behavior_changes.slice(0, compact ? 2 : 5).map((change, idx) => (
              <div key={idx} className="bg-blue-50 p-3 rounded border border-blue-200">
                <div className="font-medium text-sm text-blue-900">{change.entity}</div>
                <div className="text-xs text-gray-600 mt-1">
                  <span className="text-gray-500">Before:</span> {change.behavior_before}
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  <span className="text-blue-600">After:</span> {change.behavior_after}
                </div>
                {change.evidence && (
                  <div className="text-xs text-gray-500 mt-1 italic">
                    Evidence: {change.evidence}
                  </div>
                )}
              </div>
            ))}
            {loop.behavior_changes.length > (compact ? 2 : 5) && (
              <div className="text-xs text-gray-500 text-center">
                +{loop.behavior_changes.length - (compact ? 2 : 5)} more changes
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Updates */}
      {loop.system_updates.length > 0 && !compact && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">System Updates:</div>
          <div className="space-y-1">
            {loop.system_updates.slice(0, 3).map((update, idx) => (
              <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">{update.update_type.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500">{new Date(update.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="text-gray-600 mt-1">{update.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closure Evidence */}
      {loop.closure_evidence && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="text-xs font-semibold text-green-800 mb-1">Closure Evidence:</div>
          <div className="text-xs text-green-700">{loop.closure_evidence}</div>
        </div>
      )}
    </div>
  );
};

export default FeedbackLoopViewer;
