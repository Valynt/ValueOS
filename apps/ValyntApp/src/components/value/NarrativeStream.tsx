/**
 * NarrativeStream — Timeline of narrative blocks with inline warmth badges
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

interface NarrativeStreamProps {
  caseId: string;
  blocks: NarrativeBlock[];
  warmth: WarmthState;
  onBlockClick: (blockId: string) => void;
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

export function NarrativeStream({
  caseId,
  blocks,
  warmth,
  onBlockClick,
}: NarrativeStreamProps): JSX.Element {
  if (blocks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No narrative blocks yet
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {blocks.map((block) => (
        <div
          key={block.id}
          onClick={() => onBlockClick(block.id)}
          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
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
            <span className="text-xs text-gray-500">
              {Math.round(block.confidence * 100)}% confidence
            </span>
          </div>

          <p className="mb-3 text-gray-900">{block.content}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{block.sources.length} source{block.sources.length !== 1 ? "s" : ""}</span>
            {block.sources.length > 0 && (
              <span className="truncate max-w-[200px]">{block.sources[0]}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default NarrativeStream;
