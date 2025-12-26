import { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Swords } from 'lucide-react';
import { Challenge } from '../../types/agents';

interface ChallengeCardProps {
  challenge: Challenge;
  onResolve?: (id: string, resolution: string) => void;
  onAcknowledge?: (id: string) => void;
  compact?: boolean;
}

export default function ChallengeCard({ challenge, onResolve, onAcknowledge, compact = false }: ChallengeCardProps) {
  const [isExpanded, setIsExpanded] = useState(challenge.status === 'pending');

  const getSeverityStyle = (severity: Challenge['severity']) => {
    switch (severity) {
      case 'high':
        return 'border-neutral-500/50 bg-neutral-800/50';
      case 'medium':
        return 'border-neutral-500/30 bg-neutral-800/30';
      default:
        return 'border-neutral-600/20 bg-neutral-800/20';
    }
  };

  const getSeverityBadge = (severity: Challenge['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-neutral-600/50 text-neutral-300';
      case 'medium':
        return 'bg-neutral-700/50 text-neutral-400';
      default:
        return 'bg-neutral-800/50 text-neutral-500';
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${getSeverityStyle(challenge.severity)}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-start gap-2 text-left hover:bg-secondary/30 transition-colors ${compact ? 'p-2' : 'p-4'}`}
      >
        <Swords className={`text-neutral-400 mt-0.5 flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`font-semibold text-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>Challenge</span>
            <span className={`px-1 py-0.5 rounded ${getSeverityBadge(challenge.severity)} ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
              {challenge.severity}
            </span>
            {challenge.status === 'resolved' && (
              <CheckCircle2 className={`text-primary ml-auto ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
            )}
          </div>
          <p className={`text-foreground line-clamp-2 ${compact ? 'text-[10px]' : 'text-sm'}`}>{challenge.claim}</p>
        </div>
        {isExpanded ? (
          <ChevronUp className={`text-muted-foreground flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        ) : (
          <ChevronDown className={`text-muted-foreground flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        )}
      </button>

      {isExpanded && (
        <div className={`space-y-3 ${compact ? 'px-2 pb-2' : 'px-4 pb-4 space-y-4'}`}>
          <div className={compact ? 'pl-5' : 'pl-7'}>
            <div className={`font-medium text-muted-foreground uppercase tracking-wider mb-1.5 ${compact ? 'text-[9px]' : 'text-xs'}`}>
              Counter-Argument
            </div>
            <div className={`bg-background/50 rounded-lg border border-border ${compact ? 'p-2' : 'p-3'}`}>
              <div className="flex items-start gap-1.5">
                <AlertCircle className={`text-neutral-400 mt-0.5 flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                <p className={`text-muted-foreground ${compact ? 'text-[10px]' : 'text-sm'}`}>{challenge.counterArgument}</p>
              </div>
            </div>
          </div>

          {challenge.resolution && (
            <div className={compact ? 'pl-5' : 'pl-7'}>
              <div className={`font-medium text-muted-foreground uppercase tracking-wider mb-1.5 ${compact ? 'text-[9px]' : 'text-xs'}`}>
                Resolution
              </div>
              <div className={`bg-primary/5 rounded-lg border border-primary/20 ${compact ? 'p-2' : 'p-3'}`}>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className={`text-primary mt-0.5 flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                  <p className={`text-primary ${compact ? 'text-[10px]' : 'text-sm'}`}>{challenge.resolution}</p>
                </div>
              </div>
            </div>
          )}

          {challenge.status === 'pending' && (
            <div className={`flex gap-2 ${compact ? 'pl-5' : 'pl-7'}`}>
              <button
                onClick={() => onResolve?.(challenge.id, '')}
                className={`btn btn-primary ${compact ? 'h-6 px-2 text-[10px]' : 'h-8 px-3 text-xs'}`}
              >
                Resolve
              </button>
              <button
                onClick={() => onAcknowledge?.(challenge.id)}
                className={`btn btn-outline ${compact ? 'h-6 px-2 text-[10px]' : 'h-8 px-3 text-xs'}`}
              >
                Acknowledge
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
