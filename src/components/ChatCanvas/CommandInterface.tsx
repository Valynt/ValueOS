/**
 * Command Interface Component
 *
 * Extracted from ChatCanvasLayout to handle user input and command processing.
 * Provides the command bar and input handling for AI interactions.
 */

import { FC, useState, useCallback, useEffect } from "react";
import { Settings, HelpCircle } from "lucide-react";
import { CommandBar } from "../Agent/CommandBar";
import { WorkflowState } from "../../repositories/WorkflowStateRepository";

interface CommandInterfaceProps {
  selectedCaseId: string | null;
  workflowState: WorkflowState | null;
  currentSessionId: string | null;
  sessionId: string | null;
  isLoading: boolean;
  onCommand: (command: string) => void;
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
}

export const CommandInterface: FC<CommandInterfaceProps> = ({
  selectedCaseId,
  workflowState,
  currentSessionId,
  sessionId,
  isLoading,
  onCommand,
  onSettingsClick,
  onHelpClick,
}) => {
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

  const handleCommand = useCallback(
    (command: string) => {
      if (!selectedCaseId || !workflowState) {
        return; // Don't process commands without a selected case
      }

      onCommand(command);
      setIsCommandBarOpen(false);
    },
    [selectedCaseId, workflowState, onCommand]
  );

  // Keyboard shortcuts (⌘K for command bar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command bar: ⌘K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandBarOpen(true);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Command Bar Modal */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        onSubmit={handleCommand}
        disabled={isLoading || !selectedCaseId}
        placeholder={
          selectedCaseId
            ? "Ask AI to analyze, optimize, or expand your value case..."
            : "Select a case to start working..."
        }
      />

      {/* Bottom Command Bar */}
      <div className="border-t border-border bg-background p-4">
        <div className="flex items-center gap-4">
          {/* Command Input */}
          <button
            onClick={() => setIsCommandBarOpen(true)}
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-muted border border-border rounded-xl text-left hover:bg-accent hover:border-ring transition-colors"
            disabled={isLoading || !selectedCaseId}
          >
            <span className="text-muted-foreground">
              {selectedCaseId
                ? "Ask AI anything about your value case..."
                : "Select a case to begin..."}
            </span>
            <kbd className="ml-auto px-2 py-1 bg-background border border-border rounded text-xs text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Action Buttons */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-3 rounded-lg bg-muted border border-border hover:bg-accent hover:border-ring transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
          )}

          {onHelpClick && (
            <button
              onClick={onHelpClick}
              className="p-3 rounded-lg bg-muted border border-border hover:bg-accent hover:border-ring transition-colors"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Status Indicator */}
        {selectedCaseId && workflowState && (
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>Case: {selectedCaseId}</span>
            <span>Stage: {workflowState.currentStage}</span>
            <span>Status: {workflowState.status}</span>
            {currentSessionId && (
              <span className="text-green-600">● Connected</span>
            )}
          </div>
        )}
      </div>
    </>
  );
};

