/**
 * ModeSelector — Workspace mode tab bar
 *
 * Horizontal tab bar for switching between workspace modes.
 * Supports warmth-aware styling and keyboard navigation.
 *
 * Phase 2: Workspace Core
 */

import { useCallback } from "react";

import type { WarmthState, WorkspaceMode } from "@shared/domain/Warmth";

interface ModeSelectorProps {
  activeMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  availableModes: WorkspaceMode[];
  warmthState: WarmthState;
}

const MODE_LABELS: Record<WorkspaceMode, string> = {
  canvas: "Canvas",
  narrative: "Narrative",
  copilot: "Copilot",
  evidence: "Evidence",
};

const ALL_MODES: WorkspaceMode[] = ["canvas", "narrative", "copilot", "evidence"];

const warmthActiveStyles: Record<WarmthState, string> = {
  forming: "bg-amber-500 text-white",
  firm: "bg-blue-500 text-white",
  verified: "bg-emerald-500 text-white",
};

const warmthInactiveStyles: Record<WarmthState, string> = {
  forming: "text-amber-600 hover:bg-amber-50",
  firm: "text-blue-600 hover:bg-blue-50",
  verified: "text-emerald-600 hover:bg-emerald-50",
};

const isAvailableMode = (mode: WorkspaceMode, available: WorkspaceMode[]): boolean =>
  available.includes(mode);

export function ModeSelector({
  activeMode,
  onModeChange,
  availableModes,
  warmthState,
}: ModeSelectorProps): JSX.Element {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, mode: WorkspaceMode) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const currentIndex = ALL_MODES.indexOf(mode);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = currentIndex + direction;

        if (nextIndex >= 0 && nextIndex < ALL_MODES.length) {
          const nextMode = ALL_MODES[nextIndex] as WorkspaceMode;
          if (isAvailableMode(nextMode, availableModes)) {
            onModeChange(nextMode);
          }
        }
      }
    },
    [availableModes, onModeChange]
  );

  return (
    <nav role="tablist" aria-label="Workspace modes" className="flex space-x-1 rounded-lg bg-gray-100 p-1">
      {ALL_MODES.map((mode) => {
        const isActive = mode === activeMode;
        const isAvailable = isAvailableMode(mode, availableModes);

        return (
          <button
            key={mode}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${mode}-panel`}
            disabled={!isAvailable}
            onClick={() => isAvailable && onModeChange(mode)}
            onKeyDown={(e) => handleKeyDown(e, mode)}
            className={`
              flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${isActive ? warmthActiveStyles[warmthState] : warmthInactiveStyles[warmthState]}
              ${!isAvailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              ${isActive ? "focus:ring-gray-400" : "focus:ring-gray-300"}
            `}
          >
            {MODE_LABELS[mode]}
          </button>
        );
      })}
    </nav>
  );
}
