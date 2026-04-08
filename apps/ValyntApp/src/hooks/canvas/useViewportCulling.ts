/**
 * useViewportCulling — Performance hook for canvas node visibility
 *
 * Filters nodes to only render those within the visible viewport bounds.
 * Critical for maintaining 60fps with large graphs (100+ nodes).
 *
 * Phase 4: Hardening - 4.3 Performance (90+ Lighthouse)
 */

import { useMemo, useCallback, useState, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface CullableNode {
  id: string;
  position: Position;
}

interface UseViewportCullingOptions {
  /** Padding around viewport to include (prevents pop-in during pan) */
  padding?: number;
  /** Minimum node size to consider for culling */
  nodeSize?: number;
}

export function useViewportCulling<T extends CullableNode>(
  nodes: T[],
  bounds: ViewportBounds | null,
  options: UseViewportCullingOptions = {}
): T[] {
  const { padding = 100, nodeSize = 80 } = options;

  return useMemo(() => {
    if (!bounds) return nodes;

    const { minX, maxX, minY, maxY } = bounds;

    // Expand bounds by padding + node size
    const effectiveMinX = minX - padding - nodeSize;
    const effectiveMaxX = maxX + padding + nodeSize;
    const effectiveMinY = minY - padding - nodeSize;
    const effectiveMaxY = maxY + padding + nodeSize;

    return nodes.filter((node) => {
      const { x, y } = node.position;
      return (
        x >= effectiveMinX &&
        x <= effectiveMaxX &&
        y >= effectiveMinY &&
        y <= effectiveMaxY
      );
    });
  }, [nodes, bounds, padding, nodeSize]);
}

// Hook for tracking viewport bounds from React Flow or similar canvas
interface UseViewportBoundsOptions {
  /** Throttle updates to every N ms */
  throttleMs?: number;
}

export function useViewportBounds(
  containerRef: React.RefObject<HTMLElement>,
  options: UseViewportBoundsOptions = {}
): ViewportBounds | null {
  const { throttleMs = 16 } = options; // Default to 1 frame (60fps)
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);

  const updateBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    setBounds({
      minX: scrollLeft,
      maxX: scrollLeft + rect.width,
      minY: scrollTop,
      maxY: scrollTop + rect.height,
    });
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial bounds
    updateBounds();

    // Throttled scroll handler
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateBounds();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Resize handler
    const handleResize = () => {
      updateBounds();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, updateBounds]);

  return bounds;
}

// Combined hook for canvas virtualization
interface UseCanvasVirtualizationOptions extends UseViewportCullingOptions, UseViewportBoundsOptions {}

interface UseCanvasVirtualizationResult<T> {
  visibleNodes: T[];
  bounds: ViewportBounds | null;
  totalNodes: number;
  visibleCount: number;
}

export function useCanvasVirtualization<T extends CullableNode>(
  nodes: T[],
  containerRef: React.RefObject<HTMLElement>,
  options: UseCanvasVirtualizationOptions = {}
): UseCanvasVirtualizationResult<T> {
  const bounds = useViewportBounds(containerRef, options);
  const visibleNodes = useViewportCulling(nodes, bounds, options);

  return {
    visibleNodes,
    bounds,
    totalNodes: nodes.length,
    visibleCount: visibleNodes.length,
  };
}
