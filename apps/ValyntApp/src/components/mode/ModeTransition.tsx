/**
 * ModeTransition — Animated mode switch wrapper
 *
 * Handles smooth transitions between workspace modes with fade + slide animation.
 * Preserves scroll position for modes that need it.
 *
 * Phase 4: Hardening - 4.1 Animation & Micro-interactions
 */

import { useState, useEffect, useRef } from 'react';
import type { WorkspaceMode } from '@shared/domain/Warmth';

interface ModeTransitionProps {
  currentMode: WorkspaceMode;
  children: React.ReactNode;
  /** Modes where scroll position should be preserved */
  preserveScrollModes?: WorkspaceMode[];
  /** Animation duration in ms */
  duration?: number;
}

export function ModeTransition({
  currentMode,
  children,
  preserveScrollModes = ['narrative'],
  duration = 150,
}: ModeTransitionProps): JSX.Element {
  const [displayMode, setDisplayMode] = useState<WorkspaceMode>(currentMode);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const scrollPositions = useRef<Record<WorkspaceMode, number>>({
    canvas: 0,
    narrative: 0,
    copilot: 0,
    evidence: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentMode !== displayMode) {
      // Save scroll position before transition if mode supports it
      if (preserveScrollModes.includes(displayMode) && containerRef.current) {
        scrollPositions.current[displayMode] = containerRef.current.scrollTop;
      }

      setIsTransitioning(true);

      // Wait for exit animation then switch
      const timer = setTimeout(() => {
        setDisplayMode(currentMode);
        setIsTransitioning(false);

        // Restore scroll position after mode switch if needed
        if (preserveScrollModes.includes(currentMode) && containerRef.current) {
          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = scrollPositions.current[currentMode];
            }
          });
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [currentMode, displayMode, preserveScrollModes, duration]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto"
      style={{
        transitionProperty: 'opacity, transform',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'ease-out',
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
      }}
      data-mode={displayMode}
      data-transitioning={isTransitioning}
    >
      {children}
    </div>
  );
}

// Skeleton placeholder that matches mode layout density
interface ModeSkeletonProps {
  mode: WorkspaceMode;
}

export function ModeSkeleton({ mode }: ModeSkeletonProps): JSX.Element {
  const skeletons = {
    canvas: (
      <div className="flex h-full animate-pulse">
        <div className="w-64 border-r border-gray-200 bg-gray-100 p-4">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
        <div className="flex-1 bg-gray-50 p-4">
          <div className="h-32 w-full rounded bg-gray-200" />
        </div>
        <div className="w-80 border-l border-gray-200 bg-gray-100 p-4">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
      </div>
    ),
    narrative: (
      <div className="mx-auto max-w-4xl animate-pulse space-y-4 p-6">
        <div className="h-8 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-4 w-4/6 rounded bg-gray-200" />
      </div>
    ),
    copilot: (
      <div className="flex h-full animate-pulse gap-4 p-4">
        <div className="flex-1 rounded-lg bg-gray-100 p-4">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
        <div className="flex w-96 flex-col rounded-lg bg-gray-100">
          <div className="flex-1 p-4">
            <div className="h-4 w-full rounded bg-gray-200" />
          </div>
        </div>
      </div>
    ),
    evidence: (
      <div className="animate-pulse p-6">
        <div className="h-6 w-32 rounded bg-gray-200" />
        <div className="mt-4 h-4 w-full rounded bg-gray-200" />
      </div>
    ),
  };

  return skeletons[mode];
}
