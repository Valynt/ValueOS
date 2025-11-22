/**
 * InterventionPointCard Component
 * 
 * Displays intervention point details with risks, pathways, and actions.
 */

import React, { useMemo, useCallback } from 'react';
import type { InterventionPoint } from '../../types/sof';

export interface InterventionPointCardProps {
  intervention: InterventionPoint;
  showRisks?: boolean;
  showPathways?: boolean;
  onApprove?: () => void;
  onEdit?: () => void;
  onView?: () => void;
}

export const InterventionPointCard: React.FC<InterventionPointCardProps> = React.memo(({
  intervention,
  showRisks = true,
  showPathways = true,
  onApprove,
  onEdit,
  onView,
}) => {
  const getStatusColor = useCallback((status: InterventionPoint['status']) => {
    const colors = {
      proposed: 'bg-blue-100 text-blue-800',
      validated: 'bg-green-100 text-green-800',
      approved: 'bg-purple-100 text-purple-800',
      implemented: 'bg-indigo-100 text-indigo-800',
      measured: 'bg-teal-100 text-teal-800',
      retired: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }, []);

  const getLeverageColor = useCallback((level: number) => {
    if (level >= 8) return 'text-red-600 font-bold';
    if (level >= 6) return 'text-orange-600 font-semibold';
    if (level >= 4) return 'text-yellow-600';
    return 'text-gray-600';
  }, []);

  const statusColor = useMemo(
    () => getStatusColor(intervention.status),
    [intervention.status, getStatusColor]
  );

  const leverageColor = useMemo(
    () => getLeverageColor(intervention.leverage_level),
    [intervention.leverage_level, getLeverageColor]
  );

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-gray-900">{intervention.name}</h4>
          <span className="text-xs text-gray-500">{intervention.intervention_type.replace(/_/g, ' ')}</span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(intervention.status)}`}>
          {intervention.status}
        </span>
      </div>

      {/* Description */}
      {intervention.description && (
        <p className="text-sm text-gray-600 mb-4">{intervention.description}</p>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500 mb-1">Leverage Level</div>
          <div className={`text-xl font-bold ${getLeverageColor(intervention.leverage_level)}`}>
            {intervention.leverage_level}/10
          </div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500 mb-1">Effort</div>
          <div className="text-sm font-medium capitalize">{intervention.effort_estimate.replace(/_/g, ' ')}</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500 mb-1">Time to Impact</div>
          <div className="text-sm font-medium capitalize">{intervention.time_to_impact.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {/* Outcome Pathways */}
      {showPathways && intervention.outcome_pathways.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Expected Outcomes:</div>
          <div className="space-y-1">
            {intervention.outcome_pathways.slice(0, 3).map((pathway, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-blue-50 p-2 rounded">
                <span className="text-gray-700">
                  KPI improvement: <span className="font-semibold">{pathway.expected_delta > 0 ? '+' : ''}{pathway.expected_delta.toFixed(1)}</span>
                </span>
                <span className="text-blue-600 font-medium">{(pathway.confidence * 100).toFixed(0)}% confidence</span>
              </div>
            ))}
            {intervention.outcome_pathways.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{intervention.outcome_pathways.length - 3} more outcomes
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risks */}
      {showRisks && intervention.risks.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Identified Risks:
          </div>
          <div className="space-y-1">
            {intervention.risks.slice(0, 2).map((risk, idx) => (
              <div key={idx} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                <div className="font-medium">{risk.risk_type.replace(/_/g, ' ')}</div>
                <div className="text-red-700">{risk.description}</div>
                {risk.mitigation && (
                  <div className="text-red-600 mt-1">→ {risk.mitigation}</div>
                )}
              </div>
            ))}
            {intervention.risks.length > 2 && (
              <div className="text-xs text-red-500 text-center">
                +{intervention.risks.length - 2} more risks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {intervention.dependencies.length > 0 && (
        <div className="mb-4 text-xs">
          <span className="text-gray-500">Dependencies:</span>
          <span className="ml-1 text-gray-700">{intervention.dependencies.length} prerequisite(s)</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-200">
        {onView && (
          <button
            onClick={onView}
            className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors"
          >
            View Details
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors"
          >
            Edit
          </button>
        )}
        {onApprove && intervention.status === 'validated' && (
          <button
            onClick={onApprove}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
          >
            Approve
          </button>
        )}
      </div>
    </div>
  );
});

InterventionPointCard.displayName = 'InterventionPointCard';

export default InterventionPointCard;
