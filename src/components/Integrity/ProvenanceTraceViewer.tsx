import React from 'react';
import { ArrowRight, GitBranch, ShieldCheck } from 'lucide-react';
import type { LifecycleArtifactLink, ProvenanceAuditEntry } from '../../types/vos';

interface ProvenanceTraceViewerProps {
  links: LifecycleArtifactLink[];
  audits?: ProvenanceAuditEntry[];
  title?: string;
}

export const ProvenanceTraceViewer: React.FC<ProvenanceTraceViewerProps> = ({
  links,
  audits = [],
  title = 'Lifecycle Provenance'
}) => {
  const sortedLinks = [...links].sort((a, b) => {
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aDate - bDate;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <GitBranch className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <span className="text-xs text-gray-500">{sortedLinks.length} hops</span>
      </div>

      <div className="space-y-3">
        {sortedLinks.map((link, idx) => (
          <div key={`${link.id}-${idx}`} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold text-gray-900">{link.source_type}</span>
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <span className="font-semibold text-gray-900">{link.target_type}</span>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Relationship: <span className="font-medium text-gray-900">{link.relationship_type}</span>
            </p>
            {link.reasoning_trace && (
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                {link.reasoning_trace}
              </p>
            )}
          </div>
        ))}
      </div>

      {audits.length > 0 && (
        <div className="pt-3 border-t border-gray-200 space-y-2">
          <div className="flex items-center space-x-2 text-xs text-gray-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">Compliance Evidence</span>
          </div>
          <div className="space-y-2">
            {audits.slice(0, 3).map((audit) => (
              <div
                key={audit.id}
                className="text-xs text-gray-600 bg-emerald-50 border border-emerald-100 rounded-lg p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-900">{audit.action}</span>
                  <span className="text-[10px] text-emerald-700">{audit.artifact_type}</span>
                </div>
                {audit.reasoning_trace && (
                  <p className="mt-1 text-emerald-800 line-clamp-2">{audit.reasoning_trace}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
