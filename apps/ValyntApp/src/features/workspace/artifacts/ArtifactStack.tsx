/**
 * ArtifactStack
 * 
 * Sidebar list of artifacts with selection and status indicators.
 */

import { BarChart3, FileCheck, FileText, TrendingUp } from 'lucide-react';

import type { Artifact } from '../agent/types';

import { cn } from '@/lib/utils';

interface ArtifactStackProps {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  onSelect: (artifactId: string) => void;
  className?: string;
}

export function ArtifactStack({
  artifacts,
  activeArtifactId,
  onSelect,
  className,
}: ArtifactStackProps) {
  if (artifacts.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-center py-8 text-slate-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No artifacts yet</p>
          <p className="text-xs mt-1">Artifacts will appear here as the agent works</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-2 space-y-1', className)}>
      <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Artifacts ({artifacts.length})
      </div>
      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.id}
          artifact={artifact}
          isActive={artifact.id === activeArtifactId}
          onClick={() => onSelect(artifact.id)}
        />
      ))}
    </div>
  );
}

interface ArtifactCardProps {
  artifact: Artifact;
  isActive: boolean;
  onClick: () => void;
}

function ArtifactCard({ artifact, isActive, onClick }: ArtifactCardProps) {
  const Icon = getArtifactIcon(artifact.type);
  const iconColor = getArtifactIconColor(artifact.type);
  const statusColor = getStatusColor(artifact.status);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg transition-all',
        'hover:bg-slate-100',
        isActive 
          ? 'bg-primary/5 border border-primary/20 shadow-sm' 
          : 'bg-white border border-slate-200'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
          iconColor
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-medium truncate',
              isActive ? 'text-primary' : 'text-slate-800'
            )}>
              {artifact.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'text-[10px] font-medium uppercase px-1.5 py-0.5 rounded',
              statusColor
            )}>
              {artifact.status}
            </span>
            <span className="text-xs text-slate-400">
              {formatRelativeTime(artifact.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function getArtifactIcon(type: Artifact['type']) {
  switch (type) {
    case 'value_model':
      return BarChart3;
    case 'financial_projection':
      return TrendingUp;
    case 'executive_summary':
      return FileCheck;
    default:
      return FileText;
  }
}

function getArtifactIconColor(type: Artifact['type']): string {
  switch (type) {
    case 'value_model':
      return 'bg-emerald-50 text-emerald-600';
    case 'financial_projection':
      return 'bg-blue-50 text-blue-600';
    case 'executive_summary':
      return 'bg-purple-50 text-purple-600';
    default:
      return 'bg-slate-50 text-slate-600';
  }
}

function getStatusColor(status: Artifact['status']): string {
  switch (status) {
    case 'proposed':
      return 'bg-amber-100 text-amber-700';
    case 'approved':
      return 'bg-emerald-100 text-emerald-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'superseded':
      return 'bg-slate-100 text-slate-500';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default ArtifactStack;
