/*
 * useViewToggle — Manages list/grid view state with localStorage persistence.
 *
 * Usage:
 *   const { view, setView } = useViewToggle("cases-view", "list");
 */
import { useState, useCallback } from "react";

export type ViewMode = "list" | "grid";

export function useViewToggle(storageKey: string, defaultView: ViewMode = "list") {
  const [view, setViewState] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "list" || stored === "grid") return stored;
    } catch {
      // SSR or localStorage unavailable
    }
    return defaultView;
  });

  const setView = useCallback(
    (newView: ViewMode) => {
      setViewState(newView);
      try {
        localStorage.setItem(storageKey, newView);
      } catch {
        // Silently fail
      }
    },
    [storageKey]
  );

  return { view, setView };
}
