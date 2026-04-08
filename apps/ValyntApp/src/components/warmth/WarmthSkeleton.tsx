import { useState, useEffect } from 'react';

/**
 * WarmthSkeleton — Skeleton loaders that match warmth state colors
 *
 * Loading states that reinforce warmth model even while data loads.
 * Prevents "flash of empty content" with warmth-appropriate placeholder visuals.
 *
 * Phase 4: Hardening - 4.1.4 Loading state choreography
 */

import type { WarmthState } from '@shared/domain/Warmth';

interface WarmthSkeletonProps {
  /** Current or expected warmth state */
  warmth: WarmthState;
  /** Layout variant */
  variant: 'card' | 'list-item' | 'dashboard-stat' | 'workspace';
  /** Number of items for list variants */
  count?: number;
  /** Custom width */
  width?: string | number;
}

export function WarmthSkeleton({
  warmth,
  variant,
  count = 1,
  width,
}: WarmthSkeletonProps): JSX.Element {
  // Warmth-appropriate colors (lighter shades)
  const warmthColors = {
    forming: {
      bg: 'bg-amber-100',
      pulse: 'bg-amber-200',
      border: 'border-amber-200',
    },
    firm: {
      bg: 'bg-slate-100',
      pulse: 'bg-slate-200',
      border: 'border-slate-200',
    },
    verified: {
      bg: 'bg-blue-50',
      pulse: 'bg-blue-100',
      border: 'border-blue-200',
    },
  };

  const colors = warmthColors[warmth];
  const widthStyle = width ? { width: typeof width === 'number' ? `${width}px` : width } : undefined;

  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return (
          <div
            className={`rounded-lg border-2 border-dashed ${colors.border} ${colors.bg} p-4`}
            style={widthStyle}
          >
            <div className={`h-4 w-1/3 rounded ${colors.pulse} animate-pulse`} />
            <div className={`mt-2 h-6 w-2/3 rounded ${colors.pulse} animate-pulse`} />
            <div className={`mt-4 h-3 w-full rounded ${colors.pulse} animate-pulse`} />
            <div className={`mt-2 h-3 w-4/5 rounded ${colors.pulse} animate-pulse`} />
          </div>
        );

      case 'list-item':
        return (
          <div
            className={`flex items-center gap-4 rounded-lg border ${colors.border} ${colors.bg} p-3`}
            style={widthStyle}
          >
            <div className={`h-10 w-10 rounded-full ${colors.pulse} animate-pulse`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 w-1/3 rounded ${colors.pulse} animate-pulse`} />
              <div className={`h-3 w-2/3 rounded ${colors.pulse} animate-pulse`} />
            </div>
          </div>
        );

      case 'dashboard-stat':
        return (
          <div
            className={`rounded-lg ${colors.bg} p-4`}
            style={widthStyle}
          >
            {/* Icon placeholder */}
            <div className={`h-8 w-8 rounded-lg ${colors.pulse} animate-pulse`} />
            {/* Count */}
            <div className={`mt-3 h-8 w-16 rounded ${colors.pulse} animate-pulse`} />
            {/* Label */}
            <div className={`mt-2 h-4 w-24 rounded ${colors.pulse} animate-pulse`} />
          </div>
        );

      case 'workspace':
        return (
          <div className="flex h-full animate-pulse">
            {/* Left sidebar */}
            <div className={`w-64 border-r ${colors.border} ${colors.bg} p-4`}>
              <div className={`h-4 w-24 rounded ${colors.pulse}`} />
              <div className={`mt-4 h-3 w-full rounded ${colors.pulse}`} />
              <div className={`mt-2 h-3 w-4/5 rounded ${colors.pulse}`} />
            </div>
            {/* Main content */}
            <div className={`flex-1 ${colors.bg} p-4`}>
              <div className={`h-64 w-full rounded-lg ${colors.pulse}`} />
            </div>
            {/* Right panel */}
            <div className={`w-80 border-l ${colors.border} ${colors.bg} p-4`}>
              <div className={`h-4 w-24 rounded ${colors.pulse}`} />
              <div className={`mt-4 h-32 w-full rounded ${colors.pulse}`} />
            </div>
          </div>
        );

      default:
        return <></>;
    }
  };

  if (count > 1 && variant !== 'workspace') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>{renderSkeleton()}</div>
        ))}
      </div>
    );
  }

  return renderSkeleton();
}

// Staggered loading for progressive disclosure
interface StaggeredWarmthSkeletonProps {
  /** Primary warmth (structure) */
  primaryWarmth: WarmthState;
  /** Secondary warmth (content, may load later) */
  secondaryWarmth?: WarmthState;
  /** Stagger delay in ms */
  staggerDelay?: number;
}

export function StaggeredWarmthSkeleton({
  primaryWarmth,
  secondaryWarmth = primaryWarmth,
  staggerDelay = 100,
}: StaggeredWarmthSkeletonProps): JSX.Element {
  const [showSecondary, setShowSecondary] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSecondary(true), staggerDelay);
    return () => clearTimeout(timer);
  }, [staggerDelay]);

  return (
    <div className="space-y-4">
      {/* Structure loads first */}
      <WarmthSkeleton warmth={primaryWarmth} variant="card" />

      {/* Content loads staggered */}
      {showSecondary && (
        <WarmthSkeleton warmth={secondaryWarmth} variant="card" count={2} />
      )}
    </div>
  );
}

// Skeleton for ActivityFeed with warmth sorting
interface ActivityFeedSkeletonProps {
  /** Warmth distribution to simulate */
  warmthDistribution: Record<WarmthState, number>;
}

export function ActivityFeedSkeleton({
  warmthDistribution,
}: ActivityFeedSkeletonProps): JSX.Element {
  const items: WarmthState[] = [];
  (Object.entries(warmthDistribution) as [WarmthState, number][]).forEach(
    ([warmth, count]) => {
      for (let i = 0; i < count; i++) {
        items.push(warmth);
      }
    }
  );

  return (
    <div className="space-y-2">
      {items.map((warmth, i) => (
        <WarmthSkeleton key={i} warmth={warmth} variant="list-item" />
      ))}
    </div>
  );
}

// Hook for managing skeleton visibility with minimum display time
interface UseWarmthSkeletonOptions {
  /** Minimum time to show skeleton (prevents flash) */
  minDuration?: number;
  /** Is data currently loading */
  isLoading: boolean;
}

export function useWarmthSkeleton({
  minDuration = 300,
  isLoading,
}: UseWarmthSkeletonOptions): {
  showSkeleton: boolean;
  skeletonWarmth: WarmthState;
} {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const [skeletonWarmth, setSkeletonWarmth] = useState<WarmthState>('forming');

  useEffect(() => {
    if (isLoading) {
      setShowSkeleton(true);
      return void 0;
    } else {
      // Keep skeleton visible for minimum duration
      const timer = setTimeout(() => {
        setShowSkeleton(false);
      }, minDuration);
      return () => clearTimeout(timer);
    }
  }, [isLoading, minDuration]);

  return { showSkeleton, skeletonWarmth };
}
