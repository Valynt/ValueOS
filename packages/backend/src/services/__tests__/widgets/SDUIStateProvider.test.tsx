/**
 * SDUIStateProvider Unit Tests
 *
 * Tests for Zustand store with undo/redo and sessionStorage persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSDUIState } from "../../../apps/ValyntApp/src/lib/state/SDUIStateProvider";

describe("SDUIStateProvider", () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("state transitions", () => {
    it("should initialize with empty state", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      expect(result.current.widgets).toEqual({});
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it("should set widget state", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "test" });
      });

      expect(result.current.widgets["widget-1"]).toEqual({ value: "test" });
      expect(result.current.canUndo).toBe(true);
    });

    it("should update existing widget state", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "initial" });
      });

      act(() => {
        result.current.setWidgetState("widget-1", { value: "updated" });
      });

      expect(result.current.widgets["widget-1"]).toEqual({ value: "updated" });
    });

    it("should reset widget state", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "test" });
      });

      act(() => {
        result.current.resetWidgetState("widget-1");
      });

      expect(result.current.widgets["widget-1"]).toBeUndefined();
    });
  });

  describe("undo/redo", () => {
    it("should undo last state change", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "first" });
      });

      act(() => {
        result.current.setWidgetState("widget-1", { value: "second" });
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.widgets["widget-1"]).toEqual({ value: "first" });
      expect(result.current.canRedo).toBe(true);
    });

    it("should redo undone state change", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "first" });
      });

      act(() => {
        result.current.setWidgetState("widget-1", { value: "second" });
      });

      act(() => {
        result.current.undo();
      });

      act(() => {
        result.current.redo();
      });

      expect(result.current.widgets["widget-1"]).toEqual({ value: "second" });
      expect(result.current.canRedo).toBe(false);
    });

    it("should clear redo stack on new action after undo", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "first" });
      });

      act(() => {
        result.current.setWidgetState("widget-1", { value: "second" });
      });

      act(() => {
        result.current.undo();
      });

      act(() => {
        result.current.setWidgetState("widget-1", { value: "third" });
      });

      expect(result.current.canRedo).toBe(false);
      expect(result.current.widgets["widget-1"]).toEqual({ value: "third" });
    });

    it("should not undo when at initial state", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.undo();
      });

      expect(result.current.widgets).toEqual({});
      expect(result.current.canUndo).toBe(false);
    });

    it("should not redo when at latest state", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "test" });
      });

      act(() => {
        result.current.redo();
      });

      expect(result.current.widgets["widget-1"]).toEqual({ value: "test" });
    });
  });

  describe("sessionStorage persistence", () => {
    it("should persist state to sessionStorage", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "persisted" });
      });

      const stored = sessionStorage.getItem("sdui-state-case-1");
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toHaveProperty("widgets");
    });

    it("should restore state from sessionStorage on mount", () => {
      // Pre-populate sessionStorage
      sessionStorage.setItem(
        "sdui-state-case-1",
        JSON.stringify({
          widgets: { "widget-1": { value: "restored" } },
          past: [],
          future: [],
        })
      );

      const { result } = renderHook(() => useSDUIState("case-1"));

      expect(result.current.widgets["widget-1"]).toEqual({ value: "restored" });
    });

    it("should handle corrupted sessionStorage gracefully", () => {
      sessionStorage.setItem("sdui-state-case-1", "invalid json");

      const { result } = renderHook(() => useSDUIState("case-1"));

      expect(result.current.widgets).toEqual({});
    });

    it("should persist undo/redo stack", () => {
      const { result } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        result.current.setWidgetState("widget-1", { value: "first" });
      });

      act(() => {
        result.current.setWidgetState("widget-1", { value: "second" });
      });

      act(() => {
        result.current.undo();
      });

      const stored = JSON.parse(sessionStorage.getItem("sdui-state-case-1")!);
      expect(stored.past).toHaveLength(1);
      expect(stored.future).toHaveLength(1);
    });
  });

  describe("case isolation", () => {
    it("should isolate state per caseId", () => {
      const { result: case1 } = renderHook(() => useSDUIState("case-1"));
      const { result: case2 } = renderHook(() => useSDUIState("case-2"));

      act(() => {
        case1.current.setWidgetState("widget-1", { value: "case1" });
      });

      act(() => {
        case2.current.setWidgetState("widget-1", { value: "case2" });
      });

      expect(case1.current.widgets["widget-1"]).toEqual({ value: "case1" });
      expect(case2.current.widgets["widget-1"]).toEqual({ value: "case2" });
    });

    it("should use separate sessionStorage keys per case", () => {
      const { result: case1 } = renderHook(() => useSDUIState("case-1"));

      act(() => {
        case1.current.setWidgetState("widget-1", { value: "test" });
      });

      expect(sessionStorage.getItem("sdui-state-case-1")).toBeTruthy();
      expect(sessionStorage.getItem("sdui-state-case-2")).toBeNull();
    });
  });
});
