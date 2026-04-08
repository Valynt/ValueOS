/**
 * InspectorPanel — Dual-layer status inspector
 *
 * Shows warmth surface state by default, operational deep state one click away.
 *
 * Phase 2: Workspace Core
 */

import { useState } from "react";

import type { WarmthState } from "@shared/domain/Warmth";

interface Evidence {
  id: string;
  type: string;
  source: string;
  title: string;
  confidence: number;
  date: string;
}

interface Node {
  id: string;
  type: string;
  label: string;
  value: number;
  confidence: number;
  evidence: Evidence[];
  metadata: {
    locked: boolean;
    lastModified: string;
    owner: string;
  };
}

interface OperationalState {
  sagaState: string;
  confidenceScore: number;
  blockingReasons: string[];
  lastAgentAction: string;
  agentStatus: "idle" | "running" | "error";
}

interface InspectorPanelProps {
  node: Node | null;
  warmth: WarmthState;
  operationalState: OperationalState | null;
  onShowLineage?: () => void;
  onEdit?: () => void;
  onRequestEvidence?: () => void;
}

const warmthBadgeStyles: Record<WarmthState, string> = {
  forming: "bg-amber-100 text-amber-800",
  firm: "bg-blue-100 text-blue-800",
  verified: "bg-blue-100 text-blue-800",
};

export function InspectorPanel({
  node,
  warmth,
  operationalState,
  onShowLineage,
  onEdit,
  onRequestEvidence,
}: InspectorPanelProps): JSX.Element {
  const [showOperational, setShowOperational] = useState(false);

  if (!node) {
    return (
      <div className="p-4 text-center text-gray-500">
        Select a node to view details
      </div>
    );
  }

  const evidenceCount = node.evidence?.length ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-white p-4">
      {/* Header with warmth badge */}
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{node.label}</h2>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${warmthBadgeStyles[warmth]}`}
        >
          {warmth}
        </span>
      </div>

      {/* Value and confidence */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-gray-900">
          ${(node.value / 1000000).toFixed(1)}M
        </div>
        <div className="mt-1 text-sm text-gray-500">
          {Math.round(node.confidence * 100)}% confidence · {evidenceCount} source
          {evidenceCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={onShowLineage}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Show lineage
        </button>
        <button
          onClick={onEdit}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Edit
        </button>
        <button
          onClick={onRequestEvidence}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Request evidence
        </button>
      </div>

      {/* Operational state toggle */}
      <button
        onClick={() => setShowOperational(!showOperational)}
        className="mb-4 flex w-full items-center justify-between rounded-md border border-gray-200 p-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        <span>Deeper state</span>
        <span>{showOperational ? "▼" : "▶"}</span>
      </button>

      {/* Operational state panel */}
      {showOperational && operationalState && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500">Saga State</span>
            <div className="text-sm font-medium text-gray-900">
              {operationalState.sagaState}
            </div>
          </div>

          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500">Last Action</span>
            <div className="text-sm text-gray-700">
              {operationalState.lastAgentAction}
            </div>
          </div>

          {operationalState.blockingReasons.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-red-500">Blocking</span>
              <ul className="mt-1 list-disc pl-4 text-sm text-red-600">
                {operationalState.blockingReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <span className="text-xs font-medium text-gray-500">Agent Status</span>
            <div className="text-sm text-gray-700">{operationalState.agentStatus}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InspectorPanel;
