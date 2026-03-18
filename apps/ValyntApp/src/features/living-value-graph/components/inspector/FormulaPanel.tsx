/**
 * FormulaPanel Component - Displays deterministic formulas with dependencies
 */

import { ValueNode } from '../../types/graph.types';

interface FormulaPanelProps {
  node?: ValueNode | null;
}

export function FormulaPanel({ node }: FormulaPanelProps) {
  if (!node) {
    return (
      <div className="p-4">
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Formula</h4>
        <p className="text-sm text-neutral-500">Select a node to view formula</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-neutral-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-neutral-900">Formula</h4>
        <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded">Read-only</span>
      </div>

      {node.formula ? (
        <div className="space-y-3">
          {/* Formula Display */}
          <div className="p-3 bg-neutral-50 rounded font-mono text-sm border border-neutral-200">
            {node.formula}
          </div>

          {/* Dependencies */}
          {node.inputs && node.inputs.length > 0 && (
            <div>
              <div className="text-xs text-neutral-500 mb-2">Dependencies</div>
              <div className="flex flex-wrap gap-2">
                {node.inputs.map((inputId) => (
                  <span key={inputId} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    {inputId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unit Check */}
          {node.unit && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">Unit:</span>
              <span className="font-medium">{node.unit}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No formula defined for this node</p>
      )}
    </div>
  );
}
