import React, { useState, useRef, useCallback } from 'react';
import { CanvasComponent } from '../types';

interface DragState {
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  draggedComponent: CanvasComponent | null;
}

export const useDragAndDrop = (
  components: CanvasComponent[],
  onUpdateComponent: (id: string, updates: Partial<CanvasComponent>) => void
) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    draggedComponent: null
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, component: CanvasComponent) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - rect.left - component.position.x;
    const offsetY = e.clientY - rect.top - component.position.y;

    setDragState({
      isDragging: true,
      dragOffset: { x: offsetX, y: offsetY },
      draggedComponent: component
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedComponent || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(
      e.clientX - rect.left - dragState.dragOffset.x,
      rect.width - dragState.draggedComponent.size.width
    ));
    const newY = Math.max(0, Math.min(
      e.clientY - rect.top - dragState.dragOffset.y,
      rect.height - dragState.draggedComponent.size.height
    ));

    // Snap to grid (20px grid)
    const snappedX = Math.round(newX / 20) * 20;
    const snappedY = Math.round(newY / 20) * 20;

    onUpdateComponent(dragState.draggedComponent.id, {
      position: { x: snappedX, y: snappedY }
    });
  }, [dragState, onUpdateComponent]);

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      dragOffset: { x: 0, y: 0 },
      draggedComponent: null
    });
  }, []);

  // Attach global mouse events
  React.useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  return {
    canvasRef,
    handleMouseDown,
    isDragging: dragState.isDragging,
    draggedComponent: dragState.draggedComponent
  };
};