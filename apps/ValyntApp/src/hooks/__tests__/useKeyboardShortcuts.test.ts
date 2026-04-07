/**
 * Unit tests for useKeyboardShortcuts hook.
 *
 * Tests cover:
 * - Default shortcuts registration
 * - Custom shortcuts override
 * - Modifier key combinations (Ctrl, Alt, Shift, Meta)
 * - Context-aware shortcut filtering
 * - Handler invocation and return value handling
 * - Help modal toggle
 * - Enabled/disabled state
 * - preventDefault behavior
 * - Key event filtering (input elements excluded)
 * - Last shortcut tracking
 * - formatShortcut utility
 * - createWorkbenchHandlers factory
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

import {
  useKeyboardShortcuts,
  formatShortcut,
  createWorkbenchHandlers,
  DEFAULT_SHORTCUTS,
} from "../useKeyboardShortcuts.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createKeyboardEvent(overrides: Partial<KeyboardEventInit> = {}) {
  return new KeyboardEvent("keydown", {
    key: "a",
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("default shortcuts", () => {
    it("exports DEFAULT_SHORTCUTS array", () => {
      expect(Array.isArray(DEFAULT_SHORTCUTS)).toBe(true);
      expect(DEFAULT_SHORTCUTS.length).toBeGreaterThan(0);
    });

    it("includes navigation shortcuts", () => {
      const navShortcuts = DEFAULT_SHORTCUTS.filter((s) => s.category === "navigation");
      expect(navShortcuts.length).toBeGreaterThan(0);
    });

    it("includes action shortcuts", () => {
      const actionShortcuts = DEFAULT_SHORTCUTS.filter((s) => s.category === "action");
      expect(actionShortcuts.length).toBeGreaterThan(0);
    });

    it("includes workflow shortcuts", () => {
      const workflowShortcuts = DEFAULT_SHORTCUTS.filter((s) => s.category === "workflow");
      expect(workflowShortcuts.length).toBeGreaterThan(0);
    });

    it("includes UI shortcuts", () => {
      const uiShortcuts = DEFAULT_SHORTCUTS.filter((s) => s.category === "ui");
      expect(uiShortcuts.length).toBeGreaterThan(0);
    });
  });

  describe("hook behavior", () => {
    it("returns showHelp, setShowHelp, lastShortcut, groupedShortcuts, shortcuts", () => {
      const { result } = renderHook(() => useKeyboardShortcuts({}));

      expect(result.current).toHaveProperty("showHelp");
      expect(result.current).toHaveProperty("setShowHelp");
      expect(result.current).toHaveProperty("lastShortcut");
      expect(result.current).toHaveProperty("groupedShortcuts");
      expect(result.current).toHaveProperty("shortcuts");
    });

    it("starts with showHelp=false", () => {
      const { result } = renderHook(() => useKeyboardShortcuts({}));
      expect(result.current.showHelp).toBe(false);
    });

    it("starts with lastShortcut=null", () => {
      const { result } = renderHook(() => useKeyboardShortcuts({}));
      expect(result.current.lastShortcut).toBeNull();
    });

    it("groups shortcuts by category", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            { key: "a", description: "Action A", category: "action" },
            { key: "b", description: "Nav B", category: "navigation" },
            { key: "c", description: "Action C", category: "action" },
          ],
        })
      );

      expect(result.current.groupedShortcuts).toHaveProperty("action");
      expect(result.current.groupedShortcuts).toHaveProperty("navigation");
      expect(result.current.groupedShortcuts.action).toHaveLength(2);
      expect(result.current.groupedShortcuts.navigation).toHaveLength(1);
    });

    it("uses custom shortcuts when provided", () => {
      const customShortcuts = [
        { key: "x", description: "Custom X", category: "action" as const },
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({ shortcuts: customShortcuts })
      );

      expect(result.current.shortcuts).toBe(customShortcuts);
    });
  });

  describe("keyboard event handling", () => {
    it("triggers handler when shortcut matches", () => {
      const handler = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
          handlers: { a: handler },
        })
      );

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "a", ctrlKey: true }));
      });

      expect(handler).toHaveBeenCalled();
    });

    it("does not trigger handler when modifiers do not match", () => {
      const handler = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
          handlers: { a: handler },
        })
      );

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "a", ctrlKey: false }));
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("ignores key events when typing in input", () => {
      const handler = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
          handlers: { a: handler },
        })
      );

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      act(() => {
        input.dispatchEvent(createKeyboardEvent({ key: "a", ctrlKey: true }));
      });

      expect(handler).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it("allows Escape to work even when typing in input", () => {
      const handler = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "Escape", description: "Close", category: "ui" }],
          handlers: { Escape: handler },
        })
      );

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      act(() => {
        input.dispatchEvent(createKeyboardEvent({ key: "Escape" }));
      });

      expect(handler).toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it("toggles showHelp when ? is pressed", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "?", description: "Help", category: "ui" }],
        })
      );

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "?", shiftKey: true }));
      });

      expect(result.current.showHelp).toBe(true);

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "?", shiftKey: true }));
      });

      expect(result.current.showHelp).toBe(false);
    });

    it("closes help when Escape is pressed", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            { key: "?", description: "Help", category: "ui" },
            { key: "Escape", description: "Close", category: "ui" },
          ],
        })
      );

      // Open help
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "?", shiftKey: true }));
      });
      expect(result.current.showHelp).toBe(true);

      // Close with Escape
      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "Escape" }));
      });
      expect(result.current.showHelp).toBe(false);
    });

    it("tracks last shortcut when no handler is registered", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
        })
      );

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "a", ctrlKey: true }));
      });

      expect(result.current.lastShortcut).toBe("ctrla");
    });

    it("does not register shortcuts when disabled", () => {
      const handler = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
          handlers: { a: handler },
          enabled: false,
        })
      );

      act(() => {
        window.dispatchEvent(createKeyboardEvent({ key: "a", ctrlKey: true }));
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("calls preventDefault when preventDefault option is true", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
          preventDefault: true,
        })
      );

      const event = createKeyboardEvent({ key: "a", ctrlKey: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("does not call preventDefault when preventDefault option is false", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
          preventDefault: false,
        })
      );

      const event = createKeyboardEvent({ key: "a", ctrlKey: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("removes event listener on unmount", () => {
      const handler = vi.fn();
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" }],
          handlers: { a: handler },
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
  });
});

describe("formatShortcut", () => {
  it("formats Ctrl+Key correctly", () => {
    const result = formatShortcut({ key: "a", modifiers: ["ctrl"], description: "Test", category: "action" });
    expect(result).toBe("Ctrl+A");
  });

  it("formats Meta+Key correctly", () => {
    const result = formatShortcut({ key: "s", modifiers: ["meta"], description: "Save", category: "workflow" });
    expect(result).toBe("⌘+S");
  });

  it("formats multiple modifiers correctly", () => {
    const result = formatShortcut({
      key: "k",
      modifiers: ["ctrl", "shift"],
      description: "Lock",
      category: "workflow",
    });
    expect(result).toBe("Ctrl+Shift+K");
  });

  it("formats key without modifiers correctly", () => {
    const result = formatShortcut({ key: "Escape", description: "Close", category: "ui" });
    expect(result).toBe("ESCAPE");
  });
});

describe("createWorkbenchHandlers", () => {
  it("returns handlers for all workbench actions", () => {
    const handlers = createWorkbenchHandlers(
      {
        onAccept: vi.fn(),
        onReject: vi.fn(),
        onPromote: vi.fn(),
        onEditConfidence: vi.fn(),
        onSave: vi.fn(),
        onLockCase: vi.fn(),
        onNavigatePhase: vi.fn(),
        onGoToPhase: vi.fn(),
        onToggleSidebar: vi.fn(),
        onFocusSearch: vi.fn(),
        onClose: vi.fn(),
      },
      { canAccept: true, canReject: true, canPromote: true, canLock: true }
    );

    expect(handlers).toHaveProperty("a");
    expect(handlers).toHaveProperty("r");
    expect(handlers).toHaveProperty("l");
    expect(handlers).toHaveProperty("e");
    expect(handlers).toHaveProperty("s");
    expect(handlers).toHaveProperty("k");
    expect(handlers).toHaveProperty("1");
    expect(handlers).toHaveProperty("2");
    expect(handlers).toHaveProperty("3");
    expect(handlers).toHaveProperty("4");
    expect(handlers).toHaveProperty("ArrowLeft");
    expect(handlers).toHaveProperty("ArrowRight");
    expect(handlers).toHaveProperty("b");
    expect(handlers).toHaveProperty("Slash");
    expect(handlers).toHaveProperty("Escape");
  });

  it("calls onAccept when canAccept is true", () => {
    const onAccept = vi.fn();
    const handlers = createWorkbenchHandlers(
      { onAccept },
      { canAccept: true }
    );

    const mockEvent = {} as KeyboardEvent;
    handlers["a"](mockEvent, { canAccept: true });

    expect(onAccept).toHaveBeenCalled();
  });

  it("does not call onAccept when canAccept is false", () => {
    const onAccept = vi.fn();
    const handlers = createWorkbenchHandlers(
      { onAccept },
      { canAccept: false }
    );

    const mockEvent = {} as KeyboardEvent;
    handlers["a"](mockEvent, { canAccept: false });

    expect(onAccept).not.toHaveBeenCalled();
  });

  it("calls onGoToPhase with correct index for number keys", () => {
    const onGoToPhase = vi.fn();
    const handlers = createWorkbenchHandlers({ onGoToPhase }, {});

    handlers["1"]({} as KeyboardEvent, {});
    expect(onGoToPhase).toHaveBeenCalledWith(0);

    handlers["2"]({} as KeyboardEvent, {});
    expect(onGoToPhase).toHaveBeenCalledWith(1);

    handlers["3"]({} as KeyboardEvent, {});
    expect(onGoToPhase).toHaveBeenCalledWith(2);

    handlers["4"]({} as KeyboardEvent, {});
    expect(onGoToPhase).toHaveBeenCalledWith(3);
  });

  it("calls onNavigatePhase with prev/next for arrow keys", () => {
    const onNavigatePhase = vi.fn();
    const handlers = createWorkbenchHandlers({ onNavigatePhase }, {});

    handlers["ArrowLeft"]({} as KeyboardEvent, {});
    expect(onNavigatePhase).toHaveBeenCalledWith("prev");

    handlers["ArrowRight"]({} as KeyboardEvent, {});
    expect(onNavigatePhase).toHaveBeenCalledWith("next");
  });
});
