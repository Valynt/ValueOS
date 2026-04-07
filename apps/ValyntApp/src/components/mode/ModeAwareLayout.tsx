/**
 * ModeAwareLayout — Mode-adaptive layout container
 *
 * Renders different layouts based on the active workspace mode.
 * Each mode has a specialized layout optimized for its purpose.
 *
 * Phase 2: Workspace Core
 */

import type { WarmthState, WorkspaceMode } from "@shared/domain/Warmth";

interface ModeAwareLayoutProps {
  mode: WorkspaceMode;
  warmth: WarmthState;
  caseId: string;
  onNavigateToNode: (nodeId: string) => void;
  onSwitchMode: (mode: WorkspaceMode) => void;
  children?: React.ReactNode;
}

// Canvas layout - 3-column with React Flow
function CanvasLayout({ children }: { children?: React.ReactNode }): JSX.Element {
  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-medium text-gray-700">Outline</h3>
      </div>
      <div className="flex-1" data-testid="react-flow">
        {children}
      </div>
      <div className="w-80 border-l border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium text-gray-700">Inspector</h3>
      </div>
    </div>
  );
}

// Narrative layout - full width
function NarrativeLayout({ children }: { children?: React.ReactNode }): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl p-6">
      {children}
    </div>
  );
}

// Copilot layout - chat panel with mini canvas
function CopilotLayout({
  warmth,
  onNavigateToNode,
}: {
  warmth: WarmthState;
  onNavigateToNode: (nodeId: string) => void;
}): JSX.Element {
  const warmthBorderColor = {
    forming: "border-amber-200",
    firm: "border-blue-200",
    verified: "border-emerald-200",
  }[warmth];

  return (
    <div className="flex h-full gap-4 p-4">
      <div className={`flex-1 rounded-lg border-2 ${warmthBorderColor} bg-white p-4`}>
        <h3 className="mb-4 text-sm font-medium text-gray-700">Canvas Preview</h3>
        <div className="h-64 rounded bg-gray-50" data-testid="mini-canvas">
          <button
            onClick={() => onNavigateToNode("node-1")}
            className="m-2 rounded bg-blue-100 px-3 py-1 text-sm"
          >
            Navigate to Node
          </button>
        </div>
      </div>
      <div className="flex w-96 flex-col rounded-lg border border-gray-200 bg-white">
        <div className="flex-1 p-4">
          <p className="text-sm text-gray-500">Chat messages will appear here</p>
        </div>
        <div className="border-t border-gray-200 p-4">
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// Evidence layout
function EvidenceLayout(): JSX.Element {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900">Evidence View</h2>
      <p className="mt-2 text-gray-600">Evidence sources and validation will be shown here.</p>
    </div>
  );
}

export function ModeAwareLayout({
  mode,
  warmth,
  caseId,
  onNavigateToNode,
  onSwitchMode,
  children,
}: ModeAwareLayoutProps): JSX.Element {
  const warmthBgClass = {
    forming: "bg-amber-50/30",
    firm: "bg-blue-50/30",
    verified: "bg-emerald-50/30",
  }[warmth];

  return (
    <div className={`h-full ${warmthBgClass}`}>
      {mode === "canvas" && <CanvasLayout>{children}</CanvasLayout>}
      {mode === "narrative" && <NarrativeLayout>{children}</NarrativeLayout>}
      {mode === "copilot" && (
        <CopilotLayout warmth={warmth} onNavigateToNode={onNavigateToNode} />
      )}
      {mode === "evidence" && <EvidenceLayout />}
    </div>
  );
}
