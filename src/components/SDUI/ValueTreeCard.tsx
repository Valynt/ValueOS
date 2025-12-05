import React from 'react';
import { GitBranch } from 'lucide-react';

export interface ValueTreeCardProps {
  title: string;
  nodes: string[];
  emphasis?: string;
}

export const ValueTreeCard: React.FC<ValueTreeCardProps> = ({
  title,
  nodes,
  emphasis,
}) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="value-tree-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600" aria-hidden="true">
            <GitBranch className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {emphasis && <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{emphasis}</span>}
      </div>
      <div className="space-y-2">
        {nodes.map((node) => (
          <div
            key={node}
            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-800"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="flex-1">{node}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
