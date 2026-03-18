/**
 * DefensibilityPanel Component - Inspector panel for node defensibility details
 */

import { useDefensibilityStore } from '../../store/defensibility-store';
import { ValueNode } from '../../types/graph.types';
import { formatDefensibilityScore, getDefensibilityColor } from '../../utils/defensibility-calc';

interface DefensibilityPanelProps {
  node?: ValueNode | null;
}

export function DefensibilityPanel({ node }: DefensibilityPanelProps) {
  const nodeDefensibilityAll = useDefensibilityStore((state) => state.nodeDefensibility);
  const getNodeCoverage = useDefensibilityStore((state) => state.getNodeCoverage);

  if (!node) {
    return (
      <div className="p-4">
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Defensibility</h4>
        <p className="text-sm text-neutral-500">Select a node to view defensibility details</p>
      </div>
    );
  }

  const nodeDefensibility = nodeDefensibilityAll[node.id];
  const coverage = getNodeCoverage(node.id);

  if (!nodeDefensibility) {
    return (
      <div className="p-4">
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Defensibility</h4>
        <p className="text-sm text-neutral-500">Calculating...</p>
      </div>
    );
  }

  const color = getDefensibilityColor(coverage);

  return (
    <div className="p-4 border-t border-neutral-200">
      <h4 className="text-sm font-semibold text-neutral-900 mb-3">Defensibility</h4>

      {/* Coverage Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-neutral-600">Evidence Coverage</span>
          <span className={`text-sm font-medium ${
            color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-red-600'
          }`}>
            {formatDefensibilityScore(coverage)}
          </span>
        </div>
        <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              color === 'green' ? 'bg-green-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${coverage * 100}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-2 bg-neutral-50 rounded">
          <div className="text-xs text-neutral-500">Source Independence</div>
          <div className="text-sm font-medium">{nodeDefensibility.sourceIndependence} sources</div>
        </div>
        <div className="p-2 bg-neutral-50 rounded">
          <div className="text-xs text-neutral-500">Value Contribution</div>
          <div className="text-sm font-medium">${(nodeDefensibility.valueContribution / 1000000).toFixed(1)}M</div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${nodeDefensibility.auditTrailComplete ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm">
          {nodeDefensibility.auditTrailComplete ? 'Audit Trail Complete' : 'Audit Trail Incomplete'}
        </span>
      </div>

      {/* Warnings */}
      {nodeDefensibility.warnings.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-neutral-500 uppercase">Warnings</h5>
          {nodeDefensibility.warnings.map((warning, index) => (
            <div
              key={index}
              className={`p-2 rounded text-sm ${
                warning.severity === 'critical'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <div className="font-medium">{warning.message}</div>
              {warning.remediation && (
                <div className="text-xs mt-1 opacity-75">{warning.remediation}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action */}
      {coverage < 0.8 && (
        <button className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          Request Evidence
        </button>
      )}
    </div>
  );
}
