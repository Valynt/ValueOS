/**
 * ArtifactsPanel
 *
 * Phase 4: Decide — the executive output studio.
 * Shows generated artifacts with inline editing and provenance drill-down.
 * Every financial claim is clickable to see its derivation chain.
 */

import { useState } from 'react';
import { CheckCircle2, Edit3, ExternalLink, FileText, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecutiveArtifact } from '@/types/agent-ux';
import { ConfidenceBadge } from '@/components/trust/ConfidenceBadge';
import { StreamingText, SkeletonCard } from '@/components/async/StreamingText';
import { useAgentUXStore } from '@/lib/agent-ux-store';

interface ArtifactsPanelProps {
  artifacts: ExecutiveArtifact[];
  selectedArtifactId: string | null;
  streamText?: string;
  isStreaming?: boolean;
  isLoading: boolean;
  onSelectArtifact: (id: string) => void;
  onEditArtifact: (artifactId: string, section: string, content: string) => void;
  className?: string;
}

const ARTIFACT_TYPE_CONFIG = {
  'executive-memo': { label: 'Executive Memo', icon: FileText, color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'cfo-recommendation': { label: 'CFO Recommendation', icon: FileText, color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'customer-narrative': { label: 'Customer Narrative', icon: FileText, color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'internal-case': { label: 'Internal Case', icon: FileText, color: 'text-blue-300', bg: 'bg-blue-500/10' },
};

function ArtifactTab({
  artifact,
  isActive,
  onClick,
}: {
  artifact: ExecutiveArtifact;
  isActive: boolean;
  onClick: () => void;
}) {
  const config = ARTIFACT_TYPE_CONFIG[artifact.type];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
        isActive
          ? 'bg-white/10 text-white border border-white/15'
          : 'text-white/40 hover:text-white/60 hover:bg-white/5'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? config.color.replace('text-', 'bg-') : 'bg-white/20')} />
      {config.label}
    </button>
  );
}

function MarkdownContent({
  content,
  onClaimClick,
  financialClaims,
}: {
  content: string;
  onClaimClick: (claimId: string) => void;
  financialClaims: ExecutiveArtifact['financialClaims'];
}) {
  const { openProvenance } = useAgentUXStore();

  // Render content with clickable financial claims
  const lines = content.split('\n');

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {lines.map((line, i) => {
        // Check if line contains a financial claim
        const claim = financialClaims.find(c => line.includes(c.text.substring(0, 20)));

        if (line.startsWith('**To:**') || line.startsWith('**From:**') || line.startsWith('**Re:**') || line.startsWith('**Date:**')) {
          return (
            <div key={i} className="text-xs text-white/50 font-mono">
              {line.replace(/\*\*/g, '')}
            </div>
          );
        }

        if (line.startsWith('---')) {
          return <hr key={i} className="border-white/10 my-3" />;
        }

        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <h3 key={i} className="text-sm font-semibold text-white mt-4 mb-2">
              {line.replace(/\*\*/g, '')}
            </h3>
          );
        }

        if (line.startsWith('| ')) {
          // Simple table row
          const cells = line.split('|').filter(c => c.trim());
          const isHeader = lines[i + 1]?.startsWith('|---');
          const isSeparator = line.includes('---');
          if (isSeparator) return null;

          return (
            <div key={i} className={cn('flex gap-0 text-xs', isHeader ? 'font-medium text-white/60 border-b border-white/10 pb-1 mb-1' : 'text-white/70')}>
              {cells.map((cell, j) => (
                <div key={j} className={cn('flex-1 py-1', j === 0 ? 'text-white/80' : 'text-right')}>
                  {cell.trim()}
                </div>
              ))}
            </div>
          );
        }

        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-white/70 my-0.5">
              <span className="text-white/30 mt-1 flex-shrink-0">·</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }

        if (line.trim() === '') return <div key={i} className="h-2" />;

        // Regular paragraph — highlight financial claims
        if (claim) {
          return (
            <p key={i} className="text-sm text-white/70 leading-relaxed">
              {line.split(claim.text).map((part, j, arr) => (
                <>
                  {part}
                  {j < arr.length - 1 && (
                    <button
                      onClick={() => openProvenance(claim.id)}
                      className="inline text-violet-300 underline decoration-dotted hover:text-violet-200 cursor-pointer font-medium"
                    >
                      {claim.text}
                    </button>
                  )}
                </>
              ))}
            </p>
          );
        }

        return (
          <p key={i} className="text-sm text-white/70 leading-relaxed">
            {line.replace(/\*\*([^*]+)\*\*/g, (_, text) => text)}
          </p>
        );
      })}
    </div>
  );
}

