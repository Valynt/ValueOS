/**
 * Grid Layout Component
 * 
 * Renders children in a responsive grid with configurable columns
 * Part of the agentic canvas layout system
 */

import React from 'react';

export interface GridProps {
  columns: number;
  rows?: number;
  children: React.ReactNode[];
  gap?: number;
  responsive?: boolean;
}

export const Grid: React.FC<GridProps> = ({ 
  columns, 
  rows,
  children, 
  gap = 16,
  responsive = true
}) => {
  // Clamp columns between 1 and 12
  const validColumns = Math.max(1, Math.min(12, columns));
  
  // Build grid template
  const gridTemplateColumns = responsive 
    ? `repeat(auto-fit, minmax(${100 / validColumns}%, 1fr))`
    : `repeat(${validColumns}, 1fr)`;
  
  const gridTemplateRows = rows 
    ? `repeat(${rows}, 1fr)`
    : 'auto';
  
  return (
    <div 
      className="grid h-full w-full"
      style={{
        gridTemplateColumns,
        gridTemplateRows,
        gap: `${gap}px`,
      }}
    >
      {children.map((child, i) => (
        <div key={i} className="overflow-auto">
          {child}
        </div>
      ))}
    </div>
  );
};
