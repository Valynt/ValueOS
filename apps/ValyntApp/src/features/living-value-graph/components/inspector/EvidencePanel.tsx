/**
 * EvidencePanel Component - Shows evidence sources with lineage and confidence
 */

import { ValueNode } from '../../types/graph.types';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';

interface EvidencePanelProps {
  node?: ValueNode | null;
}

export function EvidencePanel({ node }: EvidencePanelProps) {
  if (!node) {
    return (
      <div className="p-4">
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Evidence</h4>
        <p className="text-sm text-neutral-500">Select a node to view evidence</p>
      </div>
    );
  }

  const evidence = node.evidence || [];

  return (
    <div className="p-4 border-t border-neutral-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-neutral-900">Evidence</h4>
        <span className="text-xs text-neutral-500">{evidence.length} sources</span>
      </div>

      {evidence.length === 0 ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <div className="text-sm text-red-700 font-medium">No Evidence</div>
          <div className="text-xs text-red-600 mt-1">
            This node lacks supporting evidence. Add sources to improve defensibility.
          </div>
          <button className="mt-2 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
            Link Evidence
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {evidence.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded border ${
                item.isStale
                  ? 'bg-amber-50 border-amber-200'
                  : item.confidence >= 0.8
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-neutral-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-neutral-900">{item.title}</div>
                  <div className="text-xs text-neutral-500">
                    {item.type} • {item.source}
                  </div>
                  {item.location && (
                    <div className="text-xs text-neutral-400">{item.location}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ConfidenceBadge score={item.confidence} />
                  {item.isStale && (
                    <span className="text-xs text-amber-600">Stale</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-400">
                  {new Date(item.date).toLocaleDateString()}
                </span>
                <button className="text-xs text-blue-600 hover:text-blue-700">
                  View Source
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