export function ArtifactsPanel({
  artifacts,
  selectedArtifactId,
  streamText,
  isStreaming,
  isLoading,
  onSelectArtifact,
  onEditArtifact,
  className,
}: ArtifactsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const { openProvenance } = useAgentUXStore();

  if (isLoading && artifacts.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <SkeletonCard label="Drafting executive memo..." />
        <SkeletonCard label="Generating CFO recommendation..." />
      </div>
    );
  }

  // Show streaming preview
  if (artifacts.length === 0 && (streamText || isStreaming)) {
    return (
      <div className={cn('p-4 rounded-xl border border-white/8 bg-white/3', className)}>
        <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3">Generating Executive Summary</div>
        <StreamingText
          text={streamText || ''}
          isComplete={!isStreaming}
          isWaiting={!streamText && isStreaming}
          placeholder="Composing executive artifacts..."
        />
      </div>
    );
  }

  if (artifacts.length === 0) return null;

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId) || artifacts[0];
  const config = ARTIFACT_TYPE_CONFIG[selectedArtifact.type];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Artifact tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {artifacts.map((artifact) => (
          <ArtifactTab
            key={artifact.id}
            artifact={artifact}
            isActive={artifact.id === selectedArtifact.id}
            onClick={() => onSelectArtifact(artifact.id)}
          />
        ))}
      </div>

      {/* Artifact content */}
      <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
        {/* Artifact header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>
              {config.label}
            </span>
            <span className="text-sm font-medium text-white truncate">{selectedArtifact.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ConfidenceBadge score={selectedArtifact.readinessScore} size="sm" showLabel={false} />
            {selectedArtifact.isDraft ? (
              <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">Draft</span>
            ) : (
              <span className="text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Ready
              </span>
            )}
            <button
              onClick={() => {
                setIsEditing(!isEditing);
                if (!isEditing) setEditContent(selectedArtifact.content);
              }}
              className={cn(
                'p-1.5 rounded transition-colors',
                isEditing ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-white/8 text-white/40 hover:text-white/70'
              )}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[500px] overflow-y-auto">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-64 text-sm bg-white/5 border border-white/15 rounded-lg p-3 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 resize-none font-mono leading-relaxed"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onEditArtifact(selectedArtifact.id, selectedArtifact.content, editContent);
                    setIsEditing(false);
                  }}
                  className="text-xs px-3 py-1.5 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <MarkdownContent
              content={selectedArtifact.content}
              onClaimClick={openProvenance}
              financialClaims={selectedArtifact.financialClaims}
            />
          )}
        </div>

        {/* Footer */}
        {selectedArtifact.financialClaims.length > 0 && !isEditing && (
          <div className="px-4 py-2 border-t border-white/6 bg-white/2">
            <div className="text-[10px] text-white/30">
              {selectedArtifact.financialClaims.length} financial claim{selectedArtifact.financialClaims.length !== 1 ? 's' : ''} —{' '}
              <button
                onClick={() => openProvenance(selectedArtifact.financialClaims[0].id)}
                className="text-violet-400 hover:text-violet-300 underline decoration-dotted"
              >
                click any highlighted claim to see derivation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
