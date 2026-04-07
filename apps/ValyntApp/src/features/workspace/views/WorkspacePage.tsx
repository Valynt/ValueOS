/**
 * WorkspacePage — Top-level workspace page (Phase 6: Backend Integration)
 *
 * Integrates live data from backend:
 * - Warmth derivation from case data
 * - Real-time SSE updates
 * - Graph data with optimistic mutations
 * - Conflict resolution for collaborative edits
 */

import { useCallback } from "react";
import { useParams } from "react-router-dom";

import { ModeSelector } from "@/components/mode/ModeSelector";
import { WarmthBadge } from "@/components/warmth/WarmthBadge";
import {
  useWorkspaceData,
  useModePreference,
  useUpdateModePreference
} from "@/hooks";
import { useModeStore, useSyncModeStoreWithBackend } from "@/stores/modeStore";
import type { WorkspaceMode } from "@shared/domain/Warmth";

import { CanvasView } from "./CanvasView";
import { CopilotView } from "./CopilotView";
import { NarrativeView } from "./NarrativeView";

// TODO: Create these components
// import { ConflictPanel } from "../components/ConflictPanel";
// import { ConnectionStatus } from "../components/ConnectionStatus";

const ALL_MODES: WorkspaceMode[] = ["canvas", "narrative", "copilot", "evidence"];

export function WorkspacePage(): JSX.Element {
  const { caseId } = useParams<{ caseId: string }>();
  const { activeMode, setActiveMode } = useModeStore();

  // Fetch backend preferences and sync to store
  const { data: preferences, isLoading: isPrefsLoading } = useModePreference();
  useSyncModeStoreWithBackend(preferences, isPrefsLoading);

  // Update backend when mode changes
  const updateModePref = useUpdateModePreference();

  // Main workspace data hook (combines case, graph, events)
  const {
    caseData,
    isCaseLoading,
    caseError,
    graph,
    isGraphLoading,
    graphError,
    isConnected,
    connectionStatus,
    updateNode,
    isUpdating,
    conflicts,
    resolveConflict,
    refetch,
  } = useWorkspaceData({ caseId, enabled: !!caseId });

  const handleModeChange = useCallback((mode: WorkspaceMode) => {
    setActiveMode(mode);
    // Sync to backend
    updateModePref.mutate({ mode });
  }, [setActiveMode, updateModePref]);

  const handleNavigateToNode = useCallback((nodeId: string) => {
    console.log("Navigate to node:", nodeId);
    setActiveMode("canvas");
  }, [setActiveMode]);

  const handleUpdateNode = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    if (!caseId) return;
    updateNode({ caseId, nodeId, updates });
  }, [caseId, updateNode]);

  const isLoading = isCaseLoading || isGraphLoading || isPrefsLoading;
  const error = caseError || graphError;

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
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="text-red-600">Failed to load workspace</div>
        <button
          onClick={() => refetch()}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">No case data available</div>
      </div>
    );
  }

  const { data: caseInfo, warmth } = caseData;
  const availableModes: WorkspaceMode[] = ["canvas", "narrative", "copilot", "evidence"];

  const handleSwitchMode = (mode: WorkspaceMode) => {
    setActiveMode(mode);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header with warmth badge and connection status */}
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">{caseInfo.name}</h1>
          <WarmthBadge warmth={warmth.state} modifier={warmth.modifier} />
        </div>
        {/* TODO: Add ConnectionStatus component */}
        <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-green-600' : 'text-amber-600'}`}>
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
          {isConnected ? 'Live' : connectionStatus}
        </div>
      </header>

      {/* Mode selector */}
      <div className="border-b border-gray-200 px-4 py-2">
        <ModeSelector
          activeMode={activeMode}
          onModeChange={handleModeChange}
          availableModes={availableModes}
          warmthState={warmth.state}
        />
      </div>

      {/* Conflict panel (shown when conflicts exist) */}
      {conflicts.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-800">
              {conflicts.length} conflicting edit{conflicts.length > 1 ? 's' : ''} detected
            </span>
            <button
              onClick={() => resolveConflict({ conflictId: conflicts[0].id, resolution: 'remote' })}
              className="text-sm text-amber-700 hover:underline"
            >
              Resolve
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {activeMode === "canvas" && graph && (
          <CanvasView
            graph={graph}
            warmth={warmth.state}
            onNodeSelect={handleNavigateToNode}
            onNodeUpdate={handleUpdateNode}
            isUpdating={isUpdating}
          />
        )}
        {activeMode === "narrative" && (
          <NarrativeView
            blocks={[]} // TODO: Fetch from API
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
