import React from 'react';

interface CanvasGridProps {
  gridSize?: number;
  opacity?: number;
}

export const CanvasGrid: React.FC<CanvasGridProps> = ({ 
  gridSize = 20, 
  opacity = 0.1 
}) => {
  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(156, 163, 175, ${opacity}) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(156, 163, 175, ${opacity}) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`
      }}
    />
  );
};