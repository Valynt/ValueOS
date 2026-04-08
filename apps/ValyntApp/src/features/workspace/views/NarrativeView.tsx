/**
 * NarrativeView — Narrative mode view with stream and export actions
 *
 * Phase 2: Narrative Mode
 */

import type { WarmthState } from "@shared/domain/Warmth";

interface NarrativeBlock {
  id: string;
  content: string;
  type: "insight" | "recommendation" | "evidence" | "assumption";
  confidence: number;
  sources: string[];
  warmth: WarmthState;
  nodeId: string;
}

interface NarrativeViewProps {
  blocks: NarrativeBlock[];
  warmth: WarmthState;
  onNavigateToNode: (nodeId: string) => void;
}

const warmthBadgeStyles: Record<WarmthState, string> = {
  forming: "bg-amber-100 text-amber-800",
  firm: "bg-blue-100 text-blue-800",
  verified: "bg-emerald-100 text-emerald-800",
};

const typeIcons: Record<NarrativeBlock["type"], string> = {
  insight: "💡",
  recommendation: "✓",
  evidence: "📎",
  assumption: "?",
};

export function NarrativeView({
  blocks,
  warmth,
  onNavigateToNode,
}: NarrativeViewProps): JSX.Element {
  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {/* Header with export actions */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Narrative</h1>
            <div className="flex gap-2">
              <button className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                Export PDF
              </button>
              <button className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                Presentation
              </button>
            </div>
          </div>

          {/* Narrative blocks */}
          {blocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500">No narrative blocks yet. Start building your value case.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeIcons[block.type]}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${warmthBadgeStyles[block.warmth]}`}
                      >
                        {block.warmth}
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigateToNode(block.nodeId)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View in Canvas
                    </button>
                  </div>

                  <p className="mb-3 text-gray-900">{block.content}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{Math.round(block.confidence * 100)}% confidence</span>
                    <span>{block.sources.length} source{block.sources.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outline sidebar */}
      <div className="w-64 border-l border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-700">Outline</h3>
        {blocks.length === 0 ? (
          <p className="text-xs text-gray-400">No sections yet</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((block, index) => (
              <li key={block.id} className="text-sm text-gray-600">
                {index + 1}. {block.content.substring(0, 40)}...
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { NarrativeView };
