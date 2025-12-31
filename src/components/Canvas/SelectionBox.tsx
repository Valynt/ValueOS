import React from 'react';
import { CanvasComponent } from '../../types';

interface SelectionBoxProps {
  component: CanvasComponent;
  isSelected: boolean;
  onResize?: (id: string, size: { width: number; height: number }) => void;
}

export const SelectionBox: React.FC<SelectionBoxProps> = ({
  component,
  isSelected,
  onResize
}) => {
  if (!isSelected) return null;

  const handleMouseDown = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    // TODO: Implement resize functionality
  };

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
            onMouseDown={(e) => handleMouseDown(e, 'nw')}
          />
          <div
            className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-ne-resize pointer-events-auto"
            style={{ top: -4, right: -4 }}
            onMouseDown={(e) => handleMouseDown(e, 'ne')}
          />
          <div
            className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-sw-resize pointer-events-auto"
            style={{ bottom: -4, left: -4 }}
            onMouseDown={(e) => handleMouseDown(e, 'sw')}
          />
          <div
            className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-se-resize pointer-events-auto"
            style={{ bottom: -4, right: -4 }}
            onMouseDown={(e) => handleMouseDown(e, 'se')}
          />
          
          {/* Edge handles */}
          <div
            className="absolute w-2 h-1 bg-blue-500 border border-white rounded-sm cursor-n-resize pointer-events-auto"
            style={{ top: -4, left: '50%', transform: 'translateX(-50%)' }}
            onMouseDown={(e) => handleMouseDown(e, 'n')}
          />
          <div
            className="absolute w-1 h-2 bg-blue-500 border border-white rounded-sm cursor-e-resize pointer-events-auto"
            style={{ right: -4, top: '50%', transform: 'translateY(-50%)' }}
            onMouseDown={(e) => handleMouseDown(e, 'e')}
          />
          <div
            className="absolute w-2 h-1 bg-blue-500 border border-white rounded-sm cursor-s-resize pointer-events-auto"
            style={{ bottom: -4, left: '50%', transform: 'translateX(-50%)' }}
            onMouseDown={(e) => handleMouseDown(e, 's')}
          />
          <div
            className="absolute w-1 h-2 bg-blue-500 border border-white rounded-sm cursor-w-resize pointer-events-auto"
            style={{ left: -4, top: '50%', transform: 'translateY(-50%)' }}
            onMouseDown={(e) => handleMouseDown(e, 'w')}
          />
        </>
      )}
    </div>
  );
};