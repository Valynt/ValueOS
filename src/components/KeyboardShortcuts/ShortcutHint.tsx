/**
 * Keyboard Shortcut Hint
 * 
 * Subtle hint displayed on hover to show available keyboard shortcuts.
 * Designed to educate users without cluttering the interface.
 */

import React from 'react';
import { formatShortcut, KeyboardShortcut } from '../../hooks/useKeyboardShortcuts';

interface ShortcutHintProps {
  shortcut: KeyboardShortcut;
  className?: string;
}

export function ShortcutHint({ shortcut, className = '' }: ShortcutHintProps) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded
        bg-slate-800 border border-slate-700
        text-xs font-mono text-slate-400
        ${className}
      `}
      title={shortcut.description}
    >
      {formatShortcut(shortcut)}
    </span>
  );
}

/**
 * Shortcut Tooltip
 * 
 * Tooltip that appears on hover to show keyboard shortcut
 */
interface ShortcutTooltipProps {
  shortcut: KeyboardShortcut;
  children: React.ReactNode;
}

export function ShortcutTooltip({ shortcut, children }: ShortcutTooltipProps) {
  return (
    <div className="group relative">
      {children}
      
      {/* Tooltip */}
      <div className="
        absolute -bottom-8 left-1/2 -translate-x-1/2
        px-2 py-1 rounded bg-slate-900 border border-slate-700
        text-xs text-slate-400 whitespace-nowrap
        opacity-0 group-hover:opacity-100 transition-opacity
        pointer-events-none z-50
      ">
        {formatShortcut(shortcut)}
      </div>
    </div>
  );
}

/**
 * Shortcuts Help Modal
 * 
 * Modal showing all available shortcuts for current stage
 */
interface ShortcutsHelpModalProps {
  shortcuts: KeyboardShortcut[];
  currentStage?: string;
  onClose: () => void;
}

export function ShortcutsHelpModal({ 
  shortcuts, 
  currentStage,
  onClose 
}: ShortcutsHelpModalProps) {
  // Group shortcuts by stage
  const globalShortcuts = shortcuts.filter(s => s.stage === 'global');
  const stageShortcuts = shortcuts.filter(s => s.stage === currentStage);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-md w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stage shortcuts */}
        {stageShortcuts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3 capitalize">
              {currentStage} Stage
            </h3>
            <div className="space-y-2">
              {stageShortcuts.map((shortcut, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50"
                >
                  <span className="text-sm text-slate-300">{shortcut.description}</span>
                  <ShortcutHint shortcut={shortcut} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global shortcuts */}
        {globalShortcuts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Global</h3>
            <div className="space-y-2">
              {globalShortcuts.map((shortcut, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50"
                >
                  <span className="text-sm text-slate-300">{shortcut.description}</span>
                  <ShortcutHint shortcut={shortcut} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 text-center">
          Press <ShortcutHint shortcut={{ 
            key: '/', 
            modifiers: { meta: true }, 
            action: () => {}, 
            description: 'Show shortcuts' 
          }} /> to show this dialog
        </div>
      </div>
    </div>
  );
}
