// Hook for canvas keyboard navigation
// Phase 4: Hardening - 4.2 Accessibility (WCAG 2.1 AA)

import React, { useEffect, useCallback } from 'react';

interface UseCanvasKeyboardOptions {
  /** Enable/disable keyboard navigation */
  enabled?: boolean;
  /** Custom key handlers */
  customHandlers?: Record<string, () => void>;
}

export function useCanvasKeyboard(
  selectedNodeId: string | null,
  onNudge: (nodeId: string, delta: { x: number; y: number }) => void,
  onDelete: (nodeId: string) => void,
  onConnect: (nodeId: string) => void,
  options: UseCanvasKeyboardOptions = {}
): void {
  const { enabled = true, customHandlers = {} } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !selectedNodeId) return;

      // Check for custom handler first
      const customHandler = customHandlers[e.key];
      if (customHandler) {
        e.preventDefault();
        customHandler();
        return;
      }

      // Arrow key nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 50 : 10;
        const deltaMap: Record<string, { x: number; y: number }> = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
        };
        const delta = deltaMap[e.key];
        if (delta) {
          onNudge(selectedNodeId, delta);
        }
        return;
      }

      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDelete(selectedNodeId);
        return;
      }

      // Space to start connection
      if (e.key === ' ') {
        e.preventDefault();
        onConnect(selectedNodeId);
        return;
      }

      // Escape to cancel
      if (e.key === 'Escape') {
        // Could emit an event or call a handler
        return;
      }
    },
    [enabled, selectedNodeId, onNudge, onDelete, onConnect, customHandlers]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

// Utility hook for focus management within canvas
export function useCanvasFocus(): {
  focusNode: (nodeId: string) => void;
  focusedNodeId: string | null;
} {
  const [focusedNodeId, setFocusedNodeId] = React.useState<string | null>(null);

  const focusNode = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId);
    // Find and focus the DOM element
    const element = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    if (element) {
      element.focus();
      element.setAttribute('tabindex', '0');
    }
  }, []);

  return { focusNode, focusedNodeId };
}
