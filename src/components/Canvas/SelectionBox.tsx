import React, { useEffect, useRef } from 'react';
import { CanvasComponent } from '../../types';

export interface ResizeResult {
  size: { width: number; height: number };
  position?: { x: number; y: number };
}

interface SelectionBoxProps {
  component: CanvasComponent;
  isSelected: boolean;
  onResize?: (id: string, result: ResizeResult) => void;
}

export const SelectionBox: React.FC<SelectionBoxProps> = ({
  component,
  isSelected,
  onResize
}) => {
  // Use a ref to store current drag state to avoid stale closures in event listeners
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
    direction: string;
  } | null>(null);

  // Store active listeners to ensure correct removal on unmount/cleanup
  const listenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragRef.current || !onResize) return;

    const {
      startX,
      startY,
      startWidth,
      startHeight,
      startLeft,
      startTop,
      direction
    } = dragRef.current;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startLeft;
    let newY = startTop;

    // Minimum dimensions
    const MIN_WIDTH = 50;
    const MIN_HEIGHT = 50;

    // Calculate new dimensions based on direction
    if (direction.includes('e')) {
      newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
    }
    if (direction.includes('w')) {
      const tentativeWidth = startWidth - deltaX;
      if (tentativeWidth >= MIN_WIDTH) {
        newWidth = tentativeWidth;
        newX = startLeft + deltaX;
      } else {
        newWidth = MIN_WIDTH;
        newX = startLeft + (startWidth - MIN_WIDTH);
      }
    }
    if (direction.includes('s')) {
      newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
    }
    if (direction.includes('n')) {
      const tentativeHeight = startHeight - deltaY;
      if (tentativeHeight >= MIN_HEIGHT) {
        newHeight = tentativeHeight;
        newY = startTop + deltaY;
      } else {
        newHeight = MIN_HEIGHT;
        newY = startTop + (startHeight - MIN_HEIGHT);
      }
    }

    const result: ResizeResult = {
      size: { width: newWidth, height: newHeight }
    };

    // Only include position if it changed
    if (newX !== startLeft || newY !== startTop) {
      result.position = { x: newX, y: newY };
    }

    onResize(component.id, result);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!dragRef.current) return;

    dragRef.current = null;

    if (listenersRef.current) {
        document.removeEventListener('pointermove', listenersRef.current.move);
        document.removeEventListener('pointerup', listenersRef.current.up);
        listenersRef.current = null;
    }

    document.body.style.userSelect = '';
  };

  const handlePointerDown = (e: React.PointerEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Set dragging state
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: component.size.width,
      startHeight: component.size.height,
      startLeft: component.position.x,
      startTop: component.position.y,
      direction
    };

    // Store references to the handlers used
    listenersRef.current = {
        move: handlePointerMove,
        up: handlePointerUp
    };

    // Add global listeners
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.body.style.userSelect = 'none';

    // Capture pointer if possible for smoother dragging
    if (e.target instanceof Element && typeof e.target.setPointerCapture === 'function') {
      e.target.setPointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    // Cleanup listeners on unmount
    return () => {
      if (listenersRef.current) {
          document.removeEventListener('pointermove', listenersRef.current.move);
          document.removeEventListener('pointerup', listenersRef.current.up);
      }
      document.body.style.userSelect = '';
    };
  }, []);

  if (!isSelected) return null;

  return (
    <div
      className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500 bg-opacity-5"
      style={{
        left: component.position.x - 2,
        top: component.position.y - 2,
        width: component.size.width + 4,
        height: component.size.height + 4,
        borderRadius: '8px'
      }}
    >
      {/* Resize handles */}
      {onResize && (
        <>
          {/* Corner handles */}
          <div
            className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-nw-resize pointer-events-auto"
            style={{ top: -4, left: -4 }}
            onPointerDown={(e) => handlePointerDown(e, 'nw')}
          />
          <div
            className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-ne-resize pointer-events-auto"
            style={{ top: -4, right: -4 }}
            onPointerDown={(e) => handlePointerDown(e, 'ne')}
          />
          <div
            className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-sw-resize pointer-events-auto"
            style={{ bottom: -4, left: -4 }}
            onPointerDown={(e) => handlePointerDown(e, 'sw')}
          />
          <div
            className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-se-resize pointer-events-auto"
            style={{ bottom: -4, right: -4 }}
            onPointerDown={(e) => handlePointerDown(e, 'se')}
          />
          
          {/* Edge handles */}
          <div
            className="absolute w-2 h-1 bg-blue-500 border border-white rounded-sm cursor-n-resize pointer-events-auto"
            style={{ top: -4, left: '50%', transform: 'translateX(-50%)' }}
            onPointerDown={(e) => handlePointerDown(e, 'n')}
          />
          <div
            className="absolute w-1 h-2 bg-blue-500 border border-white rounded-sm cursor-e-resize pointer-events-auto"
            style={{ right: -4, top: '50%', transform: 'translateY(-50%)' }}
            onPointerDown={(e) => handlePointerDown(e, 'e')}
          />
          <div
            className="absolute w-2 h-1 bg-blue-500 border border-white rounded-sm cursor-s-resize pointer-events-auto"
            style={{ bottom: -4, left: '50%', transform: 'translateX(-50%)' }}
            onPointerDown={(e) => handlePointerDown(e, 's')}
          />
          <div
            className="absolute w-1 h-2 bg-blue-500 border border-white rounded-sm cursor-w-resize pointer-events-auto"
            style={{ left: -4, top: '50%', transform: 'translateY(-50%)' }}
            onPointerDown={(e) => handlePointerDown(e, 'w')}
          />
        </>
      )}
    </div>
  );
};