/**
 * UI Types - Component and interface types
 */

export type CanvasView = 'tree' | 'waterfall' | 'scenario' | 'sensitivity' | 'timeline';

export type LeftRailTab = 'workflow' | 'outline' | 'scenarios' | 'views' | 'artifacts';

export type BottomTrayTab = 'workflow' | 'agent' | 'activity' | 'validation' | 'defensibility';

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface WorkspaceUIState {
  selectedNodeId: string | null;
  activeView: CanvasView;
  leftRailTab: LeftRailTab;
  bottomTrayTab: BottomTrayTab;
  workflowStep: import('./workflow.types').WorkflowStep;
  filters: {
    nodeTypes: string[];
    minConfidence: number | null;
    showLockedOnly: boolean;
    showEvidenceGapsOnly: boolean;
    showDefensibilityIssues: boolean;
  };
  canvas: CanvasState;
}

export interface Activity {
  id: string;
  type: 'recalculated' | 'evidence_attached' | 'objection_generated' | 'node_locked' | 'phase_transition';
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Validation {
  id: string;
  type: 'formula_error' | 'missing_evidence' | 'stale_citation' | 'unit_mismatch' | 'low_confidence';
  severity: 'error' | 'warning';
  nodeId?: string;
  message: string;
  autoFixable?: boolean;
}
