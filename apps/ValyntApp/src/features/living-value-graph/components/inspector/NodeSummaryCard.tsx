/**
 * NodeSummaryCard Component - Summary card for selected node in inspector
 */

import { ValueNode } from '../../types/graph.types';

interface NodeSummaryCardProps {
  node?: ValueNode | null;
}

export function NodeSummaryCard({ node }: NodeSummaryCardProps) {
  if (!node) {
    return (
      <div className="p-4">
        <p className="text-sm text-neutral-500">Select a node to view details</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-neutral-200">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{node.label}</h3>
          <span className="text-xs text-neutral-500 capitalize">{node.type}</span>
        </div>
        {node.confidence !== undefined && (
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {(node.confidence * 100).toFixed(0)}% confidence
          </span>
        )}
      </div>
      {node.value !== undefined && (
        <div className="mt-2 text-lg font-medium text-neutral-900">
          {node.value.toLocaleString()}
          {node.unit && <span className="text-sm text-neutral-500 ml-1">{node.unit}</span>}
        </div>
      )}
      {node.metadata?.description && (
        <p className="mt-2 text-sm text-neutral-600">{node.metadata.description}</p>
      )}
    </div>
  );
}
