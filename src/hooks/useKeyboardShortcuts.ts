/**
 * Keyboard Shortcuts Hook
 * 
 * Context-aware keyboard shortcuts that adapt based on current workflow stage.
 * Provides power users with fast access to common actions.
 * 
 * Shortcuts by Stage:
 * 
 * Opportunity:
 * - ⌘R: Run ROI calculation
 * - ⌘M: Open system map
 * - ⌘V: Validate hypothesis
 * 
 * Target:
 * - ⌘C: Create commitment
 * - ⌘T: Run target analysis
 * - ⌘D: View dependencies
 * 
 * Realization:
 * - ⌘E: Execute realization
 * - ⌘P: View progress
 * - ⌘I: View impact
 * 
 * Global:
 * - ⌘K: Command palette
 * - ⌘\: Toggle silent mode
 * - ⌘/: Show shortcuts
 */

import { useCallback, useEffect } from 'react';
import { logger } from '../lib/logger';

export type WorkflowStage = 'opportunity' | 'target' | 'realization' | 'expansion';

export interface KeyboardShortcut {
  key: string;
  modifiers: {
    meta?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
  action: () => void;
  description: string;
  stage?: WorkflowStage | 'global';
}

interface UseKeyboardShortcutsOptions {
  currentStage?: WorkflowStage;
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  currentStage,
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Find matching shortcut
      const matchingShortcut = shortcuts.find(shortcut => {
        // Check if stage matches (or is global)
        if (shortcut.stage && shortcut.stage !== 'global' && shortcut.stage !== currentStage) {
          return false;
        }

        // Check key
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) {
          return false;
        }

        // Check modifiers
        const { meta, ctrl, shift, alt } = shortcut.modifiers;
        
        if (meta !== undefined && (e.metaKey !== meta)) return false;
        if (ctrl !== undefined && (e.ctrlKey !== ctrl)) return false;
        if (shift !== undefined && (e.shiftKey !== shift)) return false;
        if (alt !== undefined && (e.altKey !== alt)) return false;

        return true;
      });

      if (matchingShortcut) {
        e.preventDefault();
        logger.info('Keyboard shortcut triggered', {
          key: matchingShortcut.key,
          stage: currentStage,
          description: matchingShortcut.description,
        });
        matchingShortcut.action();
      }
    },
    [shortcuts, currentStage, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress, enabled]);

  return {
    shortcuts: shortcuts.filter(
      s => s.stage === 'global' || s.stage === currentStage
    ),
  };
}

/**
 * Get default shortcuts for a workflow stage
 */
export function getDefaultShortcuts(
  stage: WorkflowStage,
  actions: {
    runROI?: () => void;
    openSystemMap?: () => void;
    validateHypothesis?: () => void;
    createCommitment?: () => void;
    runTargetAnalysis?: () => void;
    viewDependencies?: () => void;
    executeRealization?: () => void;
    viewProgress?: () => void;
    viewImpact?: () => void;
  }
): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];

  // Opportunity stage shortcuts
  if (stage === 'opportunity') {
    if (actions.runROI) {
      shortcuts.push({
        key: 'r',
        modifiers: { meta: true },
        action: actions.runROI,
        description: 'Run ROI calculation',
        stage: 'opportunity',
      });
    }
    if (actions.openSystemMap) {
      shortcuts.push({
        key: 'm',
        modifiers: { meta: true },
        action: actions.openSystemMap,
        description: 'Open system map',
        stage: 'opportunity',
      });
    }
    if (actions.validateHypothesis) {
      shortcuts.push({
        key: 'v',
        modifiers: { meta: true },
        action: actions.validateHypothesis,
        description: 'Validate hypothesis',
        stage: 'opportunity',
      });
    }
  }

  // Target stage shortcuts
  if (stage === 'target') {
    if (actions.createCommitment) {
      shortcuts.push({
        key: 'c',
        modifiers: { meta: true },
        action: actions.createCommitment,
        description: 'Create commitment',
        stage: 'target',
      });
    }
    if (actions.runTargetAnalysis) {
      shortcuts.push({
        key: 't',
        modifiers: { meta: true },
        action: actions.runTargetAnalysis,
        description: 'Run target analysis',
        stage: 'target',
      });
    }
    if (actions.viewDependencies) {
      shortcuts.push({
        key: 'd',
        modifiers: { meta: true },
        action: actions.viewDependencies,
        description: 'View dependencies',
        stage: 'target',
      });
    }
  }

  // Realization stage shortcuts
  if (stage === 'realization') {
    if (actions.executeRealization) {
      shortcuts.push({
        key: 'e',
        modifiers: { meta: true },
        action: actions.executeRealization,
        description: 'Execute realization',
        stage: 'realization',
      });
    }
    if (actions.viewProgress) {
      shortcuts.push({
        key: 'p',
        modifiers: { meta: true },
        action: actions.viewProgress,
        description: 'View progress',
        stage: 'realization',
      });
    }
    if (actions.viewImpact) {
      shortcuts.push({
        key: 'i',
        modifiers: { meta: true },
        action: actions.viewImpact,
        description: 'View impact',
        stage: 'realization',
      });
    }
  }

  return shortcuts;
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.modifiers.meta) parts.push('⌘');
  if (shortcut.modifiers.ctrl) parts.push('Ctrl');
  if (shortcut.modifiers.shift) parts.push('⇧');
  if (shortcut.modifiers.alt) parts.push('⌥');

  parts.push(shortcut.key.toUpperCase());

  return parts.join(' + ');
}
