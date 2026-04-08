/**
 * CopilotView — Copilot mode view with chat panel and canvas preview
 *
 * Phase 2: Copilot Mode
 */

import type { WarmthState, WorkspaceMode } from "@shared/domain/Warmth";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";

interface CopilotViewProps {
  caseId: string;
  warmth: WarmthState;
  onNavigateToNode: (nodeId: string) => void;
  onSwitchMode: (mode: WorkspaceMode) => void;
}

export function CopilotView({
  caseId,
  warmth,
  onNavigateToNode,
  onSwitchMode,
}: CopilotViewProps): JSX.Element {
  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left: CopilotPanel */}
      <div className="flex w-1/2 flex-col">
        <CopilotPanel
          caseId={caseId}
          warmth={warmth}
          onNavigateToNode={onNavigateToNode}
          onSwitchMode={onSwitchMode}
        />
      </div>

      {/* Right: Mini canvas preview */}
      <div className="flex w-1/2 flex-col">
        <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-4 text-sm font-medium text-gray-700">Canvas Preview</h3>
          <div data-testid="react-flow-preview" className="h-full rounded bg-white">
            <div className="flex h-full items-center justify-center text-gray-400">
              Canvas preview will render here
            </div>
          </div>
        </div>

        {/* Quick actions bar */}
        <div className="mt-4 flex gap-2">
          <button className="rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200">
            Request CRM data
          </button>
          <button className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
            Import report
          </button>
          <button className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
            Run analysis
          </button>
        </div>
      </div>
    </div>
  );
}

export { CopilotView };
