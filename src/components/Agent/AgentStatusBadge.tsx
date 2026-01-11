/**
 * Agent Status Badge
 * 
 * Subtle, bottom-right indicator showing current agent activity.
 * Designed to provide awareness without distraction.
 * 
 * States:
 * - Idle (green) - No active agent work
 * - Working (blue, animated) - Agent processing
 * - Warning (amber) - Agent needs attention
 * - Error (red) - Agent failed
 */

import React, { useState } from 'react';
import { 
  Bot, 
  CheckCircle, 
  Loader2,
  AlertTriangle,
  XCircle,
  ChevronUp,
  Clock,
  DollarSign
} from 'lucide-react';
import { useAgentHealth } from '../../hooks/useAgentHealth';

export type AgentStatus = 'idle' | 'working' | 'warning' | 'error';

interface AgentStatusBadgeProps {
  compact?: boolean;
  className?: string;
}

export function AgentStatusBadge({ 
  compact = true, 
  className = '' 
}: AgentStatusBadgeProps) {
  const { status, currentAgent, latency, cost, message } = useAgentHealth();
  const [expanded, setExpanded] = useState(false);

  const getStatusConfig = (status: AgentStatus) => {
    switch (status) {
      case 'idle':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/20',
          label: 'Ready',
        };
      case 'working':
        return {
          icon: Loader2,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          label: 'Working',
          animate: true,
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          label: 'Warning',
        };
      case 'error':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          label: 'Error',
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div 
      className={`
        fixed bottom-4 right-4 z-50
        transition-all duration-300
        ${className}
      `}
    >
      {/* Compact Badge */}
      {compact && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={`
            group flex items-center gap-2 px-3 py-2 rounded-full
            ${config.bg} ${config.border} border backdrop-blur-sm
            hover:scale-105 transition-all shadow-lg
          `}
          title={`Agent Status: ${config.label}`}
        >
          <Bot className="w-4 h-4 text-slate-400" />
          <Icon 
            className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`} 
          />
          
          {/* Expand hint */}
          <ChevronUp className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Expanded Badge */}
      {expanded && (
        <div 
          className={`
            flex flex-col gap-2 p-4 rounded-xl
            ${config.bg} ${config.border} border backdrop-blur-sm
            shadow-xl min-w-[240px]
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Agent Status</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronUp className="w-4 h-4 rotate-180" />
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <Icon 
              className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`} 
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">{config.label}</div>
              {currentAgent && (
                <div className="text-xs text-slate-400">{currentAgent}</div>
              )}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
              {message}
            </div>
          )}

          {/* Metrics */}
          {(latency || cost) && (
            <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-700 pt-2">
              {latency && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{latency}s</span>
                </div>
              )}
              {cost && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  <span>${cost}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline Agent Status (for headers)
 */
export function InlineAgentStatus() {
  const { status, currentAgent } = useAgentHealth();

  const getStatusConfig = (status: AgentStatus) => {
    switch (status) {
      case 'idle':
        return { icon: CheckCircle, color: 'text-green-500', label: 'Ready' };
      case 'working':
        return { icon: Loader2, color: 'text-blue-500', label: 'Working', animate: true };
      case 'warning':
        return { icon: AlertTriangle, color: 'text-amber-500', label: 'Warning' };
      case 'error':
        return { icon: XCircle, color: 'text-red-500', label: 'Error' };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/50">
      <Icon 
        className={`w-3.5 h-3.5 ${config.color} ${config.animate ? 'animate-spin' : ''}`} 
      />
      <span className="text-xs text-slate-400">
        {currentAgent || config.label}
      </span>
    </div>
  );
}
