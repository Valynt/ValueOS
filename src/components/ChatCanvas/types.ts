/**
 * Chat Canvas Types
 *
 * Shared types for ChatCanvas components with enhanced type safety
 */

import { SDUIPageDefinition } from "../../sdui/schema";
import { EnhancedValueCase, CaseId } from "../../types/enhancedTypes";

// Re-export enhanced types for backward compatibility
export type ValueCase = EnhancedValueCase;

export interface ChatCanvasLayoutProps {
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
  initialAction?: {
    type: string;
    data: any;
  } | null;
}

// Type-safe event handlers
export interface CanvasEventHandlers {
  onCaseSelect: (caseId: CaseId) => void;
  onCommand: (command: string) => void;
  onStarterAction: (action: string, data?: any) => void;
  onNewCase: () => void;
}

// Type-safe component props
export interface CaseSidebarProps extends CanvasEventHandlers {
  cases: readonly ValueCase[];
  selectedCaseId: CaseId | null;
  isFetchingCases: boolean;
}

export interface CanvasWorkspaceProps {
  renderedPage: any; // TODO: Type this properly
  isLoading: boolean;
  streamingUpdate: any; // TODO: Type this properly
  isInitialLoad?: boolean;
}

export interface CommandInterfaceProps extends CanvasEventHandlers {
  selectedCaseId: CaseId | null;
  workflowState: any; // TODO: Type this properly
  currentSessionId: string | null;
  sessionId: string | null;
  isLoading: boolean;
}
