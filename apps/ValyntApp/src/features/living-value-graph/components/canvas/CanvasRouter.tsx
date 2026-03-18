/**
 * CanvasRouter Component - Switches between different canvas views
 */

import { Graph } from '../../types/graph.types';
import { CanvasView } from '../../types/ui.types';

interface CanvasRouterProps {
  activeView: CanvasView;
  graph?: Graph;
}

// Placeholder components for different views
function WaterfallView() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h3 className="text-lg font-medium text-neutral-700 mb-2">Waterfall View</h3>
        <p className="text-sm text-neutral-500">Value roll-up visualization</p>
      </div>
    </div>
  );
}

function ScenarioCompareView() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h3 className="text-lg font-medium text-neutral-700 mb-2">Scenario Comparison</h3>
        <p className="text-sm text-neutral-500">Multi-scenario analysis table</p>
      </div>
    </div>
  );
}

function SensitivityView() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h3 className="text-lg font-medium text-neutral-700 mb-2">Sensitivity Analysis</h3>
        <p className="text-sm text-neutral-500">Tornado chart and impact ranking</p>
      </div>
    </div>
  );
}

function TimelineView() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h3 className="text-lg font-medium text-neutral-700 mb-2">Timeline View</h3>
        <p className="text-sm text-neutral-500">Value realization over time</p>
      </div>
    </div>
  );
}

export function CanvasRouter({ activeView }: CanvasRouterProps) {
  switch (activeView) {
    case 'waterfall':
      return <WaterfallView />;
    case 'scenario':
      return <ScenarioCompareView />;
    case 'sensitivity':
      return <SensitivityView />;
    case 'timeline':
      return <TimelineView />;
    case 'tree':
    default:
      // Tree view is handled by ValueTreeCanvas directly
      return null;
  }
}
