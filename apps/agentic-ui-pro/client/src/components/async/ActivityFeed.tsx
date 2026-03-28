/**
 * ActivityFeed
 *
 * Real-time feed of agent activities — the "what's happening" surface.
 * Translates internal agent operations into human-readable status updates.
 * Hides agent roles and technical details to maintain invisible UX.
 */

import { Bot, CheckCircle2, ChevronRight, Loader2, Pause, Terminal, Wrench, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentActivity } from '@/types/agent-ux';

interface ActivityFeedProps {
  activities: AgentActivity[];
  isRunning: boolean;
  className?: string;
}

function ActivityIcon({ type }: { type: AgentActivity['type'] }) {
  switch (type) {
    case 'thinking': return <Loader2 className="w-3 h-3 animate-spin text-white/40" />;
    case 'tool_call': return <Wrench className="w-3 h-3 text-cyan-400" />;
    case 'result': return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    case 'error': return <XCircle className="w-3 h-3 text-rose-400" />;
    case 'checkpoint': return <Pause className="w-3 h-3 text-amber-400" />;
    default: return <Terminal className="w-3 h-3 text-white/40" />;
  }
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ActivityFeed({ activities, isRunning, className }: ActivityFeedProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-medium text-white/60">Activity</span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">In progress</span>
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
            <Bot className="w-8 h-8" />
            <span className="text-xs">No activity yet</span>
          </div>
        ) : (
          <div className="divide-y divide-white/4">
            {activities.map((activity, i) => {
              const isLatest = i === 0;

              return (
                <div
                  key={activity.id}
                  className={cn(
                    'px-3 py-2 transition-colors',
                    isLatest && isRunning ? 'bg-white/3' : 'hover:bg-white/2'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <ActivityIcon type={activity.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-xs leading-snug', isLatest && isRunning ? 'text-white/80' : 'text-white/50')}>
                        {activity.message}
                      </div>
                      {activity.confidence !== undefined && (
                        <div className="text-[10px] text-white/30 mt-0.5 font-mono">
                          confidence: {Math.round(activity.confidence * 100)}%
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-[10px] text-white/20 font-mono">
                      {formatTime(activity.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
