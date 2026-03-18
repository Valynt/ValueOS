/**
 * GraphToolbar Component - Controls for graph canvas
 */

interface GraphToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function GraphToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onExpandAll,
  onCollapseAll,
}: GraphToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 p-2 bg-white rounded-lg shadow-md border border-neutral-200">
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-neutral-100 rounded"
        title="Zoom in"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>

      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-neutral-100 rounded"
        title="Zoom out"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      <div className="w-px h-6 bg-neutral-200" />

      <button
        onClick={onFitView}
        className="p-2 hover:bg-neutral-100 rounded"
        title="Fit to screen"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      <div className="w-px h-6 bg-neutral-200" />

      <button
        onClick={onExpandAll}
        className="p-2 hover:bg-neutral-100 rounded"
        title="Expand all"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
        </svg>
      </button>

      <button
        onClick={onCollapseAll}
        className="p-2 hover:bg-neutral-100 rounded"
        title="Collapse all"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
