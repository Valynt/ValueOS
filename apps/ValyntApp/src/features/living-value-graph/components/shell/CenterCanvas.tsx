/**
 * CenterCanvas Component - Main canvas area for graph visualization
 */

import { ReactNode } from 'react';

interface CenterCanvasProps {
  children?: ReactNode;
}

export function CenterCanvas({ children }: CenterCanvasProps) {
  return (
    <main className="flex-1 bg-neutral-50 overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
        {children || 'Graph Canvas Placeholder'}
      </div>
    </main>
  );
}
