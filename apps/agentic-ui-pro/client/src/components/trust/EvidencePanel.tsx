/**
 * EvidencePanel
 *
 * Shows all evidence sources for a value node with source classification badges.
 * Every data point is traceable — this is the "click to see where this came from" surface.
 */

import { BookOpen, Building2, ExternalLink, FileText, Globe, Mic, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Evidence, SourceClassification } from '@/types/agent-ux';
import { ConfidenceBadge } from './ConfidenceBadge';

interface EvidencePanelProps {
  evidence: Evidence[];
  className?: string;
}

const SOURCE_CONFIG: Record<SourceClassification, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  'customer-confirmed': { label: 'Customer Confirmed', icon: User, color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'internally-observed': { label: 'Internally Observed', icon: Building2, color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'benchmark-derived': { label: 'Benchmark', icon: BookOpen, color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'inferred': { label: 'Inferred', icon: Globe, color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'externally-researched': { label: 'External Research', icon: FileText, color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'sec-filing': { label: 'SEC Filing', icon: FileText, color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'unsupported': { label: 'Unsupported', icon: Globe, color: 'text-rose-300', bg: 'bg-rose-500/10' },
};

function SourceBadge({ type }: { type: SourceClassification }) {
  const config = SOURCE_CONFIG[type];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}

export function EvidencePanel({ evidence, className }: EvidencePanelProps) {
  if (evidence.length === 0) {
    return (
      <div className={cn('p-4 text-center text-sm text-white/30', className)}>
        No evidence attached to this node.
      </div>
    );
  }

  const sortedEvidence = [...evidence].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className={cn('space-y-2', className)}>
      {sortedEvidence.map((ev) => (
        <div
          key={ev.id}
          className={cn(
            'p-3 rounded-lg border transition-colors',
            ev.isStale
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-white/6 bg-white/3 hover:bg-white/5'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <SourceBadge type={ev.sourceType} />
              {ev.isStale && (
                <span className="text-[10px] text-amber-400 font-medium">Stale</span>
              )}
            </div>
            <ConfidenceBadge score={ev.confidence} size="sm" showLabel={false} />
          </div>

          <div className="text-xs font-medium text-white/80 mb-0.5">{ev.source}</div>
          <div className="text-xs text-white/50 leading-relaxed">{ev.citation}</div>

          {ev.excerpt && (
            <blockquote className="mt-2 pl-2 border-l-2 border-white/10 text-xs text-white/40 italic">
              "{ev.excerpt}"
            </blockquote>
          )}

          {ev.url && (
            <a
              href={ev.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              View source
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
