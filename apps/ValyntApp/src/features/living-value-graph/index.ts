/**
 * Main export file for living-value-graph feature
 */

// Types
export type * from './types/graph.types';
export type * from './types/workflow.types';
export type * from './types/defensibility.types';
export type * from './types/ui.types';

// Stores
export { useWorkflowStore } from './store/workflow-store';
export { useDefensibilityStore } from './store/defensibility-store';
export { useWorkspaceStore } from './store/workspace-store';

// Hooks
export { useWorkflowState } from './hooks/useWorkflowState';
export { useStateGating } from './hooks/useStateGating';
export { useDefensibility } from './hooks/useDefensibility';
export { useGraphData } from './hooks/useGraphData';
export { useActivities } from './hooks/useActivities';

// Utils
export {
  calculateDefensibilityScore,
  formatDefensibilityScore,
  getDefensibilityColor,
  calculateNodeCoverage,
  isEvidenceValid,
} from './utils/defensibility-calc';

export {
  getGatingRules,
  canEdit,
  canApprove,
  canRedTeam,
} from './utils/state-gating';

// Shell Components
export { AppShell } from './components/shell/AppShell';
export { TopNav } from './components/shell/TopNav';
export { WorkspaceHeader } from './components/shell/WorkspaceHeader';
export { MainWorkspace } from './components/shell/MainWorkspace';
export { LeftRail } from './components/shell/LeftRail';
export { CenterCanvas } from './components/shell/CenterCanvas';
export { RightInspector } from './components/shell/RightInspector';
export { BottomTray } from './components/shell/BottomTray';

// Header Components
export { StateBadge } from './components/header/StateBadge';
export { DefensibilityScoreCard } from './components/header/DefensibilityScoreCard';
export { HeadlineValueCard } from './components/header/HeadlineValueCard';

// Left Rail Components
export { WorkflowStepPanel } from './components/left-rail/WorkflowStepPanel';
export { GraphOutlinePanel } from './components/left-rail/GraphOutlinePanel';
export { ArtifactsPanel } from './components/left-rail/ArtifactsPanel';
export { ScenarioLibraryPanel } from './components/left-rail/ScenarioLibraryPanel';

// Canvas Components
export { ValueTreeCanvas } from './components/canvas/ValueTreeCanvas';
export { GraphToolbar } from './components/canvas/GraphToolbar';
export { CanvasRouter } from './components/canvas/CanvasRouter';
export { InlineMutationBar } from './components/canvas/InlineMutationBar';

// Inspector Components
export { NodeSummaryCard } from './components/inspector/NodeSummaryCard';
export { FormulaPanel } from './components/inspector/FormulaPanel';
export { EvidencePanel } from './components/inspector/EvidencePanel';
export { ConfidencePanel } from './components/inspector/ConfidencePanel';
export { DefensibilityPanel } from './components/inspector/DefensibilityPanel';
export { InputsPanel } from './components/inspector/InputsPanel';

// Bottom Tray Components
export { WorkflowTimeline } from './components/bottom-tray/WorkflowTimeline';
export { DefensibilityFeed } from './components/bottom-tray/DefensibilityFeed';
export { ActivityFeed } from './components/bottom-tray/ActivityFeed';

// Drawers
export { ApprovalDrawer } from './components/drawers/ApprovalDrawer';
