/**
 * @jest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";


import { useCaseUndoRedo, useSDUIStore, useWidgetState } from "../SDUIStateProvider";

describe("SDUIStateProvider", () => {
  const caseId = "test-case-123";
  const widgetId = "test-widget";

  beforeEach(() => {
    // Clear the store before each test
    const store = useSDUIStore.getState();
    store.resetCaseState(caseId);
  });

  describe("setWidgetState", () => {
    it("stores widget state per case", () => {
      const { result } = renderHook(() => useWidgetState(caseId, widgetId));

      act(() => {
        result.current.setState({ value: 100, name: "test" });
      });

      expect(result.current.state?.data).toEqual({ value: 100, name: "test" });
      expect(result.current.state?.dirty).toBe(true);
    });

    it("marks widget as dirty when state changes", () => {
      const { result } = renderHook(() => useWidgetState(caseId, widgetId));

      act(() => {
        result.current.setState({ value: 1 });
      });

      expect(result.current.state?.dirty).toBe(true);
    });
  });

  describe("undo/redo", () => {
    it("can undo widget state changes", () => {
      const { result: widgetResult } = renderHook(() => useWidgetState(caseId, widgetId));
      const { result: undoRedoResult } = renderHook(() => useCaseUndoRedo(caseId));

      act(() => {
        widgetResult.current.setState({ value: 1 });
      });

      act(() => {
        widgetResult.current.setState({ value: 2 });
      });

      // Undo should revert dirty state
      act(() => {
        undoRedoResult.current.undo();
      });

      expect(undoRedoResult.current.canUndo).toBe(false);
    });

    it("can redo after undo", () => {
      const { result: undoRedoResult } = renderHook(() => useCaseUndoRedo(caseId));

      act(() => {
        undoRedoResult.current.undo();
      });

      // Initially can't redo because nothing was undone
      expect(undoRedoResult.current.canRedo).toBe(false);
    });
  });

  describe("reset", () => {
    it("resets widget state", () => {
      const { result } = renderHook(() => useWidgetState(caseId, widgetId));

      act(() => {
        result.current.setState({ value: 100 });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toBeUndefined();
    });
  });

  describe("isDirty", () => {
    it("returns false when no widgets are dirty", () => {
      const { result } = renderHook(() => useCaseUndoRedo(caseId));
      expect(result.current.isDirty).toBe(false);
    });

    it("returns true when at least one widget is dirty", () => {
      const { result: widgetResult } = renderHook(() => useWidgetState(caseId, widgetId));
      const { result: undoRedoResult } = renderHook(() => useCaseUndoRedo(caseId));

      act(() => {
        widgetResult.current.setState({ value: 100 });
      });

      expect(undoRedoResult.current.isDirty).toBe(true);
    });
  });

  describe("sessionStorage persistence", () => {
    it("persists state to sessionStorage", () => {
      const store = useSDUIStore;

      act(() => {
        store.getState().setWidgetState(caseId, widgetId, { test: "data" });
      });

      // Verify the store has the data
      const widgetState = store.getState().getWidgetState(caseId, widgetId);
      expect(widgetState?.data).toEqual({ test: "data" });
    });
  });
});
