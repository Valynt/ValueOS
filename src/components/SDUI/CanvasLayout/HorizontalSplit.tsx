/**
 * HorizontalSplit Layout Component
 * 
 * Renders children in horizontal rows with configurable ratios
 * Part of the agentic canvas layout system
 */

import React from 'react';

export interface HorizontalSplitProps {
  ratios: number[];
  children: React.ReactNode[];
  gap?: number;
}

export const HorizontalSplit: React.FC<HorizontalSplitProps> = ({ 
  ratios, 
  children, 
  gap = 16 
}) => {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  
  // Ensure we have matching ratios and children
  const childCount = Math.min(ratios.length, children.length);
  
  return (
    <div className="flex flex-col h-full w-full" style={{ gap: `${gap}px` }}>
      {children.slice(0, childCount).map((child, i) => (
        <div
          key={i}
          style={{ flex: (ratios[i] || 1) / totalRatio }}
          className="overflow-auto"
        >
          {child}
        </div>
      ))}
    </div>
  );
};
