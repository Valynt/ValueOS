/**
 * Agent State Machine Types
 *
 * Defines the 7-state model for agent interactions:
 * Idle → Clarify → Plan → Execute → Review → Finalize → Resume
 */

/**
 * Agent states in the workflow
 */
export type AgentState =
  | "idle" // Waiting for user input
  | "clarify" // Agent needs clarification
  | "plan" // Showing proposed plan for approval
  | "execute" // Executing approved tasks
  | "review" // Showing results for review
  | "finalize" // Committing/saving results
  | "resume"; // Restoring a previous session

/**
 * State transition events
 */
export type AgentEvent =
  | { type: "START"; payload: { prompt: string; context?: Record<string, unknown> } }
  | { type: "CLARIFY_NEEDED"; payload: ClarifyQuestion }
  | { type: "CLARIFY_RESPONSE"; payload: { answer: string } }
  | { type: "PLAN_READY"; payload: { plan: PlanStep[] } }
  | { type: "PLAN_APPROVED"; payload: { approvedSteps?: string[] } }
  | { type: "PLAN_MODIFIED"; payload: { modifications: PlanModification[] } }
  | { type: "PLAN_REJECTED" }
  | { type: "EXECUTE_PROGRESS"; payload: ExecutionProgress }
  | { type: "EXECUTE_COMPLETE"; payload: { results: ExecutionResult[] } }
  | { type: "EXECUTE_ERROR"; payload: AgentError }
  | { type: "EXECUTE_PAUSE" }
  | { type: "EXECUTE_RESUME" }
  | { type: "REVIEW_APPROVE"; payload: { approvedItems?: string[] } }
  | { type: "REVIEW_REJECT"; payload: { reason: string } }
  | { type: "REVIEW_REVISE"; payload: { revisions: RevisionRequest[] } }
  | { type: "FINALIZE_COMPLETE"; payload: FinalizeResult }
  | { type: "FINALIZE_ERROR"; payload: AgentError }
  | { type: "SESSION_RESTORE"; payload: { sessionId: string } }
  | { type: "CANCEL" }
  | { type: "RESET" };

/**
 * Clarification question from agent
 */
export interface ClarifyQuestion {
  id: string;
  question: string;
  type: "text" | "choice" | "multi-choice" | "confirm";
  options?: ClarifyOption[];
  defaultValue?: string;
  required: boolean;
  context?: string;
  timeoutSeconds?: number;
}

export interface ClarifyOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Plan step proposed by agent
 */
export interface PlanStep {
  id: string;
  title: string;
  description: string;
  type: "research" | "analyze" | "generate" | "validate" | "integrate";
  estimatedDuration?: number; // seconds
  estimatedTokens?: number;
  dependencies?: string[]; // IDs of steps this depends on
  status: "pending" | "approved" | "rejected" | "modified";
  reasoning?: string;
}

export interface PlanModification {
  stepId: string;
  action: "modify" | "remove" | "reorder";
  newTitle?: string;
  newDescription?: string;
  newPosition?: number;
}

/**
 * Execution progress update
 */
export interface ExecutionProgress {
  currentStepId: string;
  currentStepIndex: number;
  totalSteps: number;
  stepProgress: number; // 0-100
  overallProgress: number; // 0-100
  elapsedSeconds: number;
  estimatedRemainingSeconds?: number;
  reasoning?: string; // Live reasoning stream
  validationStatus?: "pending" | "validating" | "validated" | "failed";
}

/**
 * Execution result for a step
 */
export interface ExecutionResult {
  stepId: string;
  status: "success" | "partial" | "failed" | "skipped";
  output?: unknown;
  artifacts?: Artifact[];
  error?: string;
  duration: number;
  tokensUsed?: number;
}

/**
 * Artifact produced by agent
 */
export interface Artifact {
  id: string;
  type: "document" | "data" | "chart" | "table" | "code" | "image";
  title: string;
  content: unknown;
  format?: string;
  size?: number;
  sourceReferences?: SourceReference[];
}

export interface SourceReference {
  id: string;
  title: string;
  url?: string;
  excerpt?: string;
  confidence: number; // 0-1
  page?: number;
}

/**
 * Revision request during review
 */
export interface RevisionRequest {
  artifactId: string;
  field?: string;
  currentValue?: unknown;
  requestedChange: string;
  priority: "low" | "medium" | "high";
}

/**
 * Finalize result
 */
export interface FinalizeResult {
  sessionId: string;
  savedArtifacts: SavedArtifact[];
  integrations?: IntegrationResult[];
  summary: string;
  nextSteps?: string[];
}

export interface SavedArtifact {
  artifactId: string;
  location: string;
  version: number;
}

export interface IntegrationResult {
  system: string; // e.g., "salesforce", "hubspot"
  status: "success" | "partial" | "failed";
  recordId?: string;
  error?: string;
}

/**
 * Agent error
 */
export interface AgentError {
  code: string;
  message: string;
  recoverable: boolean;
  retryable: boolean;
  suggestions?: string[];
  details?: Record<string, unknown>;
}

/**
 * Full agent session state
 */
export interface AgentSessionState {
  sessionId: string;
  state: AgentState;
  startedAt: string;
  updatedAt: string;

  // Context
  prompt?: string;
  tenantId: string;
  userId: string;
  workspaceId?: string;

  // State-specific data
  clarifyQuestion?: ClarifyQuestion;
  plan?: PlanStep[];
  progress?: ExecutionProgress;
  results?: ExecutionResult[];
  artifacts?: Artifact[];
  error?: AgentError;

  // Resume data
  canResume: boolean;
  resumePoint?: {
    state: AgentState;
    stepId?: string;
  };

  // Metrics
  totalTokensUsed?: number;
  totalDuration?: number;
}

/**
 * State machine context
 */
export interface AgentStateMachineContext {
  session: AgentSessionState;
  isPaused: boolean;
  isConnected: boolean;
}

/**
 * Valid state transitions
 */
export const STATE_TRANSITIONS: Record<AgentState, AgentState[]> = {
  idle: ["clarify", "plan"],
  clarify: ["idle", "plan"],
  plan: ["idle", "execute", "clarify"],
  execute: ["review", "idle"], // Can cancel to idle
  review: ["finalize", "execute", "idle"], // Can revise (back to execute) or cancel
  finalize: ["idle"],
  resume: ["idle", "clarify", "plan", "execute", "review"], // Can resume to any active state
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: AgentState, to: AgentState): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}
