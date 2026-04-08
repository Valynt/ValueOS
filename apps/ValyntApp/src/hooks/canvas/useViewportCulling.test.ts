import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewportCulling, useViewportBounds, useCanvasVirtualization } from './useViewportCulling';
import { useRef } from 'react';

describe('useViewportCulling', () => {
  const mockNodes = [
    { id: '1', position: { x: 0, y: 0 } },
    { id: '2', position: { x: 100, y: 100 } },
    { id: '3', position: { x: 10000, y: 10000 } }, // Far outside
    { id: '4', position: { x: 500, y: 500 } },
    { id: '5', position: { x: -200, y: -200 } }, // Outside left/top
  ];

  it('returns all nodes when bounds is null', () => {
    const { result } = renderHook(() => useViewportCulling(mockNodes, null));

    expect(result.current).toHaveLength(5);
  });

  it('filters nodes outside viewport bounds', () => {
    // With default padding=100 and nodeSize=80, effective bounds are expanded by 180
    // So use bounds that keep node 5 (-200, -200) outside even with expansion
    const bounds = { minX: -100, maxX: 600, minY: -100, maxY: 600 };

    const { result } = renderHook(() =>
      useViewportCulling(mockNodes, bounds, { padding: 0, nodeSize: 0 })
    );

    // Nodes 1, 2, 4 are inside; 3 (10000,10000) and 5 (-200,-200) are outside
    expect(result.current).toHaveLength(3);
    expect(result.current.map((n) => n.id)).toContain('1');
    expect(result.current.map((n) => n.id)).toContain('2');
    expect(result.current.map((n) => n.id)).toContain('4');
    expect(result.current.map((n) => n.id)).not.toContain('3');
    expect(result.current.map((n) => n.id)).not.toContain('5');
  });

  it('applies padding to bounds', () => {
    const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    const { result } = renderHook(() =>
      useViewportCulling(mockNodes, bounds, { padding: 50 })
    );

    // With 50px padding, node at 100,100 should be included
    expect(result.current.map((n) => n.id)).toContain('2');
  });

  it('memoizes results', () => {
    const bounds = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };

    const { result, rerender } = renderHook(() => useViewportCulling(mockNodes, bounds));

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it('recalculates when bounds change', () => {
    const { result, rerender } = renderHook(
      ({ bounds }) => useViewportCulling(mockNodes, bounds),
      { initialProps: { bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 } } }
    );

    const firstResult = result.current;

    rerender({ bounds: { minX: 0, maxX: 50, minY: 0, maxY: 50 } });

    expect(result.current).not.toBe(firstResult);
    expect(result.current.length).toBeLessThan(firstResult.length);
  });
});

describe('useViewportBounds', () => {
  it('returns null initially when container is not available', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(null);
      return useViewportBounds(ref);
    });

    expect(result.current).toBeNull();
  });

  it('calculates bounds when container is available', () => {
    const mockElement = {
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
      scrollLeft: 100,
      scrollTop: 50,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(mockElement);
      return useViewportBounds(ref);
    });

    // Should calculate initial bounds
    expect(result.current).toEqual({
      minX: 100,
      maxX: 900,
      minY: 50,
      maxY: 650,
    });
  });
});

describe('useCanvasVirtualization', () => {
  const mockNodes = [
    { id: '1', position: { x: 0, y: 0 } },
    { id: '2', position: { x: 100, y: 100 } },
    { id: '3', position: { x: 10000, y: 10000 } },
  ];

  it('returns virtualization result object', () => {
    const mockElement = {
      getBoundingClientRect: () => ({ width: 500, height: 500 }),
      scrollLeft: 0,
      scrollTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(mockElement);
      return useCanvasVirtualization(mockNodes, ref);
    });

    expect(result.current.visibleNodes).toBeDefined();
    expect(result.current.bounds).toBeDefined();
    expect(result.current.totalNodes).toBe(3);
    expect(result.current.visibleCount).toBeDefined();
  });
});
