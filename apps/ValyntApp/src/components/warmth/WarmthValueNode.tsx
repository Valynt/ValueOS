/**
 * WarmthValueNode — React Flow node with warmth styling
 *
 * Custom React Flow node component that displays a value driver
 * with warmth-appropriate visual styling.
 *
 * Phase 2: Workspace Core
 */

import { memo, useRef, useEffect, useState } from "react";

import type { WarmthState, WarmthModifier } from "@shared/domain/Warmth";

interface WarmthValueNodeData {
  label: string;
  value?: number;
  format?: "currency" | "percent" | "number";
  confidence?: number;
  warmth?: WarmthState;
  warmthModifier?: WarmthModifier;
  isLocked?: boolean;
  evidenceCount?: number;
}

type WarmthValueNodeProps = {
  data: WarmthValueNodeData;
  selected?: boolean;
};

type RFHandleType = React.ComponentType<{
  type: "target" | "source";
  position: unknown;
  className?: string;
}>;

const warmthBorderColors: Record<WarmthState, string> = {
  forming: "border-amber-400 border-dashed",
  firm: "border-blue-400",
  verified: "border-emerald-400",
};

const warmthBgColors: Record<WarmthState, string> = {
  forming: "bg-amber-50",
  firm: "bg-white",
  verified: "bg-emerald-50",
};

const warmthBadgeColors: Record<WarmthState, string> = {
  forming: "bg-amber-100 text-amber-800",
  firm: "bg-blue-100 text-blue-800",
  verified: "bg-emerald-100 text-emerald-800",
};

const modifierIcons: Record<NonNullable<WarmthModifier>, string> = {
  firming: "↑",
  needs_review: "⚠",
};

function formatValue(value: number | undefined, format: string | undefined): string {
  if (value === undefined) return "—";

  switch (format) {
    case "currency":
      return `$${(value / 1000000).toFixed(1)}M`;
    case "percent":
      return `${(value * 100).toFixed(0)}%`;
    default:
      return value.toLocaleString();
  }
}

export const WarmthValueNode = memo(function WarmthValueNode({
  data,
  selected,
}: WarmthValueNodeProps): JSX.Element {
  const warmth = data.warmth ?? "forming";
  const modifier = data.warmthModifier;
  const confidence = data.confidence ?? 0.5;
  const evidenceCount = data.evidenceCount ?? 0;
  const HandleRef = useRef<RFHandleType | null>(null);
  const [positions, setPositions] = useState<{ Top: unknown; Bottom: unknown } | null>(null);
  const [rfLoaded, setRfLoaded] = useState(false);

  useEffect(() => {
    // Dynamically import React Flow only when available (not in tests)
    import("@xyflow/react")
      .then((rf) => {
        HandleRef.current = rf.Handle as unknown as RFHandleType;
        setPositions(rf.Position);
        setRfLoaded(true);
      })
      .catch(() => {
        // React Flow not available (test environment)
      });
  }, []);

  const Handle = rfLoaded ? HandleRef.current : null;

  return (
    <div
      className={`
        relative min-w-[160px] rounded-lg border-2 p-3 shadow-sm transition-all
        ${warmthBorderColors[warmth]}
        ${warmthBgColors[warmth]}
        ${selected ? "ring-2 ring-offset-2 ring-blue-400" : ""}
      `}
      data-testid="warmth-value-node"
      data-warmth={warmth}
    >
      {/* Warmth badge */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${warmthBadgeColors[warmth]}`}
          data-testid="warmth-badge"
        >
          {warmth}
          {modifier && (
            <span className="ml-1" title={modifier}>
              {modifierIcons[modifier]}
            </span>
          )}
        </span>

        {/* Lock indicator */}
        {data.isLocked && (
          <span className="text-gray-500" data-testid="lock-icon" aria-label="locked">
            🔒
          </span>
        )}
      </div>

      {/* Node label */}
      <div className="mb-1 font-medium text-gray-900" data-testid="node-label">
        {data.label}
      </div>

      {/* Value display */}
      <div className="text-lg font-semibold text-gray-800" data-testid="node-value">
        {formatValue(data.value, data.format)}
      </div>

      {/* Confidence bar */}
      <div className="mt-2">
        <div className="h-1.5 w-full rounded-full bg-gray-200">
          <div
            className={`h-1.5 rounded-full ${warmth === "forming" ? "bg-amber-400" : warmth === "firm" ? "bg-blue-400" : "bg-emerald-400"}`}
            style={{ width: `${confidence * 100}%` }}
            data-testid="confidence-bar"
          />
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {Math.round(confidence * 100)}% confidence
        </div>
      </div>

      {/* Evidence badge */}
      {evidenceCount > 0 && (
        <div className="mt-2 flex items-center text-xs text-gray-600">
          <span className="mr-1">📎</span>
          {evidenceCount} source{evidenceCount !== 1 ? "s" : ""}
        </div>
      )}

      {/* React Flow handles */}
      {Handle && positions && (
        <>
          <Handle type="target" position={positions.Top} className="!bg-gray-400" />
          <Handle type="source" position={positions.Bottom} className="!bg-gray-400" />
        </>
      )}
    </div>
  );
});

export default WarmthValueNode;
