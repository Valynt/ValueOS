/**
 * ArtifactsPanel Component - Shows derived narrative artifacts with stale detection
 */

import { useWorkflowState } from '../../hooks/useWorkflowState';

interface Artifact {
  id: string;
  type: 'executive_summary' | 'deck' | 'business_case' | 'approval_packet';
  name: string;
  generatedAt: string;
  derivedFrom: string;
  downloadUrl: string;
  isStale: boolean;
}

interface ArtifactsPanelProps {
  artifacts?: Artifact[];
  currentGraphVersion?: string;
  onRegenerate?: (type: string) => void;
}

export function ArtifactsPanel({
  artifacts = [],
  currentGraphVersion,
  onRegenerate,
}: ArtifactsPanelProps) {
  const { phase } = useWorkflowState();

  // Check if any artifacts are stale
  const staleArtifacts = artifacts.filter((a) => a.isStale);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">Artifacts</h3>
        {staleArtifacts.length > 0 && (
          <span className="text-xs text-amber-600">{staleArtifacts.length} stale</span>
        )}
      </div>

      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <ArtifactItem
            key={artifact.id}
            artifact={artifact}
            canRegenerate={phase === 'COMPOSING' || phase === 'REFINING'}
            onRegenerate={() => onRegenerate?.(artifact.type)}
          />
        ))}

        {artifacts.length === 0 && (
          <div className="text-sm text-neutral-500">No artifacts generated yet</div>
        )}
      </div>

      <div className="mt-4 p-2 bg-neutral-50 rounded text-xs text-neutral-500">
        <span className="font-medium">Note:</span> Artifacts are derived from the graph state and
        regenerate automatically when the model changes.
      </div>
    </div>
  );
}

interface ArtifactItemProps {
  artifact: Artifact;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

function ArtifactItem({ artifact, canRegenerate, onRegenerate }: ArtifactItemProps) {
  const typeLabels: Record<string, string> = {
    executive_summary: 'Executive Summary',
    deck: 'Presentation Deck',
    business_case: 'Business Case PDF',
    approval_packet: 'Approval Packet',
  };

  return (
    <div
      className={`p-3 rounded border ${
        artifact.isStale ? 'bg-amber-50 border-amber-200' : 'bg-white border-neutral-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-neutral-900">{typeLabels[artifact.type]}</div>
          <div className="text-xs text-neutral-500">
            Generated {new Date(artifact.generatedAt).toLocaleDateString()}
          </div>
          {artifact.isStale && (
            <div className="text-xs text-amber-600 mt-1">Model changed - needs regeneration</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {artifact.isStale && canRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Regenerate
            </button>
          )}
          <a
            href={artifact.downloadUrl}
            download
            className="text-xs px-2 py-1 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
