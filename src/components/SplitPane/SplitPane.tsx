/**
 * SplitPane Component
 *
 * Draggable split pane layout with localStorage persistence.
 * Supports horizontal and vertical orientations.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../../lib/utils";

type Orientation = "horizontal" | "vertical";

interface SplitPaneProps {
  children: [React.ReactNode, React.ReactNode];
  orientation?: Orientation;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  storageKey?: string;
  onRatioChange?: (ratio: number) => void;
  className?: string;
  splitterClassName?: string;
  collapsible?: boolean;
  collapseThreshold?: number;
}

const STORAGE_PREFIX = "valueos-split-";

export function SplitPane({
  children,
  orientation = "horizontal",
  defaultRatio = 0.4,
  minRatio = 0.2,
  maxRatio = 0.8,
  storageKey,
  onRatioChange,
  className,
  splitterClassName,
  collapsible = true,
  collapseThreshold = 0.1,
}: SplitPaneProps) {
  const [ratio, setRatio] = useState<number>(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    }
    return defaultRatio;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist ratio to localStorage
  useEffect(() => {
    if (storageKey && !isCollapsed) {
      localStorage.setItem(STORAGE_PREFIX + storageKey, ratio.toString());
    }
  }, [ratio, storageKey, isCollapsed]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;

      if (orientation === "horizontal") {
        newRatio = (e.clientX - rect.left) / rect.width;
      } else {
        newRatio = (e.clientY - rect.top) / rect.height;
      }

      // Clamp ratio
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));

      // Check for collapse
      if (collapsible) {
        if (newRatio < collapseThreshold) {
          setIsCollapsed(true);
          newRatio = 0;
        } else if (newRatio > 1 - collapseThreshold) {
          setIsCollapsed(true);
          newRatio = 1;
        } else {
          setIsCollapsed(false);
        }
      }

      setRatio(newRatio);
      onRatioChange?.(newRatio);
    },
    [isDragging, orientation, minRatio, maxRatio, collapsible, collapseThreshold, onRatioChange]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = orientation === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp, orientation]);

  // Handle splitter double-click to reset
  const handleDoubleClick = useCallback(() => {
    setRatio(defaultRatio);
    setIsCollapsed(false);
    onRatioChange?.(defaultRatio);
  }, [defaultRatio, onRatioChange]);

  // Calculate sizes
  const firstSize = isCollapsed && ratio === 0 ? "0%" : `${ratio * 100}%`;
  const secondSize = isCollapsed && ratio === 1 ? "0%" : `${(1 - ratio) * 100}%`;

  const isHorizontal = orientation === "horizontal";

  return (
    <div
      ref={containerRef}
      className={cn("flex overflow-hidden", isHorizontal ? "flex-row" : "flex-col", className)}
    >
      {/* First pane */}
      <div
        className={cn("overflow-auto", isCollapsed && ratio === 0 && "hidden")}
        style={{
          [isHorizontal ? "width" : "height"]: firstSize,
          flexShrink: 0,
        }}
      >
        {children[0]}
      </div>

      {/* Splitter */}
      <div
        className={cn(
          "flex-shrink-0 relative group",
          isHorizontal ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
          "bg-gray-800 hover:bg-primary/50 transition-colors",
          isDragging && "bg-primary",
          splitterClassName
        )}
        onMouseDown={() => setIsDragging(true)}
        onDoubleClick={handleDoubleClick}
        role="separator"
        aria-orientation={orientation}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = 0.05;
          if (isHorizontal) {
            if (e.key === "ArrowLeft") {
              setRatio((r) => Math.max(minRatio, r - step));
            } else if (e.key === "ArrowRight") {
              setRatio((r) => Math.min(maxRatio, r + step));
            }
          } else {
            if (e.key === "ArrowUp") {
              setRatio((r) => Math.max(minRatio, r - step));
            } else if (e.key === "ArrowDown") {
              setRatio((r) => Math.min(maxRatio, r + step));
            }
          }
        }}
      >
        {/* Drag handle indicator */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isDragging && "opacity-100"
          )}
        >
          <div className={cn("rounded-full bg-primary", isHorizontal ? "w-1 h-8" : "h-1 w-8")} />
        </div>
      </div>

      {/* Second pane */}
      <div
        className={cn("overflow-auto flex-1", isCollapsed && ratio === 1 && "hidden")}
        style={{
          [isHorizontal ? "width" : "height"]: secondSize,
        }}
      >
        {children[1]}
      </div>
    </div>
  );
}

/**
 * Hook to manage split pane ratio externally
 */
export function useSplitPaneRatio(
  storageKey: string,
  defaultRatio: number = 0.4
): [number, (ratio: number) => void] {
  const [ratio, setRatioState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    }
    return defaultRatio;
  });

  const setRatio = useCallback(
    (newRatio: number) => {
      setRatioState(newRatio);
      localStorage.setItem(STORAGE_PREFIX + storageKey, newRatio.toString());
    },
    [storageKey]
  );

  return [ratio, setRatio];
}

export default SplitPane;
