/**
 * SDUI (Server-Driven UI) Integration Type Definitions
 *
 * Types for dynamic UI generation, workspace state management,
 * canonical actions, and manifesto-driven UI updates.
 */

// ============================================================================
// SDUI Update Types
// ============================================================================

export interface SDUIUpdate {
  id: string;
  type: SDUIUpdateType;
  target: string;
  operation: SDUIOperation;
  payload: SDUIPayload;
  metadata?: SDUIMetadata;
  timestamp: string;
  actions?: Record<string, unknown>[];
  source?: string;
  workspaceId?: string;
  schema?: Record<string, unknown>;
}

export type SDUIUpdateType =
  | "component_add"
  | "component_update"
  | "component_remove"
  | "layout_change"
  | "state_sync"
  | "validation_result"
  | "navigation"
  | "notification";

export type SDUIOperation = "create" | "update" | "delete" | "replace" | "merge";

export interface SDUIPayload {
  component?: UIComponent;
  state?: Partial<WorkspaceState>;
  validation?: ValidationResult;
  navigation?: NavigationUpdate;
  data?: Record<string, any>;
}

export interface SDUIMetadata {
  source: string;
  correlation_id?: string;
  user_id?: string;
  organization_id?: string;
  lifecycle_stage?: string;
}

// ============================================================================
// UI Component Types
// ============================================================================

export interface UIComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: UIComponent[];
  validation?: ComponentValidation;
  events?: ComponentEvent[];
  position?: { x: number; y: number; z?: number };
  size?: { width: number | string; height: number | string };
  style?: Record<string, unknown>;
  className?: string;
  visible?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ComponentValidation {
  required: boolean;
  rules: ValidationRule[];
  error_message?: string;
}

export interface ValidationRule {
  type: string;
  value: any;
  message: string;
}

export interface ComponentEvent {
  name: string;
  action: string;
  parameters?: Record<string, any>;
}

// ============================================================================
// Workspace State Types
// ============================================================================

export interface WorkspaceState {
  workspace_id: string;
  workspaceId?: string;
  lifecycle_stage: string;
  lifecycleStage?: string;
  current_view: string;
  data: WorkspaceData;
  ui_state: UIState;
  validation_state: ValidationState;
  sync_status: SyncStatus;
  last_updated: string;
  version?: number;
  metadata?: Record<string, unknown>;
  currentWorkflowId?: string;
  currentStageId?: string;
}

export interface WorkspaceData {
  opportunity?: OpportunityData;
  target?: TargetData;
  realization?: RealizationData;
  expansion?: ExpansionData;
  integrity?: IntegrityData;
  metadata?: Record<string, any>;
}

export interface OpportunityData {
  problem_statement?: string;
  stakeholders?: string[];
  initial_metrics?: Record<string, any>;
  [key: string]: any;
}

export interface TargetData {
  goals?: string[];
  kpis?: Array<{ name: string; target: number; unit: string }>;
  timeline?: { start: string; end: string };
  [key: string]: any;
}

export interface RealizationData {
  implementation_plan?: string;
  milestones?: Array<{ name: string; date: string; status: string }>;
  [key: string]: any;
}

export interface ExpansionData {
  scaling_strategy?: string;
  new_opportunities?: string[];
  [key: string]: any;
}

export interface IntegrityData {
  validation_results?: ManifestoCheckResult[];
  audit_trail?: Array<{ timestamp: string; action: string; user: string }>;
  [key: string]: any;
}

export interface UIState {
  active_panel?: string;
  expanded_sections?: string[];
  selected_items?: string[];
  filters?: Record<string, any>;
  sort?: { field: string; direction: "asc" | "desc" };
}

export interface ValidationState {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  last_validated: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface SyncStatus {
  is_synced: boolean;
  last_sync: string;
  pending_changes: number;
  conflict_resolution?: "local" | "remote" | "manual";
}

// ============================================================================
// Workspace Context Types
// ============================================================================

export interface WorkspaceContext {
  workspace_id: string;
  workspaceId?: string;
  organization_id: string;
  user_id: string;
  userId?: string;
  session_id?: string;
  sessionId?: string;
  lifecycle_stage: string;
  lifecycleStage?: string;
  permissions: WorkspacePermissions;
  metadata?: Record<string, any>;
}

export interface WorkspacePermissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_share: boolean;
  can_admin: boolean;
}

// ============================================================================
// Canonical Action Types
// ============================================================================

export interface CanonicalAction {
  id: string;
  type: ActionType;
  context: ActionContext;
  payload: ActionPayload;
  metadata?: ActionMetadata;
  workspaceId?: string;
  stage?: string;
}

export type ActionType =
  | "create_opportunity"
  | "update_target"
  | "validate_manifesto"
  | "execute_workflow"
  | "sync_state"
  | "navigate"
  | "custom";

export interface ActionContext {
  workspace_id: string;
  workspaceId?: string;
  organization_id: string;
  user_id: string;
  userId?: string;
  session_id?: string;
  sessionId?: string;
  lifecycle_stage?: string;
  lifecycleStage?: string;
  correlation_id?: string;
}

export interface ActionPayload {
  action: string;
  parameters: Record<string, any>;
  validation?: {
    schema?: string;
    rules?: ValidationRule[];
  };
}

export interface ActionMetadata {
  timestamp: string;
  source: "user" | "agent" | "system";
  idempotency_key?: string;
  retry_count?: number;
}

// ============================================================================
// Manifesto Check Types
// ============================================================================

export interface ManifestoCheckResult {
  rule_id: string;
  rule_name: string;
  status: "passed" | "failed" | "warning";
  message: string;
  severity: "critical" | "high" | "medium" | "low";
  context?: Record<string, unknown>;
  timestamp: string;
  violations?: ManifestoViolation[];
  warnings?: string[];
}

export interface ManifestoValidation {
  workspace_id: string;
  lifecycle_stage: string;
  overall_status: "valid" | "invalid" | "needs_review";
  checks: ManifestoCheckResult[];
  score: number;
  validated_at: string;
}

// ============================================================================
// Navigation Types
// ============================================================================

export interface NavigationUpdate {
  target_view: string;
  target_stage?: string;
  parameters?: Record<string, any>;
  transition?: "push" | "replace" | "back";
}

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  is_valid: boolean;
  field?: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions?: string[];
}

// ============================================================================
// Stage Completion Event (for workflow-sdui bridge)
// ============================================================================

export interface StageCompletionEvent {
  workspace_id: string;
  stage_id: string;
  lifecycle_stage: string;
  status: "completed" | "failed" | "skipped";
  output_data: Record<string, any>;
  timestamp: string;
}

export interface WorkflowProgress {
  workspace_id: string;
  workflow_id: string;
  current_stage: string;
  completed_stages: string[];
  total_stages: number;
  progress_percentage: number;
  estimated_completion?: string;
}

// ============================================================================
// Action Handler Types (Stub exports for ActionRouter compatibility)
// ============================================================================

export interface ActionContext {
  userId: string;
  organizationId: string;
  workspaceId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  metadata?: Record<string, unknown>;
  schemaUpdate?: unknown;
  atomicActions?: unknown[];
}

export interface ActionHandler<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  validate?: (input: TInput) => boolean | Promise<boolean>;
  execute: (input: TInput, context: ActionContext) => Promise<ActionResult<TOutput>>;
}

export interface ManifestoViolation {
  ruleId: string;
  ruleName: string;
  severity: "error" | "warning" | "info";
  message: string;
  path?: string;
  suggestion?: string;
}
