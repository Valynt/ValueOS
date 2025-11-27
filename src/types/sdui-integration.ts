/**
 * Type definitions for SDUI integration layer
 */

import { SDUIPageDefinition } from '../sdui/schema';
import { LifecycleStage } from './workflow';
import { AtomicUIAction, ActionResult as AtomicActionResult } from '../sdui/AtomicUIActions';

/**
 * Workspace context for schema generation
 */
export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  lifecycleStage: LifecycleStage;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Canonical action types for UI interactions
 */
export type CanonicalAction =
  | { type: 'invokeAgent'; agentId: string; input: any; context: any }
  | { type: 'runWorkflowStep'; workflowId: string; stepId: string; input: any }
  | { type: 'updateValueTree'; treeId: string; updates: any }
  | { type: 'updateAssumption'; assumptionId: string; updates: any }
  | { type: 'exportArtifact'; artifactType: string; format: string }
  | { type: 'openAuditTrail'; entityId: string; entityType: string }
  | { type: 'showExplanation'; componentId: string; topic: string }
  | { type: 'navigateToStage'; stage: LifecycleStage }
  | { type: 'saveWorkspace'; workspaceId: string }
  | { type: 'mutateComponent'; action: AtomicUIAction };

/**
 * Action context for routing
 */
export interface ActionContext {
  workspaceId: string;
  userId: string;
  sessionId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Action result
 */
export interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
  schemaUpdate?: SDUIPageDefinition;
  atomicActions?: AtomicUIAction[];
  metadata?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Manifesto check result
 */
export interface ManifestoCheckResult {
  allowed: boolean;
  violations: ManifestoViolation[];
  warnings: ManifestoWarning[];
}

/**
 * Manifesto violation
 */
export interface ManifestoViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  context?: any;
}

/**
 * Manifesto warning
 */
export interface ManifestoWarning {
  rule: string;
  message: string;
  suggestion?: string;
}

/**
 * Action handler function
 */
export type ActionHandler = (
  action: CanonicalAction,
  context: ActionContext
) => Promise<ActionResult>;

/**
 * Schema cache entry
 */
export interface SchemaCacheEntry {
  schema: SDUIPageDefinition;
  timestamp: number;
  ttl: number;
  workspaceId: string;
  version: number;
}

/**
 * Workspace state for schema generation
 */
export interface WorkspaceState {
  workspaceId: string;
  lifecycleStage: LifecycleStage;
  currentWorkflowId?: string;
  currentStageId?: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  lastUpdated: number;
  version: number;
}

/**
 * SDUI update event
 */
export interface SDUIUpdate {
  type: 'full_schema' | 'atomic_actions' | 'partial_update';
  workspaceId: string;
  schema?: SDUIPageDefinition;
  actions?: AtomicUIAction[];
  timestamp: number;
  source: string;
}

/**
 * Template selection criteria
 */
export interface TemplateSelectionCriteria {
  lifecycleStage: LifecycleStage;
  dataAvailability: {
    systemMap?: boolean;
    valueTree?: boolean;
    kpis?: boolean;
    interventions?: boolean;
    feedbackLoops?: boolean;
  };
  userPreferences?: {
    layout?: string;
    density?: 'compact' | 'comfortable' | 'spacious';
  };
  features?: string[];
}
