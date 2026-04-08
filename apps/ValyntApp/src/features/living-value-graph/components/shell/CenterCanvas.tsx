/**
 * CenterCanvas Component - Main canvas area for graph visualization
 */

import { ReactNode } from 'react';
import { EvidenceFreshnessOverlay } from '../overlays/EvidenceFreshnessOverlay';
import type { Graph } from '../../types/graph.types';

interface CenterCanvasProps {
  children?: ReactNode;
  graph?: Graph;
  showEvidenceOverlay?: boolean;
}

export function CenterCanvas({ children, graph, showEvidenceOverlay = true }: CenterCanvasProps) {
  return (
    <main className="flex-1 bg-neutral-50 overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
        {children || 'Graph Canvas Placeholder'}
      </div>
      {/* Evidence Freshness Overlay - floating panel */}
      {showEvidenceOverlay && graph && (
        <div className="absolute top-4 right-4 w-80 z-10">
          <EvidenceFreshnessOverlay graph={graph} />
        </div>
      )}
    </main>
  );
}
