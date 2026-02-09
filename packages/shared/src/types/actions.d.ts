/**
 * Action Type Definitions
 *
 * Core business logic interfaces for actions in the ValueOS system.
 * Extracted from ActionRouter for better type safety and decoupling.
 */
export type ActionType = "invokeAgent" | "runWorkflowStep" | "updateValueTree" | "updateAssumption" | "exportArtifact" | "openAuditTrail" | "showExplanation" | "navigateToStage" | "saveWorkspace" | "mutateComponent";
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
}
export interface ActionHandler<TInput = unknown, TOutput = unknown> {
    name: string;
    description?: string;
    validate?: (input: TInput) => boolean | Promise<boolean>;
    execute: (input: TInput, context: ActionContext) => Promise<ActionResult<TOutput>>;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export interface ManifestoViolation {
    ruleId: string;
    ruleName: string;
    severity: "error" | "warning" | "info";
    message: string;
    path?: string;
    suggestion?: string;
}
export interface ManifestoCheckResult {
    allowed: boolean;
    violations: ManifestoViolation[];
    warnings: ManifestoViolation[];
}
export interface ActionMetadata {
    timestamp: string;
    source: "user" | "agent" | "system";
    idempotency_key?: string;
    retry_count?: number;
}
export interface BaseCanonicalAction {
    id: string;
    type: ActionType;
    metadata?: ActionMetadata;
}
export interface InvokeAgentAction extends BaseCanonicalAction {
    type: "invokeAgent";
    agentId: string;
    input: unknown;
    execution?: unknown;
}
export interface RunWorkflowStepAction extends BaseCanonicalAction {
    type: "runWorkflowStep";
    workflowId: string;
    stepId: string;
}
export interface UpdateValueTreeAction extends BaseCanonicalAction {
    type: "updateValueTree";
    treeId: string;
    updates: unknown;
}
export interface UpdateAssumptionAction extends BaseCanonicalAction {
    type: "updateAssumption";
    assumptionId: string;
    updates: unknown;
}
export interface ExportArtifactAction extends BaseCanonicalAction {
    type: "exportArtifact";
    artifactType: string;
    format: string;
}
export interface OpenAuditTrailAction extends BaseCanonicalAction {
    type: "openAuditTrail";
    entityId: string;
    entityType: string;
}
export interface ShowExplanationAction extends BaseCanonicalAction {
    type: "showExplanation";
    componentId: string;
    topic: string;
}
export interface NavigateToStageAction extends BaseCanonicalAction {
    type: "navigateToStage";
    stage: string;
}
export interface SaveWorkspaceAction extends BaseCanonicalAction {
    type: "saveWorkspace";
    workspaceId: string;
}
export interface MutateComponentAction extends BaseCanonicalAction {
    type: "mutateComponent";
    action: string;
}
export type CanonicalAction = InvokeAgentAction | RunWorkflowStepAction | UpdateValueTreeAction | UpdateAssumptionAction | ExportArtifactAction | OpenAuditTrailAction | ShowExplanationAction | NavigateToStageAction | SaveWorkspaceAction | MutateComponentAction;
//# sourceMappingURL=actions.d.ts.map