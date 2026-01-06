/**
 * Silent Mode Toggle
 * 
 * Minimal toggle button for switching between chat and focus modes.
 * Designed to be unobtrusive and intuitive.
 */

import React from 'react';
import { MessageSquare, Layout, Zap } from 'lucide-react';
import { useSilentMode } from '../../hooks/useSilentMode';

interface SilentModeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function SilentModeToggle({ 
  className = '', 
  showLabel = false 
}: SilentModeToggleProps) {
  const { silentMode, toggleSilentMode } = useSilentMode();

  return (
    <button
      onClick={toggleSilentMode}
      className={`
        group relative flex items-center gap-2 px-3 py-1.5 rounded-lg
        transition-all duration-200
        ${silentMode 
          ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' 
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }
        ${className}
      `}
      title={silentMode ? 'Exit Focus Mode (⌘\\)' : 'Enter Focus Mode (⌘\\)'}
    >
      {/* Icon */}
      {silentMode ? (
        <Zap className="w-4 h-4" />
      ) : (
        <MessageSquare className="w-4 h-4" />
      )}

      {/* Label (optional) */}
      {showLabel && (
        <span className="text-sm font-medium">
          {silentMode ? 'Focus Mode' : 'Chat Mode'}
        </span>
      )}

      {/* Keyboard hint (on hover) */}
      <div className="
        absolute -bottom-8 left-1/2 -translate-x-1/2
        px-2 py-1 rounded bg-slate-900 border border-slate-700
        text-xs text-slate-400 whitespace-nowrap
        opacity-0 group-hover:opacity-100 transition-opacity
        pointer-events-none
      ">
        ⌘\
      </div>
    </button>
  );
}

/**
 * Silent Mode Indicator
 * 
 * Subtle indicator shown when in silent mode
 */
export function SilentModeIndicator() {
  const { silentMode } = useSilentMode();

  if (!silentMode) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
      <Zap className="w-3.5 h-3.5 text-indigo-400" />
      <span className="text-xs font-medium text-indigo-400">Focus Mode</span>
    </div>
  );
}
