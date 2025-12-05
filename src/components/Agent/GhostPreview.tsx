import React, { useState, useRef, useEffect } from 'react';
import { CanvasComponent } from '../../types';

interface GhostPreviewProps {
  component: Omit<CanvasComponent, 'id'>;
  onConfirm: (position: { x: number; y: number }) => void;
  onCancel: () => void;
}

export const GhostPreview: React.FC<GhostPreviewProps> = ({
  component,
  onConfirm,
  onCancel
}) => {
  const [position, setPosition] = useState(component.position);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm(position);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position, onConfirm, onCancel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const canvas = document.querySelector('.canvas-container');
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragOffset.current.x;
    const newY = e.clientY - canvasRect.top - dragOffset.current.y;

    setPosition({
      x: Math.max(0, newX),
      y: Math.max(0, newY)
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onConfirm(position);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, position]);

  const getComponentPreview = () => {
    switch (component.type) {
      case 'metric-card':
        return (
          <div className="p-4 space-y-2">
            <div className="h-3 bg-gray-300 rounded w-3/4"></div>
            <div className="h-8 bg-gray-400 rounded w-1/2"></div>
            <div className="h-2 bg-gray-300 rounded w-2/3"></div>
          </div>
        );
      case 'interactive-chart':
        return (
          <div className="p-4 space-y-3">
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            <div className="flex items-end space-x-2 h-32">
              <div className="flex-1 bg-gray-400 rounded-t h-20"></div>
              <div className="flex-1 bg-gray-400 rounded-t h-28"></div>
              <div className="flex-1 bg-gray-400 rounded-t h-16"></div>
            </div>
          </div>
        );
      case 'data-table':
        return (
          <div className="p-4 space-y-2">
            <div className="h-3 bg-gray-300 rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-6 bg-gray-400 rounded"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
            </div>
          </div>
        );
      case 'narrative-block':
        return (
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="space-y-1">
              <div className="h-2 bg-gray-300 rounded"></div>
              <div className="h-2 bg-gray-300 rounded"></div>
              <div className="h-2 bg-gray-300 rounded w-4/5"></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div
        className="absolute border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-50 rounded-lg cursor-move transition-all hover:bg-opacity-70 z-20"
        style={{
          left: position.x,
          top: position.y,
          width: component.size.width,
          height: component.size.height,
        }}
        onMouseDown={handleMouseDown}
      >
        {getComponentPreview()}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
            Drag to position, then release
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200">
        <span className="text-sm text-gray-600">
          Drag to position or press
        </span>
        <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd>
        <span className="text-sm text-gray-600">to confirm</span>
        <span className="text-gray-300 mx-2">|</span>
        <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Esc</kbd>
        <span className="text-sm text-gray-600">to cancel</span>
      </div>
    </>
  );
};
