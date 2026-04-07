/**
 * Keyboard Shortcuts Hook for Power Users
 *
 * Provides global keyboard shortcuts for common actions:
 * - Navigation: arrow keys, number keys for tabs/phases
 * - Actions: accept/reject/promote hypotheses
 * - UI: toggle sidebar, help modal
 * - Workflow: save, lock, navigate cases
 *
 * Modifier keys: Ctrl/Cmd for actions, Alt for navigation
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type ShortcutModifier = "ctrl" | "alt" | "shift" | "meta";

export interface KeyboardShortcut {
  key: string;
  modifiers?: ShortcutModifier[];
  description: string;
  category: "navigation" | "action" | "workflow" | "ui";
  scope?: "global" | "local";
}

export interface ShortcutContext {
  caseId?: string;
  activePhaseId?: string;
  canAccept?: boolean;
  canReject?: boolean;
  canPromote?: boolean;
  canLock?: boolean;
}

export type ShortcutHandler = (
  event: KeyboardEvent,
  context: ShortcutContext
) => boolean | void; // return true to prevent default

// ============================================================================
// Default Shortcuts
// ============================================================================

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { key: "1", modifiers: ["alt"], description: "Go to Hypotheses", category: "navigation" },
  { key: "2", modifiers: ["alt"], description: "Go to Assumptions", category: "navigation" },
  { key: "3", modifiers: ["alt"], description: "Go to Scenarios", category: "navigation" },
  { key: "4", modifiers: ["alt"], description: "Go to Sensitivity", category: "navigation" },
  { key: "ArrowLeft", modifiers: ["alt"], description: "Previous phase", category: "navigation" },
  { key: "ArrowRight", modifiers: ["alt"], description: "Next phase", category: "navigation" },

  // Actions
  { key: "a", modifiers: ["ctrl"], description: "Accept hypothesis", category: "action" },
  { key: "r", modifiers: ["ctrl"], description: "Reject hypothesis", category: "action" },
  { key: "l", modifiers: ["ctrl"], description: "Lock as assumption", category: "action" },
  { key: "e", modifiers: ["ctrl"], description: "Edit confidence", category: "action" },

  // Workflow
  { key: "s", modifiers: ["ctrl"], description: "Save changes", category: "workflow" },
  { key: "k", modifiers: ["ctrl", "shift"], description: "Lock case as board-ready", category: "workflow" },
  { key: "n", modifiers: ["ctrl"], description: "New case", category: "workflow" },

  // UI
  { key: "b", modifiers: ["ctrl"], description: "Toggle sidebar", category: "ui" },
  { key: "Slash", modifiers: ["ctrl"], description: "Focus search/command", category: "ui" },
  { key: "?", modifiers: [], description: "Show keyboard shortcuts help", category: "ui" },
  { key: "Escape", modifiers: [], description: "Close modal / Cancel action", category: "ui" },
];

// ============================================================================
// Hook
// ============================================================================

export interface UseKeyboardShortcutsOptions {
  shortcuts?: KeyboardShortcut[];
  context?: ShortcutContext;
  handlers?: Record<string, ShortcutHandler>;
  enabled?: boolean;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts = DEFAULT_SHORTCUTS,
  context = {},
  handlers = {},
  enabled = true,
  preventDefault = true,
}: UseKeyboardShortcutsOptions) {
  const [showHelp, setShowHelp] = useState(false);
  const [lastShortcut, setLastShortcut] = useState<string | null>(null);
  const contextRef = useRef(context);
  const handlersRef = useRef(handlers);

  // Keep refs up to date
  useEffect(() => {
    contextRef.current = context;
    handlersRef.current = handlers;
  }, [context, handlers]);

  // Check if shortcut matches
  const matchesShortcut = useCallback(
    (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
      const keyMatch =
        event.key.toLowerCase() === shortcut.key.toLowerCase() ||
        event.code === shortcut.key;

      if (!keyMatch) return false;

      const requiredModifiers = shortcut.modifiers ?? [];
      const hasCtrl = event.ctrlKey;
      const hasMeta = event.metaKey;
      const hasAlt = event.altKey;
      const hasShift = event.shiftKey;

      // Check each required modifier
      for (const mod of requiredModifiers) {
        switch (mod) {
          case "ctrl":
            if (!hasCtrl) return false;
            break;
          case "meta":
            if (!hasMeta) return false;
            break;
          case "alt":
            if (!hasAlt) return false;
            break;
          case "shift":
            if (!hasShift) return false;
            break;
        }
      }

      // Check no extra modifiers pressed (except shift for ?)
      // Count actual modifiers that are pressed
      const actualModifierCount =
        (hasCtrl ? 1 : 0) + (hasMeta ? 1 : 0) + (hasAlt ? 1 : 0) + (hasShift && shortcut.key !== "?" ? 1 : 0);

      // Expected modifiers count (ctrl and meta are separate)
      const expectedModifierCount = requiredModifiers.filter(m => m !== "shift" || shortcut.key !== "?").length;

      if (actualModifierCount > expectedModifierCount) return false;

      return true;
    },
    []
  );

  // Get shortcut by key combo
  const getShortcut = useCallback(
    (event: KeyboardEvent): KeyboardShortcut | undefined => {
      return shortcuts.find((s) => matchesShortcut(event, s));
    },
    [shortcuts, matchesShortcut]
  );

  // Handle keydown
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.isContentEditable
      ) {
        // Allow Escape to work everywhere
        if (event.key !== "Escape") return;
      }

      const shortcut = getShortcut(event);
      if (!shortcut) return;

      // Special handling for help toggle
      if (shortcut.key === "?" && !shortcut.modifiers?.length) {
        setShowHelp((prev) => !prev);
        if (preventDefault) event.preventDefault();
        return;
      }

      // Special handling for Escape
      if (shortcut.key === "Escape" && !shortcut.modifiers?.length) {
        const escHandler = handlersRef.current[shortcut.key];
        if (escHandler) {
          const shouldPreventDefault = escHandler(event, contextRef.current);
          if (shouldPreventDefault && preventDefault) event.preventDefault();
        } else {
          setShowHelp(false);
          if (preventDefault) event.preventDefault();
        }
        return;
      }

      // Call handler if registered
      const handler = handlersRef.current[shortcut.key];
      if (handler) {
        const shouldPreventDefault = handler(event, contextRef.current);
        if (shouldPreventDefault && preventDefault) {
          event.preventDefault();
        }
      } else {
        // No handler - record the shortcut was pressed
        setLastShortcut(`${shortcut.modifiers?.join("+") ?? ""}${shortcut.key}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, getShortcut, preventDefault]);

  // Group shortcuts by category for help display
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const cat = shortcut.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return {
    showHelp,
    setShowHelp,
    lastShortcut,
    groupedShortcuts,
    shortcuts,
  };
}

export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.modifiers?.includes("ctrl")) parts.push("Ctrl");
  if (shortcut.modifiers?.includes("meta")) parts.push("⌘");
  if (shortcut.modifiers?.includes("alt")) parts.push("Alt");
  if (shortcut.modifiers?.includes("shift")) parts.push("Shift");
  parts.push(shortcut.key.toUpperCase());
  return parts.join("+");
}

// ============================================================================
// Pre-built Handlers for Value Model Workbench
// ============================================================================

export function createWorkbenchHandlers(
  actions: {
    onAccept?: () => void;
    onReject?: () => void;
    onPromote?: () => void;
    onEditConfidence?: () => void;
    onSave?: () => void;
    onLockCase?: () => void;
    onNavigatePhase?: (direction: "prev" | "next") => void;
    onGoToPhase?: (index: number) => void;
    onToggleSidebar?: () => void;
    onFocusSearch?: () => void;
    onClose?: () => void;
  },
  context: ShortcutContext
): Record<string, ShortcutHandler> {
  return {
    a: (e) => {
      if (context.canAccept) {
        actions.onAccept?.();
        return true;
      }
      return false;
    },
    r: (e) => {
      if (context.canReject) {
        actions.onReject?.();
        return true;
      }
      return false;
    },
    l: (e) => {
      if (context.canPromote) {
        actions.onPromote?.();
        return true;
      }
      return false;
    },
    e: (e) => {
      actions.onEditConfidence?.();
      return true;
    },
    s: (e) => {
      actions.onSave?.();
      return true;
    },
    k: (e) => {
      if (context.canLock) {
        actions.onLockCase?.();
        return true;
      }
      return false;
    },
    "1": (e) => {
      actions.onGoToPhase?.(0);
      return true;
    },
    "2": (e) => {
      actions.onGoToPhase?.(1);
      return true;
    },
    "3": (e) => {
      actions.onGoToPhase?.(2);
      return true;
    },
    "4": (e) => {
      actions.onGoToPhase?.(3);
      return true;
    },
    ArrowLeft: (e) => {
      actions.onNavigatePhase?.("prev");
      return true;
    },
    ArrowRight: (e) => {
      actions.onNavigatePhase?.("next");
      return true;
    },
    b: (e) => {
      actions.onToggleSidebar?.();
      return true;
    },
    Slash: (e) => {
      actions.onFocusSearch?.();
      return true;
    },
    Escape: (e) => {
      actions.onClose?.();
      return true;
    },
  };
}

export default useKeyboardShortcuts;

// ============================================================================
// Undo/Redo Stack Hook
// ============================================================================

export interface UndoableAction<T = unknown> {
  id: string;
  description: string;
  undo: () => T | Promise<T>;
  redo: () => T | Promise<T>;
  timestamp: number;
}

export function useUndoStack<T = unknown>(limit: number = 50) {
  const [stack, setStack] = useState<UndoableAction<T>[]>([]);
  const [index, setIndex] = useState(-1);

  const push = useCallback(
    (action: Omit<UndoableAction<T>, "timestamp">) => {
      setStack((prev) => {
        // Remove any redo actions
        const newStack = prev.slice(0, index + 1);

        // Add new action
        const newAction: UndoableAction<T> = {
          ...action,
          timestamp: Date.now(),
        };
        newStack.push(newAction);

        // Limit stack size
        if (newStack.length > limit) {
          newStack.shift();
        }

        return newStack;
      });

      setIndex((prev) => Math.min(prev + 1, limit - 1));
    },
    [index, limit]
  );

  const undo = useCallback(async (): Promise<T | null> => {
    if (index < 0) return null;

    const action = stack[index];
    if (!action) return null;

    const result = await action.undo();
    setIndex((prev) => prev - 1);

    return result;
  }, [index, stack]);

  const redo = useCallback(async (): Promise<T | null> => {
    if (index >= stack.length - 1) return null;

    const nextIndex = index + 1;
    const action = stack[nextIndex];
    if (!action) return null;

    const result = await action.redo();
    setIndex(nextIndex);

    return result;
  }, [index, stack]);

  const canUndo = index >= 0;
  const canRedo = index < stack.length - 1;

  const clear = useCallback(() => {
    setStack([]);
    setIndex(-1);
  }, []);

  return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    stackSize: stack.length,
    currentIndex: index,
  };
}
