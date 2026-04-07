/**
 * WorkspacePage — Top-level workspace page
 *
 * Integrates warmth derivation, mode selection, and mode-specific views.
 *
 * Phase 2: Integration
 */

import { useParams } from "react-router-dom";

import { ModeSelector } from "@/components/mode/ModeSelector";
import { useModeStore } from "@/stores/modeStore";
import { CanvasView } from "./CanvasView";
import { NarrativeView } from "./NarrativeView";
import { CopilotView } from "./CopilotView";
import type { WorkspaceMode } from "@shared/domain/Warmth";

// Mock data hook - to be replaced with real implementation
function useValueCase() {
  return {
    data: {
      id: "case-123",
      name: "Acme Corporation",
      saga_state: "VALIDATING" as const,
      confidence_score: 0.78,
    },
    warmth: {
      state: "firm" as const,
      modifier: null,
      confidence: 0.78,
      sagaState: "VALIDATING" as const,
    },
    availableModes: ["canvas", "narrative", "copilot", "evidence"] as WorkspaceMode[],
    isLoading: false,
    error: null,
  };
}

const ALL_MODES: WorkspaceMode[] = ["canvas", "narrative", "copilot", "evidence"];

export function WorkspacePage(): JSX.Element {
  const { caseId } = useParams<{ caseId: string }>();
  const { activeMode, setActiveMode } = useModeStore();
  const { data, warmth, availableModes, isLoading, error } = useValueCase();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div aria-label="Loading" className="animate-pulse text-gray-500">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-red-600">Something went wrong. Please try again.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">No case data available</div>
      </div>
    );
  }

  const handleNavigateToNode = (nodeId: string) => {
    console.log("Navigate to node:", nodeId);
    // Navigate to canvas view with specific node selected
    setActiveMode("canvas");
  };

  const handleSwitchMode = (mode: WorkspaceMode) => {
    setActiveMode(mode);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header with warmth badge */}
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">{data.name}</h1>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${warmth.state === "forming"
                ? "bg-amber-100 text-amber-800"
                : warmth.state === "firm"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
          >
            {warmth.state}
          </span>
        </div>
      </header>

      {/* Mode selector */}
      <div className="border-b border-gray-200 px-4 py-2">
        <ModeSelector
          activeMode={activeMode}
          onModeChange={handleSwitchMode}
          availableModes={availableModes}
          warmthState={warmth.state}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {activeMode === "canvas" && (
          <CanvasView
            graph={null}
            warmth={warmth.state}
            onNodeSelect={handleNavigateToNode}
          />
        )}
        {activeMode === "narrative" && (
          <NarrativeView
            blocks={[]}
            warmth={warmth.state}
            onNavigateToNode={handleNavigateToNode}
          />
        )}
        {activeMode === "copilot" && (
          <CopilotView
            caseId={caseId || ""}
            warmth={warmth.state}
            onNavigateToNode={handleNavigateToNode}
            onSwitchMode={handleSwitchMode}
          />
        )}
        {activeMode === "evidence" && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Evidence</h2>
            <p className="mt-2 text-gray-600">Evidence view coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default WorkspacePage;
