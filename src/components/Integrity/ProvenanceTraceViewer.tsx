import React from 'react';
import { ArrowRight, Clock3, Fingerprint, GitBranch, ShieldCheck } from 'lucide-react';
import type { LifecycleArtifactLink, ProvenanceAuditEntry } from '../../types/vos';

interface ProvenanceTraceViewerProps {
  links: LifecycleArtifactLink[];
  audits?: ProvenanceAuditEntry[];
  title?: string;
}

const stageBadge: Record<string, string> = {
  opportunity: 'bg-amber-50 text-amber-700 border-amber-200',
  target: 'bg-blue-50 text-blue-700 border-blue-200',
  realization: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expansion: 'bg-purple-50 text-purple-700 border-purple-200',
};

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

  const latestAuditByArtifact = audits.reduce<Record<string, ProvenanceAuditEntry>>((acc, audit) => {
    acc[audit.artifact_id] = audit;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <GitBranch className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center space-x-3 text-xs text-gray-600">
          <Clock3 className="h-3 w-3" />
          <span>{sortedLinks.length} hops</span>
          <span className="text-gray-400">|</span>
          <span>{audits.length} audit entries</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" aria-hidden />
        <div className="space-y-4">
          {sortedLinks.map((link, idx) => {
            const audit = latestAuditByArtifact[link.target_artifact_id];
            const stageClass = stageBadge[link.target_stage || 'target'] || 'bg-gray-50 text-gray-700 border-gray-200';

            return (
              <div key={`${link.id}-${idx}`} className="relative pl-8">
                <div className="absolute left-[9px] top-2 h-3 w-3 bg-white border-2 border-blue-500 rounded-full" />
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${stageClass}`}>
                        {link.source_stage || 'upstream'} → {link.target_stage || 'downstream'}
                      </span>
                      <span className="font-semibold text-gray-900">{link.relationship_type}</span>
                    </div>
                    {link.chain_depth !== undefined && (
                      <span className="text-[10px] text-gray-500">Depth {link.chain_depth}</span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center text-sm font-semibold text-gray-900">
                    <span>{link.source_type}</span>
                    <ArrowRight className="mx-2 h-4 w-4 text-gray-400" />
                    <span>{link.target_type}</span>
                  </div>

                  {link.reasoning_trace && (
                    <p className="mt-2 text-xs text-gray-600 line-clamp-3">{link.reasoning_trace}</p>
                  )}

                  {audit && (
                    <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
                      <div className="flex items-center space-x-2 text-xs text-gray-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold">Latest audit</span>
                        <span className="text-[10px] text-gray-500">{audit.action}</span>
                      </div>
                      {audit.reasoning_trace && (
                        <p className="mt-1 text-xs text-emerald-800 line-clamp-2">{audit.reasoning_trace}</p>
                      )}

                      {audit.input_variables && Object.keys(audit.input_variables).length > 0 && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-700">
                          {Object.entries(audit.input_variables).map(([key, value]) => (
                            <div key={key} className="p-2 bg-white border border-gray-100 rounded">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-900">{key}</span>
                                <Fingerprint className="h-3 w-3 text-gray-400" />
                              </div>
                              <div className="text-[10px] text-gray-500 mt-1">{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {audits.length > 0 && (
        <div className="pt-3 border-t border-gray-200 space-y-2">
          <div className="flex items-center space-x-2 text-xs text-gray-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">Compliance Evidence</span>
          </div>
          <div className="space-y-2">
            {audits.slice(0, 4).map((audit) => (
              <div
                key={audit.id}
                className="text-xs text-gray-600 bg-emerald-50 border border-emerald-100 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-900">{audit.action}</span>
                  <span className="text-[10px] text-emerald-700">{audit.artifact_type}</span>
                </div>
                {audit.reasoning_trace && (
                  <p className="mt-1 text-emerald-800 line-clamp-2">{audit.reasoning_trace}</p>
                )}
                {audit.output_snapshot && Object.keys(audit.output_snapshot).length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-emerald-900">
                    {Object.entries(audit.output_snapshot).map(([label, value]) => (
                      <div key={label} className="p-2 bg-white border border-emerald-100 rounded">
                        <div className="font-semibold">{label}</div>
                        <div className="text-[10px] text-emerald-700 break-words">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
