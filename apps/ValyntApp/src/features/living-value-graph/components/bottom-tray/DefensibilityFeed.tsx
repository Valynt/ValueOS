/**
 * DefensibilityFeed Component - Feed showing evidence gaps and defensibility issues
 */

import { useDefensibilityStore } from '../../store/defensibility-store';
import { useWorkflowStore } from '../../store/workflow-store';

export function DefensibilityFeed() {
  const issues = useDefensibilityStore((state) => state.issues);
  const phase = useWorkflowStore((state) => state.phase);

  // Filter issues based on phase
  const relevantIssues = issues.filter((issue) => {
    // Only show critical issues in later phases
    if (phase === 'FINALIZED') return issue.severity === 'critical';
    return true;
  });

  // Sort by severity and value at risk
  const sortedIssues = [...relevantIssues].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.valueAtRisk - a.valueAtRisk;
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-neutral-500 uppercase">Defensibility Issues</h4>
        {sortedIssues.length > 0 && (
          <span className="text-xs text-neutral-500">{sortedIssues.length} issues</span>
        )}
      </div>

      {sortedIssues.length === 0 ? (
        <div className="text-sm text-neutral-500">No defensibility issues</div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedIssues.slice(0, 10).map((issue) => (
            <div
              key={issue.id}
              className={`p-3 rounded border ${
                issue.severity === 'critical'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 ${
                    issue.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-900">{issue.nodeName}</div>
                  <div className="text-xs text-neutral-600">{issue.type.replace('_', ' ')}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    ${(issue.valueAtRisk / 1000000).toFixed(1)}M at risk
                  </div>
                  {issue.suggestedAction && (
                    <button className="mt-2 text-xs text-blue-600 hover:text-blue-700">
                      {issue.suggestedAction}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
